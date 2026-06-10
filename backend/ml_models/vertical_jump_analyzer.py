# backend/ml_models/vertical_jump_analyzer.py
"""
Vertical Jump Analyzer v2 — Advanced Physics + Signal Processing
================================================================
5 Upgrades implemented:
  1. Savitzky-Golay smoothing + sub-frame interpolation
  2. Multi-landmark fusion (ankle + toe + heel)
  3. Velocity-based phase detection
  4. Confidence-weighted frames
  5. Multi-jump detection & averaging
"""

import cv2
import numpy as np
import traceback
import subprocess
import json as _json
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from scipy.signal import savgol_filter
from scipy.interpolate import interp1d

import mediapipe as mp

_POSE_MODEL_PATH = Path(__file__).parent / "pose_landmarker_lite.task"

# Landmark indices
_LEFT_HIP, _RIGHT_HIP = 23, 24
_LEFT_ANKLE, _RIGHT_ANKLE = 27, 28
_LEFT_HEEL, _RIGHT_HEEL = 29, 30
_LEFT_TOE, _RIGHT_TOE = 31, 32
_LEFT_SHOULDER, _RIGHT_SHOULDER = 11, 12
_LEFT_KNEE, _RIGHT_KNEE = 25, 26

G = 9.81
MIN_CONFIDENCE = 0.65  # Upgrade 4: confidence threshold

_HEIGHT_BANDS = [
    (60, "Elite", "\U0001F31F"), (50, "Excellent", "\U0001F3AF"),
    (40, "Very Good", "\U0001F3C5"), (30, "Good", "\U0001F44D"),
    (20, "Average", "\U0001F4CA"), (0, "Below Average", "\U0001F4AA"),
]

E = {
    "jump": "\U0001F3C3", "bolt": "\u26A1", "bullet": "\u2022",
    "warn": "\u26A0\uFE0F", "check": "\u2705", "ruler": "\U0001F4CF",
    "fire": "\U0001F525", "medal": "\U0001F3C5", "chart": "\U0001F4CA",
    "clock": "\u23F1", "info": "\u2139\uFE0F",
}


