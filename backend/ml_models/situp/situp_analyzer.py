# backend/ml_models/situp/situp_analyzer.py
"""
Sit-Up Analyzer
===============
Uses a trained position classifier (sit_up / sit_down) to count
rep transitions from MediaPipe pose landmarks extracted per video frame.

Rep counting logic:
  DOWN → UP → DOWN = 1 complete rep

Model files required in this directory:
  - situp_classifier.tflite   (or situp_classifier.keras)
  - situp_scaler.pkl
  - situp_model_config.json
"""

import cv2
import json
import numpy as np
import traceback
from pathlib import Path
from typing import Dict, Any, Optional, List

import mediapipe as mp
import joblib
import hashlib

_DIR = Path(__file__).parent
_TFLITE_PATH = _DIR / "situp_classifier.tflite"
_KERAS_PATH  = _DIR / "situp_classifier.keras"
_SCALER_PATH = _DIR / "situp_scaler.pkl"
_CONFIG_PATH = _DIR / "situp_model_config.json"

_POSE_MODEL  = Path(__file__).parent.parent / "pose_landmarker_lite.task"

# All 33 MediaPipe landmark indices mapped to their names in the Kaggle CSV
_MP_NAME_TO_IDX = {
    "nose": 0, "left_eye_inner": 1, "left_eye": 2, "left_eye_outer": 3,
    "right_eye_inner": 4, "right_eye": 5, "right_eye_outer": 6,
    "left_ear": 7, "right_ear": 8, "mouth_left": 9, "mouth_right": 10,
    "left_shoulder": 11, "right_shoulder": 12, "left_elbow": 13,
    "right_elbow": 14, "left_wrist": 15, "right_wrist": 16,
    "left_pinky_1": 17, "right_pinky_1": 18, "left_index_1": 19,
    "right_index_1": 20, "left_thumb_2": 21, "right_thumb_2": 22,
    "left_hip": 23, "right_hip": 24, "left_knee": 25, "right_knee": 26,
    "left_ankle": 27, "right_ankle": 28, "left_heel": 29, "right_heel": 30,
    "left_foot_index": 31, "right_foot_index": 32,
    # Fallbacks for some common naming variations
    "left_pinky": 17, "right_pinky": 18, "left_index": 19, "right_index": 20,
    "left_thumb": 21, "right_thumb": 22
}

G = {
    "situp": "\U0001F9D8",  # 🧘
    "fire":  "\U0001F525",  # 🔥
    "check": "\u2705",      # ✅
    "warn":  "\u26A0\uFE0F",# ⚠️
    "medal": "\U0001F3C5",  # 🏅
    "chart": "\U0001F4CA",  # 📊
    "bullet":"\u2022",      # •
    "bolt":  "\u26A1",      # ⚡
    "muscle":"\U0001F4AA",  # 💪
    "star":  "\u2B50",      # ⭐
}

# Scoring standards — based on Army/police physical fitness test norms
# for a 2-minute sit-up test. Adapted for 1-minute (divide by ~1.5)
_SCORE_TABLE = [
    (50, 100),   # 50+ reps = 100 pts (elite)
    (45, 90),
    (40, 80),
    (35, 70),
    (30, 60),
    (25, 50),
    (20, 40),
    (15, 30),
    (10, 20),
    (5,  15),
    (1,  10),    # minimum score for any genuine attempt
    (0,   0),    # 0 only if no reps detected at all
]


def _score_from_reps(reps: int) -> float:
    for threshold, pts in _SCORE_TABLE:
        if reps >= threshold:
            return float(pts)
    return 0.0


def _band_from_reps(reps: int) -> tuple:
    if reps >= 50: return "Elite",         "\U0001F31F"
    if reps >= 40: return "Excellent",     "\U0001F3AF"
    if reps >= 30: return "Very Good",     "\U0001F3C5"
    if reps >= 20: return "Good",          "\U0001F44D"
    if reps >= 10: return "Average",       "\U0001F4CA"
    return             "Below Average",    "\U0001F4AA"


# ============================================================================
# ANTI-CHEAT CONSTANTS
# ============================================================================

