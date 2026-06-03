# backend/ml_models/shuttle_run/assessment/agility_analyzer.py
"""
Agility analysis from video using MediaPipe Tasks API.
Compatible with Python 3.13+ where mp.solutions is unavailable.
"""
from __future__ import annotations

import math
import cv2
import numpy as np
import mediapipe as mp
from pathlib import Path
from typing import Dict, Any, List

# Path to the pose landmarker task model
_TASK_MODEL = Path(__file__).resolve().parent.parent.parent / "pose_landmarker_lite.task"


def _create_landmarker():
    """Create a PoseLandmarker using the Tasks API."""
    BaseOptions = mp.tasks.BaseOptions
    PoseLandmarker = mp.tasks.vision.PoseLandmarker
    PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode

    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(_TASK_MODEL)),
        running_mode=VisionRunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return PoseLandmarker.create_from_options(options)


def _calc_angle(a, b, c) -> float:
    """Calculate angle at point b given 3 landmarks."""
    ba = np.array([a.x - b.x, a.y - b.y])
    bc = np.array([c.x - b.x, c.y - b.y])
    cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    return float(np.degrees(np.arccos(np.clip(cos_angle, -1, 1))))


def analyze_agility(video_path: str, calibration: Dict[str, float]) -> Dict[str, Any]:
    """
    Analyze agility from a shuttle run video using MediaPipe Tasks API.
    
    Returns a dictionary with timing, speed, body mechanics, and turn data
    that can be mapped to the 50 model features.
    """
    distance_m = calibration.get("distance_m", 10.0)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"success": False, "error": "Cannot open video file"}

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps == 0:
        fps = 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Create pose landmarker
    try:
        landmarker = _create_landmarker()
    except Exception as e:
        cap.release()
        return {"success": False, "error": f"Failed to create pose landmarker: {e}"}

    positions_x = []
    positions_y = []
    timestamps = []
    knee_angles = []
    hip_angles = []
    arm_swings = []
    body_leans = []
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        timestamp_ms = int(frame_count * 1000.0 / fps)

        try:
            result = landmarker.detect_for_video(mp_image, timestamp_ms)
        except Exception:
            frame_count += 1
            continue

        if result.pose_landmarks and len(result.pose_landmarks) > 0:
            lm = result.pose_landmarks[0]

            # Hip center for tracking horizontal position
            left_hip = lm[23]
            right_hip = lm[24]
            center_x = (left_hip.x + right_hip.x) / 2.0
            center_y = (left_hip.y + right_hip.y) / 2.0
            positions_x.append(center_x)
            positions_y.append(center_y)
            timestamps.append(frame_count / fps)

            # Knee angle (left: hip-knee-ankle)
            try:
                knee_angle = _calc_angle(lm[23], lm[25], lm[27])
                knee_angles.append(knee_angle)
            except Exception:
                pass

            # Hip angle
            try:
                hip_angle = _calc_angle(lm[11], lm[23], lm[25])
                hip_angles.append(hip_angle)
            except Exception:
                pass

            # Arm swing amplitude (shoulder to wrist distance)
            try:
                left_swing = abs(lm[15].y - lm[11].y)
                right_swing = abs(lm[16].y - lm[12].y)
                arm_swings.append((left_swing + right_swing) / 2.0)
            except Exception:
                pass

            # Body lean (torso angle from vertical)
            try:
                shoulder_mid_x = (lm[11].x + lm[12].x) / 2.0
                shoulder_mid_y = (lm[11].y + lm[12].y) / 2.0
                hip_mid_x = (lm[23].x + lm[24].x) / 2.0
                hip_mid_y = (lm[23].y + lm[24].y) / 2.0
                dx = shoulder_mid_x - hip_mid_x
                dy = shoulder_mid_y - hip_mid_y
                lean = abs(math.degrees(math.atan2(dx, -dy + 1e-8)))
                body_leans.append(lean)
            except Exception:
                pass

        frame_count += 1

    cap.release()
    landmarker.close()

    if len(positions_x) < fps:
        return {"success": False, "error": "Not enough valid motion detected. Ensure the full body is visible."}

    # ---- Compute motion metrics ----
    positions_x = np.array(positions_x)
    ts = np.array(timestamps)

    # Check horizontal travel range — a shuttle run must cover significant lateral ground.
    # A squat or stationary video will have near-zero horizontal range.
    x_range = float(np.max(positions_x) - np.min(positions_x))
    if x_range < 0.15:  # less than 15% of frame width = no real lateral movement
        return {
            "success": False,
            "error": (
                "Insufficient lateral movement detected (x_range={:.3f}). "
                "This does not appear to be a shuttle run video.".format(x_range)
            )
        }

    # Velocity
    velocities_x = np.diff(positions_x) / np.diff(ts)

    # Detect turns (velocity sign changes with minimum gap to filter noise)
    sign_changes = np.where(np.diff(np.sign(velocities_x)))[0] + 1
    min_gap = int(fps * 0.8)  # at least 0.8s between turns (avoids counting noise)
    filtered_turns = [sign_changes[0]] if len(sign_changes) > 0 else []
    for t in sign_changes[1:]:
        if t - filtered_turns[-1] > min_gap:
            filtered_turns.append(t)
    turns = np.array(filtered_turns) if filtered_turns else np.array([])

    if len(turns) < 1:
        return {
            "success": False,
            "error": "No direction changes detected. This does not look like a shuttle run."
        }

    # Splits (time between direction changes)
    turn_times = [ts[i] for i in turns if i < len(ts)]
    all_points = [ts[0]] + turn_times + [ts[-1]]
    splits = np.diff(all_points).tolist()

    total_time = ts[-1] - ts[0]
    num_turns = len(turns)

    # ── Advanced Speed Calculation ──────────────────────────────────────────
    # The landmark x-coordinates are normalized (0.0–1.0) relative to frame width.
    # We know the athlete runs `distance_m` between each direction change.
    # Strategy:
    #   1. For each segment between turns, measure the total pixel displacement Δx
    #   2. Use the FIRST segment (cleanest run) to calibrate: pixels_per_meter = Δx / distance_m
    #   3. Apply that calibration to compute real-world speed for EVERY segment
    #   4. Use the median across segments (robust to outlier turns or bad frames)

    turn_indices = [0] + list(turns) + [len(positions_x) - 1]
    segment_speeds = []

    # Calibrate from the longest (typically first clean) segment
    seg_pixel_widths = []
    for i in range(len(turn_indices) - 1):
        start_i = turn_indices[i]
        end_i = turn_indices[i + 1]
        if end_i > start_i:
            delta_x = abs(positions_x[end_i] - positions_x[start_i])
            seg_pixel_widths.append(delta_x)

    # Pixel-per-meter ratio: widest segment corresponds to one shuttle leg (distance_m)
    max_pixel_width = max(seg_pixel_widths) if seg_pixel_widths else 0.3
    pixels_per_meter = max_pixel_width / distance_m  # normalized pixels / meter

    for i in range(len(turn_indices) - 1):
        start_i = turn_indices[i]
        end_i = turn_indices[i + 1]
        if end_i <= start_i:
            continue
        seg_time = ts[end_i] - ts[start_i]
        if seg_time < 0.2:
            continue  # skip impossibly short segments
        # Real-world distance for this segment
        delta_x_pixels = abs(positions_x[end_i] - positions_x[start_i])
        seg_distance_m = delta_x_pixels / pixels_per_meter if pixels_per_meter > 0 else distance_m
        seg_speed = seg_distance_m / seg_time
        # Sanity check: human sprinting range 2–12 m/s
        if 1.0 <= seg_speed <= 12.0:
            segment_speeds.append(seg_speed)

    if segment_speeds:
        # Median is more robust than mean against one bad segment
        avg_speed = float(np.median(segment_speeds))
    else:
        # Fallback: simple distance × turns / time
        avg_speed = (distance_m * max(1, num_turns)) / max(total_time, 0.1)
        avg_speed = min(max(avg_speed, 1.0), 10.0)

    # Peak acceleration from velocity_x changes between frames
    if len(velocities_x) > 1:
        accels = np.abs(np.diff(velocities_x) / (np.diff(ts[:-1]) + 1e-8))
        peak_accel = float(np.percentile(accels, 95))  # 95th percentile avoids noise spikes
    else:
        peak_accel = 0.0

    # ── Stride estimation (from hip vertical oscillation via FFT) ──────────
    if len(positions_y) > 10:
        y_arr = np.array(positions_y)
        y_fft = np.fft.rfft(y_arr - np.mean(y_arr))
        freqs = np.fft.rfftfreq(len(y_arr), d=1.0/fps)
        # Find dominant frequency (stride frequency)
        mag = np.abs(y_fft[1:])
        if len(mag) > 0:
            dom_idx = np.argmax(mag) + 1
            stride_freq = float(freqs[dom_idx])
            stride_length = (avg_speed / max(stride_freq, 0.1)) * 100  # cm
        else:
            stride_freq = 3.5
            stride_length = 150.0
    else:
        stride_freq = 3.5
        stride_length = 150.0

    # Turn times
    turn_durations = []
    for i, t_idx in enumerate(turns):
        start = max(0, t_idx - int(fps * 0.3))
        end = min(len(velocities_x) - 1, t_idx + int(fps * 0.3))
        turn_durations.append((end - start) / fps * 1000)  # ms
    avg_turn_time = float(np.mean(turn_durations)) if turn_durations else 500.0

    # Fatigue index
    if len(splits) >= 2:
        first_half = np.mean(splits[:len(splits)//2])
        second_half = np.mean(splits[len(splits)//2:])
        fatigue_index = (second_half - first_half) / (first_half + 1e-8)
    else:
        fatigue_index = 0.0

    # Body mechanics averages
    avg_knee_angle = float(np.mean(knee_angles)) if knee_angles else 75.0
    avg_arm_swing = float(np.mean(arm_swings)) * 360 if arm_swings else 90.0  # scale to degrees
    avg_body_lean = float(np.mean(body_leans)) if body_leans else 15.0

    return {
        "success": True,
        "total_time": total_time,
        "num_turns": num_turns,
        "avg_speed": avg_speed,           # single calibrated speed in m/s
        "segment_speeds": segment_speeds, # per-leg speeds for transparency
        "pixels_per_meter": round(pixels_per_meter, 5),
        "peak_accel": peak_accel,
        "splits": splits[:4],             # first 4 split times in seconds
        "fps": fps,
        "stride_length": stride_length,
        "stride_freq": stride_freq,
        "avg_turn_time": avg_turn_time,
        "fatigue_index": fatigue_index,
        "avg_knee_angle": avg_knee_angle,
        "avg_arm_swing": avg_arm_swing,
        "avg_body_lean": avg_body_lean,
        "frames_processed": frame_count,
        "poses_detected": len(positions_x),
    }