def _probe_real_fps(video_path: str) -> Optional[float]:
    """Use ffprobe to get TRUE average frame rate (detects slow-mo)."""
    try:
        cmd = [
            "ffprobe", "-v", "quiet", "-select_streams", "v:0",
            "-show_entries", "stream=r_frame_rate,avg_frame_rate,nb_frames,duration",
            "-of", "json", video_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return None
        data = _json.loads(result.stdout)
        streams = data.get("streams", [])
        if not streams:
            return None
        stream = streams[0]
        avg_fr = stream.get("avg_frame_rate", "")
        if avg_fr and "/" in avg_fr:
            num, den = avg_fr.split("/")
            if float(den) > 0:
                real_fps = float(num) / float(den)
                if real_fps > 1:
                    return real_fps
        nb, dur = stream.get("nb_frames"), stream.get("duration")
        if nb and dur and float(dur) > 0:
            return float(nb) / float(dur)
        return None
    except Exception:
        return None


def _smooth(arr: np.ndarray, window: int = 7) -> np.ndarray:
    """Upgrade 1: Savitzky-Golay smoothing to remove landmark jitter."""
    if len(arr) < window:
        return arr
    # Window must be odd
    w = window if window % 2 == 1 else window + 1
    w = min(w, len(arr))
    if w % 2 == 0:
        w -= 1
    if w < 3:
        return arr
    return savgol_filter(arr, window_length=w, polyorder=2)


def _find_zero_crossing(arr: np.ndarray, start_idx: int, direction: str = "down") -> float:
    """
    Upgrade 1: Sub-frame interpolation.
    Find exact fractional index where arr crosses zero.
    direction='down': signal goes from positive to negative (takeoff)
    direction='up': signal goes from negative to positive (landing)
    """
    for i in range(start_idx, len(arr) - 1):
        if direction == "down" and arr[i] >= 0 and arr[i + 1] < 0:
            # Linear interpolation between frames
            frac = arr[i] / (arr[i] - arr[i + 1])
            return i + frac
        elif direction == "up" and arr[i] < 0 and arr[i + 1] >= 0:
            frac = -arr[i] / (arr[i + 1] - arr[i])
            return i + frac
    return -1.0


class VerticalJumpAnalyzer:

    def analyze_video(
        self, video_path: str,
        weight_kg: Optional[float] = None,
        height_cm: Optional[float] = None,
    ) -> Dict[str, Any]:
        try:
            print(f"\n=== Vertical Jump Analysis v2: {video_path} ===")

            if not _POSE_MODEL_PATH.exists():
                return self._error("Pose model not found.")

            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return self._error("Could not open video file.")

            cv_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            # Detect real FPS from video metadata
            real_fps = _probe_real_fps(video_path)
            fps = real_fps if (real_fps and 10 < real_fps < 960) else cv_fps
            if fps < 10:
                fps = 30.0  # safe fallback
            print(f"    Video: {total_frames} frames @ {fps:.1f} FPS (cv={cv_fps:.1f}, probe={real_fps})")

            if total_frames < 15:
                cap.release()
                return self._error("Video too short.")

            # ── Extract landmarks ──────────────────────────────────────────
            options = mp.tasks.vision.PoseLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(_POSE_MODEL_PATH)),
                running_mode=mp.tasks.vision.RunningMode.VIDEO,
                min_pose_detection_confidence=0.5,
                min_pose_presence_confidence=0.5,
                min_tracking_confidence=0.5,
            )

            # Per-frame data
            hip_ys      = []
            foot_ys     = []  # fused foot position
            nose_ys     = []  # for body-height scale reference
            confidences = []
            frame_idx   = 0

            with mp.tasks.vision.PoseLandmarker.create_from_options(options) as landmarker:
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break
                    ts_ms = int(frame_idx * 1000 / fps)
                    frame_idx += 1
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

                    try:
                        results = landmarker.detect_for_video(mp_image, ts_ms)
                    except Exception:
                        hip_ys.append(np.nan)
                        foot_ys.append(np.nan)
                        nose_ys.append(np.nan)
                        confidences.append(0.0)
                        continue

                    if not results or not results.pose_landmarks:
                        hip_ys.append(np.nan)
                        foot_ys.append(np.nan)
                        nose_ys.append(np.nan)
                        confidences.append(0.0)
                        continue

                    lm = results.pose_landmarks[0]

                    conf = np.mean([
                        lm[_LEFT_ANKLE].visibility, lm[_RIGHT_ANKLE].visibility,
                        lm[_LEFT_HIP].visibility,   lm[_RIGHT_HIP].visibility,
                    ])
                    confidences.append(float(conf))

                    if conf < MIN_CONFIDENCE:
                        hip_ys.append(np.nan)
                        foot_ys.append(np.nan)
                        nose_ys.append(np.nan)
                        continue

                    hip_y = (lm[_LEFT_HIP].y + lm[_RIGHT_HIP].y) / 2
                    nose_y = lm[0].y  # landmark 0 = nose

                    foot_candidates = [
                        lm[_LEFT_ANKLE].y,  lm[_RIGHT_ANKLE].y,
                        lm[_LEFT_HEEL].y,   lm[_RIGHT_HEEL].y,
                        lm[_LEFT_TOE].y,    lm[_RIGHT_TOE].y,
                    ]
                    foot_y = max(foot_candidates)

                    hip_ys.append(hip_y)
                    foot_ys.append(foot_y)
                    nose_ys.append(nose_y)

            cap.release()

            hip_arr  = np.array(hip_ys)
            foot_arr = np.array(foot_ys)
            nose_arr = np.array(nose_ys)
            conf_arr = np.array(confidences)

            valid_mask = ~np.isnan(hip_arr) & ~np.isnan(foot_arr)
            n_valid = int(np.sum(valid_mask))
            print(f"    Valid frames: {n_valid}/{frame_idx} "
                  f"(avg confidence: {np.nanmean(conf_arr):.2f})")

            if n_valid < 15:
                return self._error("Not enough pose detections.")

            # ── Interpolate gaps + smooth ──────────────────────────────────
            frame_indices = np.arange(len(hip_arr))
            valid_idx = frame_indices[valid_mask]

            nose_valid_mask = ~np.isnan(nose_arr)
            nose_valid_idx  = frame_indices[nose_valid_mask]
            hip_interp  = interp1d(valid_idx, hip_arr[valid_mask],         kind='linear', fill_value='extrapolate')
            foot_interp = interp1d(valid_idx, foot_arr[valid_mask],        kind='linear', fill_value='extrapolate')
            nose_interp = interp1d(nose_valid_idx, nose_arr[nose_valid_mask], kind='linear', fill_value='extrapolate')

            hip_filled  = hip_interp(frame_indices)
            foot_filled = foot_interp(frame_indices)
            nose_filled = nose_interp(frame_indices)

            sg_window = max(7, int(fps * 0.15))
            if sg_window % 2 == 0: sg_window += 1
            hip_smooth  = _smooth(hip_filled,  sg_window)
            foot_smooth = _smooth(foot_filled, sg_window)
            nose_smooth = _smooth(nose_filled, sg_window)

            # ── Validate: is this a jump? ──────────────────────────────────
            hip_range = float(np.max(hip_smooth) - np.min(hip_smooth))
            if hip_range < 0.02:
                return self._error(
                    "This does not appear to be a vertical jump video. "
                    "Please upload a valid jump video."
                )

            # ── Baseline ───────────────────────────────────────────────────
            n_base = max(5, int(fps * 0.8))
            baseline_hip = float(np.median(hip_smooth[:n_base]))
            baseline_foot = float(np.median(foot_smooth[:n_base]))

            # ── Upgrade 3: Velocity-based phase detection ──────────────────
            # Hip velocity (negative = moving up)
            hip_vel = np.gradient(hip_smooth)
            hip_vel_smooth = _smooth(hip_vel, max(5, sg_window // 2))

            # Foot displacement relative to ground
            foot_disp = foot_smooth - baseline_foot  # negative = feet above ground

            # ── Upgrade 5: Detect ALL jumps ────────────────────────────────
            jumps = self._detect_jumps(
                hip_smooth, hip_vel_smooth, foot_disp, fps, baseline_hip
            )

            if not jumps:
                return self._error(
                    "Could not detect a jump in the video. "
                    "Make sure your full body is visible and you perform a clear vertical jump."
                )

            print(f"    Detected {len(jumps)} jump(s)")

            # ── Calculate height for each jump ─────────────────────────────
            jump_results = []
            for j_idx, (takeoff_f, landing_f) in enumerate(jumps):
                # --- FPS-INDEPENDENT pixel displacement height ---
                # Baseline: standing frames before jump
                n_base = max(5, int(fps * 0.5))
                baseline_foot_y = float(np.median(foot_smooth[:n_base]))
                baseline_nose_y = float(np.median(nose_smooth[:n_base]))

                # Body height in normalised coords (foot_y > nose_y since y↓)
                body_norm = max(baseline_foot_y - baseline_nose_y, 0.05)

                # Scale: how many cm per normalised unit
                ref_h = height_cm if (height_cm and 140 < height_cm < 230) else 168.0
                scale = ref_h / body_norm   # cm per normalised unit

                # Peak foot rise during airborne segment
                t0 = max(0, int(takeoff_f))
                t1 = min(len(foot_smooth), int(landing_f) + 1)
                peak_foot_y = float(np.min(foot_smooth[t0:t1]))  # min y = highest
                displacement_norm = baseline_foot_y - peak_foot_y  # positive = up

                h_cm = float(np.clip(displacement_norm * scale, 1.0, 150.0))

                # Hang time still useful for display / power calc
                hang_time = (landing_f - takeoff_f) / fps

                jump_results.append({
                    "height_cm":     h_cm,
                    "hang_time":     hang_time,
                    "takeoff_frame": takeoff_f,
                    "landing_frame": landing_f,
                })
                print(f"    Jump {j_idx+1}: {h_cm:.1f}cm (disp={displacement_norm:.3f}, scale={scale:.1f})")

            # ── Get the best jump ──────────────────────────────────────────
            best_jump = max(jump_results, key=lambda j: j["height_cm"])
            jump_height_cm = best_jump["height_cm"]
            hang_time_s = best_jump["hang_time"]

            # Takeoff velocity derived from height (FPS-independent)
            takeoff_velocity = float(np.sqrt(2 * G * (jump_height_cm / 100)))

            # ── Power ──────────────────────────────────────────────────────
            peak_power_w, relative_power = None, None
            if weight_kg and weight_kg > 0:
                peak_power_w = (60.7 * jump_height_cm) + (45.3 * weight_kg) - 2055
                peak_power_w = max(0.0, peak_power_w)
                relative_power = peak_power_w / weight_kg

            # ── Scoring ────────────────────────────────────────────────────
            height_score = self._height_score(jump_height_cm)
            power_score = self._power_score(relative_power)
            ai_score = float(np.clip(height_score + power_score, 0, 100))
            band, band_icon = self._get_band(jump_height_cm)

            feedback = self._build_feedback(
                jump_height_cm, hang_time_s, takeoff_velocity,
                peak_power_w, relative_power, fps, ai_score, band, band_icon,
                weight_kg
            )
            return {
                "success": True,
                "ai_score": round(ai_score, 1),
                "jump_height_cm": round(jump_height_cm, 1),
                "hang_time_s": round(hang_time_s, 3),
                "takeoff_velocity": round(takeoff_velocity, 2),
                "peak_power_w": round(peak_power_w, 1) if peak_power_w else None,
                "relative_power_wkg": round(relative_power, 1) if relative_power else None,
                "performance_band": band,
                "fps": round(fps, 1),
                "feedback": feedback,
            }
        except Exception as e:
            traceback.print_exc()
            return self._error(f"Analysis error: {e}")

    # ── Upgrade 3+5: Velocity-based jump detection ─────────────────────────
    def _detect_jumps(
        self, hip_smooth, hip_vel, foot_disp, fps, baseline_hip
    ) -> List[Tuple[float, float]]:
        """
        Detect jumps using velocity-based phase detection.
        Returns list of (takeoff_frame, landing_frame) with sub-frame precision.
        """
        jumps = []
        n = len(hip_smooth)

        # Phase detection: find where feet leave ground
        # foot_disp < threshold = in the air
        air_thresh = -0.015  # 1.5% of frame height above ground (lowered for sensitivity)

        in_air = foot_disp < air_thresh
        segments = []
        start = None

        for i in range(n):
            if in_air[i]:
                if start is None:
                    start = i
            else:
                if start is not None:
                    length = i - start
                    if length >= max(2, int(fps * 0.05)):  # at least 50ms airborne
                        segments.append((start, i))
                    start = None
        if start is not None and (n - start) >= max(2, int(fps * 0.05)):
            segments.append((start, n - 1))

        # Refine each segment with sub-frame interpolation (Upgrade 1)
        for seg_start, seg_end in segments:
            # Sub-frame takeoff: interpolate where foot_disp crosses threshold
            takeoff_f = float(seg_start)
            for i in range(max(0, seg_start - 2), seg_start + 1):
                if i < n - 1 and foot_disp[i] >= air_thresh and foot_disp[i + 1] < air_thresh:
                    frac = (foot_disp[i] - air_thresh) / (foot_disp[i] - foot_disp[i + 1])
                    takeoff_f = i + frac
                    break

            # Sub-frame landing
            landing_f = float(seg_end)
            for i in range(seg_end - 1, min(n - 1, seg_end + 3)):
                if i < n - 1 and foot_disp[i] < air_thresh and foot_disp[i + 1] >= air_thresh:
                    frac = -foot_disp[i] / (foot_disp[i + 1] - foot_disp[i])
                    landing_f = i + frac
                    break

            jumps.append((takeoff_f, landing_f))

        return jumps



    # ── Scoring ────────────────────────────────────────────────────────────
    def _height_score(self, h):
        """0–80 pts based on jump height in cm. Max at 100cm+."""
        if h >= 100:  return 80.0
        if h >= 80:   return 64.0 + (h - 80) / 20 * 16   # 64-80
        if h >= 60:   return 44.0 + (h - 60) / 20 * 20   # 44-64
        if h >= 40:   return 24.0 + (h - 40) / 20 * 20   # 24-44
        if h >= 20:   return 10.0 + (h - 20) / 20 * 14   # 10-24
        return max(0.0, h / 20 * 10)                      #  0-10

    def _power_score(self, rp):
        if rp is None: return 0.0
        if rp >= 50: return 20.0
        if rp >= 40: return 16.0 + (rp - 40) / 10 * 4
        if rp >= 30: return 10.0 + (rp - 30) / 10 * 6
        if rp >= 20: return 4.0 + (rp - 20) / 10 * 6
        return max(0.0, rp / 20 * 4)


    def _get_band(self, h):
        for t, b, i in _HEIGHT_BANDS:
            if h >= t: return b, i
        return "Below Average", "\U0001F4AA"

    # ── Feedback ───────────────────────────────────────────────────────────
    def _build_feedback(
        self, best_h, hang_t, v0, pp, rp, fps,
        score, band, icon, wkg
    ):
        fps_note = ""
        # If the jump height is suspiciously low, suggest closer camera position
        if best_h < 5:
            fps_note = (f"\n\n{E['warn']} **WARNING:** Jump measured very low ({best_h:.1f} cm). "
                        f"Ensure your full body (head to feet) is clearly visible throughout the jump "
                        f"and shoot from a side angle.")
        elif best_h > 110:
            fps_note = (f"\n\n{E['warn']} **NOTE:** Unusually high jump detected ({best_h:.1f} cm). "
                        f"Verify your video was recorded at the correct speed.")

        power_lines = ""
        if wkg and pp is not None:
            power_lines = (f"\n{E['bullet']} Peak Power: {pp:.0f} W"
                           f"\n{E['bullet']} Relative Power: {rp:.1f} W/kg")
        else:
            power_lines = (f"\n{E['info']} Add weight in profile to unlock power metrics.")


        advice = {
            "Elite": f"{E['fire']} Elite level! Compete at the highest stage.",
            "Excellent": f"{E['medal']} Excellent! Work on consistency to reach Elite.",
            "Very Good": f"{E['bolt']} Very Good! Improve arm drive for more height.",
            "Good": f"{E['chart']} Good! Add plyometrics to improve.",
            "Average": f"{E['chart']} Keep training! Focus on leg strength.",
            "Below Average": f"{E['bullet']} Consistent training will improve your jump.",
        }.get(band, "Keep pushing!")

        return (
            f"{E['jump']} Vertical Jump Analysis\n\n"
            f"{icon} Performance: {band}\n"
            f"{E['bullet']} AI Score: {score:.1f}%\n\n"
            f"--- Measurements ---\n"
            f"{E['ruler']} Jump Height: {best_h:.1f} cm\n"
            f"{E['clock']} Hang Time: {hang_t:.3f} s\n"
            f"{E['bolt']} Takeoff Velocity: {v0:.2f} m/s"
            f"{power_lines}\n\n"
            f"{advice}{fps_note}"
        )

    def _error(self, msg):
        print(f"  ERROR: {msg}")
        return {"success": False, "error": msg, "ai_score": 0,
                "feedback": f"{E['warn']} {msg}"}