# A single sit-up (down → up → down) physically takes at least this long
MIN_SECONDS_PER_REP = 0.8
# A human cannot sustain more than this many reps per second
MAX_REPS_PER_SECOND = 1.2
# Frames sampled per video segment for loop detection
LOOP_DETECTION_SAMPLES = 10


def _frame_signature(frame) -> np.ndarray:
    """16x16 grayscale thumbnail as float32 — better pose discrimination than 8x8."""
    small = cv2.resize(frame, (16, 16), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)


def _perceptual_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Normalised cross-correlation similarity in [0,1]. Robust to brightness shifts."""
    a_f = a.flatten() - a.mean()
    b_f = b.flatten() - b.mean()
    denom = np.linalg.norm(a_f) * np.linalg.norm(b_f)
    if denom < 1e-6:
        return 1.0
    return float(np.dot(a_f, b_f) / denom)


def _detect_video_loop(video_path: str) -> bool:
    """
    Layer 1 — Video Loop Detection.
    Uses perceptual similarity (normalised cross-correlation) on 8x8 thumbnails.
    Threshold: >= 0.65 average similarity between segments = looped video.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return False

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total < 600:   # skip for videos under ~20s — too short for reliable loop detection
        cap.release()
        return False

    third = total // 3
    n = LOOP_DETECTION_SAMPLES

    def sample_signatures(start: int, end: int) -> List[np.ndarray]:
        sigs = []
        indices = [start + (end - start) * i // n for i in range(n)]
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                sigs.append(_frame_signature(frame))
        return sigs

    s1 = sample_signatures(0, third)
    s2 = sample_signatures(third, 2 * third)
    s3 = sample_signatures(2 * third, total)
    cap.release()

    def avg_similarity(a: List[np.ndarray], b: List[np.ndarray]) -> float:
        if not a or not b:
            return 0.0
        return float(np.mean([_perceptual_similarity(x, y) for x, y in zip(a, b)]))

    sim_12 = avg_similarity(s1, s2)
    sim_13 = avg_similarity(s1, s3)
    print(f"[AntiCheat-SitUp] Perceptual similarity — seg1↔seg2: {sim_12:.3f}, seg1↔seg3: {sim_13:.3f}")

    # >= 0.92: near-identical = looped video. Genuine videos score 0.75-0.89.
    return sim_12 >= 0.92 or sim_13 >= 0.92



class SitUpAnalyzer:

    def __init__(self):
        self._tflite   = None
        self._keras    = None
        self._scaler   = None
        self._config   = None
        self._n_feats  = None
        self._loaded   = False

    def _load_model(self) -> bool:
        """Lazy-load model files."""
        if self._loaded:
            return True

        if not _SCALER_PATH.exists():
            print(f"  [SitUp] Scaler not found: {_SCALER_PATH}")
            return False

        if not _CONFIG_PATH.exists():
            print(f"  [SitUp] Config not found: {_CONFIG_PATH}")
            return False

        try:
            self._scaler = joblib.load(_SCALER_PATH)
            with open(_CONFIG_PATH) as f:
                self._config = json.load(f)
            self._n_feats = self._config["num_features"]

            # Try TFLite first (faster), then Keras
            if _TFLITE_PATH.exists():
                import tensorflow as tf
                self._tflite = tf.lite.Interpreter(model_path=str(_TFLITE_PATH))
                self._tflite.allocate_tensors()
                self._in_idx  = self._tflite.get_input_details()[0]['index']
                self._out_idx = self._tflite.get_output_details()[0]['index']
                print("  [SitUp] Loaded TFLite model ✅")
            elif _KERAS_PATH.exists():
                import tensorflow as tf
                self._keras = tf.keras.models.load_model(str(_KERAS_PATH))
                print("  [SitUp] Loaded Keras model ✅")
            else:
                print(f"  [SitUp] No model file found.")
                return False

            self._loaded = True
            return True

        except Exception as e:
            print(f"  [SitUp] Model load error: {e}")
            return False

    def _predict(self, landmarks_flat: np.ndarray) -> int:
        """
        Predict position class.
        Returns: 0 = sit_down, 1 = sit_up
        """
        # Match expected feature count (pad or trim)
        if len(landmarks_flat) < self._n_feats:
            landmarks_flat = np.pad(landmarks_flat, (0, self._n_feats - len(landmarks_flat)))
        else:
            landmarks_flat = landmarks_flat[:self._n_feats]

        x = self._scaler.transform([landmarks_flat]).astype(np.float32)

        if self._tflite:
            self._tflite.set_tensor(self._in_idx, x)
            self._tflite.invoke()
            probs = self._tflite.get_tensor(self._out_idx)[0]
        else:
            probs = self._keras.predict(x, verbose=0)[0]

        return int(np.argmax(probs))

    def _extract_landmarks(self, lm_world) -> np.ndarray:
        """Extract exactly the features expected by the model config, converted to cm."""
        coords = []
        if self._config and "feature_names" in self._config:
            for feat in self._config["feature_names"]:
                parts = feat.split('_', 1)
                if len(parts) == 2:
                    coord, part = parts
                    idx = _MP_NAME_TO_IDX.get(part)
                    if idx is not None:
                        # Multiply by 100 to convert meters to centimeters (Kaggle dataset scale)
                        if coord == 'x': coords.append(lm_world[idx].x * 100.0)
                        elif coord == 'y': coords.append(lm_world[idx].y * 100.0)
                        elif coord == 'z': coords.append(lm_world[idx].z * 100.0)
                        elif coord in ('v', 'vis'): coords.append(lm_world[idx].visibility)
                        else: coords.append(0.0)
                    else:
                        coords.append(0.0)
                else:
                    coords.append(0.0)
        else:
            # Fallback if config is missing feature_names
            for i in range(33):
                coords.extend([lm_world[i].x * 100.0, lm_world[i].y * 100.0, lm_world[i].z * 100.0, lm_world[i].visibility])
                
        return np.array(coords, dtype=np.float32)

    def analyze_video(
        self,
        video_path: str,
        target_reps: int = 30,
    ) -> Dict[str, Any]:
        try:
            print(f"\n=== Sit-Up Analysis: {video_path} ===")

            # ── Layer 1: Video Loop Detection ─────────────────────────────
            print("[AntiCheat-SitUp] Checking for looped/edited video...")
            if _detect_video_loop(video_path):
                return self._error(
                    "Video manipulation detected: this video appears to be a looped "
                    "or edited duplicate. Please upload an original, unedited recording."
                )

            if not self._load_model():
                return self._error(
                    "Sit-up model not loaded. Please train and upload the model files."
                )

            if not _POSE_MODEL.exists():
                return self._error("Pose model file not found.")

            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return self._error("Could not open video file.")

            fps          = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            video_duration_sec = total_frames / fps
            print(f"    Video: {total_frames} frames @ {fps:.0f} FPS ({video_duration_sec:.1f}s)")

            if total_frames < 15:
                cap.release()
                return self._error("Video too short.")

            # ── Extract pose per frame ─────────────────────────────────────
            options = mp.tasks.vision.PoseLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(_POSE_MODEL)),
                running_mode=mp.tasks.vision.RunningMode.VIDEO,
                min_pose_detection_confidence=0.4,
                min_pose_presence_confidence=0.4,
                min_tracking_confidence=0.4,
            )

            frame_predictions: List[int] = []
            frame_idx = 0

            with mp.tasks.vision.PoseLandmarker.create_from_options(options) as lm_model:
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break

                    ts_ms = int(frame_idx * 1000 / fps)
                    frame_idx += 1

                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

                    try:
                        result = lm_model.detect_for_video(mp_img, ts_ms)
                    except Exception:
                        frame_predictions.append(-1)
                        continue

                    if not result or not result.pose_world_landmarks:
                        frame_predictions.append(-1)
                        continue

                    lm_flat = self._extract_landmarks(result.pose_world_landmarks[0])
                    pred    = self._predict(lm_flat)
                    frame_predictions.append(pred)

            cap.release()

            # ── Validate: enough pose frames ───────────────────────────────
            valid_preds = [p for p in frame_predictions if p != -1]
            print(f"    Valid frames: {len(valid_preds)}/{frame_idx}")

            if len(valid_preds) < 10:
                return self._error(
                    "Not enough pose detections. "
                    "Ensure full body is visible from the side."
                )

            # ── Validate: is it actually a sit-up video? ───────────────────
            up_frac   = valid_preds.count(1) / len(valid_preds)
            down_frac = valid_preds.count(0) / len(valid_preds)

            if up_frac < 0.05 or down_frac < 0.05:
                return self._error(
                    "This does not appear to be a sit-up video. "
                    "The video should show complete up and down positions."
                )

            # ── Count reps: smooth → detect transitions ────────────────────
            # Smooth predictions with a 5-frame majority window to remove noise
            smoothed = self._smooth_predictions(valid_preds, window=5)

            # ── Count reps (Layer 2: per-rep minimum time enforced inside) ───
            rep_count, rep_frames, fraud_flags = self._count_reps(smoothed, fps=fps)
            print(f"    Reps detected: {rep_count}")

            if rep_count == 0:
                return self._error(
                    "No complete sit-up reps detected. "
                    "Ensure you perform full reps (all the way up and all the way down)."
                )

            # ── Layer 3 & 4: Rep Rate Limiter + Hard Cap ──────────────────
            max_possible_reps = int(video_duration_sec * MAX_REPS_PER_SECOND)

            if rep_count > max_possible_reps:
                fraud_flags.append(
                    f"Rep count ({rep_count}) exceeds the physical maximum "
                    f"({max_possible_reps}) possible in {video_duration_sec:.0f}s. "
                    f"Possible video editing detected."
                )

            if fraud_flags:
                print(f"[AntiCheat-SitUp] \u26a0\ufe0f Fraud flags: {fraud_flags}")
                return self._error(
                    "Anti-cheat check failed: " + " | ".join(fraud_flags)
                )

            # ── Quality: check full range of motion ───────────────────────
            quality = self._assess_quality(smoothed, rep_frames)

            # ── Score ──────────────────────────────────────────────────────
            base_score   = _score_from_reps(rep_count)
            quality_mult = 0.7 + 0.3 * quality  # quality between 0.7x and 1.0x
            ai_score     = float(min(100.0, base_score * quality_mult))

            band, band_icon = _band_from_reps(rep_count)

            feedback = self._build_feedback(
                rep_count, ai_score, band, band_icon,
                quality, quality_mult, up_frac, down_frac
            )

            print(f"    Score: {ai_score:.1f} | Band: {band}")

            return {
                "success":        True,
                "ai_score":       round(ai_score, 1),
                "reps":           rep_count,
                "quality":        round(quality * 100, 1),
                "performance_band": band,
                "feedback":       feedback,
            }

        except Exception as e:
            traceback.print_exc()
            return self._error(f"Analysis error: {e}")

    # ── Helpers ────────────────────────────────────────────────────────────
    def _smooth_predictions(self, preds: List[int], window: int = 5) -> List[int]:
        """Majority-vote smoothing to remove single-frame noise."""
        smoothed = []
        half = window // 2
        for i in range(len(preds)):
            lo = max(0, i - half)
            hi = min(len(preds), i + half + 1)
            segment = preds[lo:hi]
            vote = 1 if segment.count(1) > segment.count(0) else 0
            smoothed.append(vote)
        return smoothed

    def _count_reps(self, smoothed: List[int], fps: float = 30.0):
        """
        Count complete reps: DOWN → UP → DOWN = 1 rep.

        Layer 2 — Per-Rep Minimum Time:
          Each rep must span at least MIN_SECONDS_PER_REP seconds worth of frames.
          Impossibly fast transitions (looped/sped-up video) are discarded.

        Returns (rep_count, list of rep end frame indices, fraud_flags list).
        """
        reps              = 0
        rep_frames        = []
        skipped_fast_reps = 0
        fraud_flags: List[str] = []
        phase             = "waiting"
        rep_start         = None

        min_frames_per_rep = int(MIN_SECONDS_PER_REP * fps)

        for i, pred in enumerate(smoothed):
            if phase == "waiting":
                if pred == 0:           # in DOWN position
                    phase = "in_down"
                    rep_start = i
            elif phase == "in_down":
                if pred == 1:           # moved to UP
                    phase = "in_up"
            elif phase == "in_up":
                if pred == 0:           # came back DOWN = completed rep
                    rep_duration = (i - rep_start) if rep_start is not None else min_frames_per_rep
                    if rep_duration >= min_frames_per_rep:
                        reps += 1
                        rep_frames.append(i)
                    else:
                        skipped_fast_reps += 1
                    phase = "in_down"
                    rep_start = i

        if skipped_fast_reps > 0:
            fraud_flags.append(
                f"{skipped_fast_reps} rep(s) completed in under {MIN_SECONDS_PER_REP}s "
                f"— physically impossible, possible video editing detected."
            )

        return reps, rep_frames, fraud_flags

    def _assess_quality(self, smoothed: List[int], rep_frames: List[int]) -> float:
        """
        Quality score 0–1 based on:
        - How long each UP phase was held (good = sustained up position)
        - Consistency of rep timing
        """
        if not rep_frames or len(rep_frames) < 2:
            return 0.8

        # Measure time in UP position per rep cycle
        up_ratios = []
        prev = 0
        for end in rep_frames:
            segment = smoothed[prev:end]
            if segment:
                up_ratios.append(segment.count(1) / len(segment))
            prev = end

        if not up_ratios:
            return 0.8

        avg_up_ratio = float(np.mean(up_ratios))
        # If spending 30–60% of time in UP position = good full range of motion
        # Too low = not fully sitting up; too high = not fully lying down
        ideal_ratio = 0.45
        ratio_score = 1.0 - min(1.0, abs(avg_up_ratio - ideal_ratio) / ideal_ratio)

        # Timing consistency
        if len(rep_frames) > 2:
            intervals   = [rep_frames[i+1] - rep_frames[i] for i in range(len(rep_frames)-1)]
            consistency = 1.0 - min(1.0, np.std(intervals) / (np.mean(intervals) + 1e-8))
        else:
            consistency = 1.0

        quality = 0.6 * ratio_score + 0.4 * consistency
        return float(np.clip(quality, 0.0, 1.0))

    def _build_feedback(self, reps, score, band, icon,
                        quality, quality_mult, up_frac, down_frac) -> str:
        quality_pct = quality * 100

        quality_line = ""
        if quality_pct >= 80:
            quality_line = f"\n{G['check']} Excellent form and full range of motion!"
        elif quality_pct >= 60:
            quality_line = f"\n{G['warn']} Good effort! Focus on fully lying down between reps."
        else:
            quality_line = f"\n{G['warn']} Work on full range of motion — go all the way up and all the way down."

        advice_map = {
            "Elite":         f"{G['fire']} Elite level! You are in peak physical condition.",
            "Excellent":     f"{G['medal']} Excellent! A few more reps will get you to Elite.",
            "Very Good":     f"{G['bolt']} Very Good! Build core strength with planks to improve.",
            "Good":          f"{G['chart']} Good! Add ab-specific training to boost your count.",
            "Average":       f"{G['muscle']} Keep going! Consistency will improve your strength.",
            "Below Average": f"{G['bullet']} Start slow and build up gradually. Daily practice helps.",
        }
        advice = advice_map.get(band, "Keep pushing!")

        return (
            f"{G['situp']} Sit-Up Analysis\n\n"
            f"{icon} Performance: {band}\n"
            f"{G['bullet']} AI Score: {score:.1f}%\n\n"
            f"--- Results ---\n"
            f"{G['bullet']} Reps Completed: {reps}\n"
            f"{G['bullet']} Form Quality: {quality_pct:.0f}%\n\n"
            f"{advice}"
            f"{quality_line}"
        )

    def _error(self, msg: str) -> Dict[str, Any]:
        print(f"  [SitUp] ERROR: {msg}")
        return {
            "success":  False,
            "error":    msg,
            "ai_score": 0,
            "feedback": f"{G['warn']} {msg}",
        }
