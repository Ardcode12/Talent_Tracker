import cv2
import numpy as np
import math

def analyze_agility(video_path: str, calibration: dict):
    """
    Analyze an agility/shuttle run video and return features.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {
            "splits": [],
            "total_time": 0.0,
            "speeds": [],
            "accelerations": [],
        }

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    total_time = frame_count / fps

    # Dummy feature extraction: replace with real CV logic
    distance_m = calibration.get("distance_m", 10.0)
    num_turns = 4
    avg_speed = (distance_m * num_turns) / total_time if total_time > 0 else 0.0
    splits = [total_time / num_turns] * num_turns
    accelerations = [0.5] * num_turns  # placeholder
    speeds = [avg_speed] * num_turns

    return {
        "splits": splits,
        "total_time": total_time,
        "speeds": speeds,
        "accelerations": accelerations,
        "num_turns": num_turns,
        "avg_speed": avg_speed,
    }


def compute_score(times_arr, peaks, v, a, dt, fps, x_m, px_per_m):
    """
    Compute shuttle run score based on time splits, speed, and acceleration.
    Returns 0-100 score and metadata.
    """
    # =============================================================
    turn_times = times_arr[peaks] if len(peaks) > 0 else np.array([0.0])
    splits = list(np.diff(turn_times))[:8] if len(turn_times) >= 2 else [total_time := times_arr[-1]] * 4
    total_time = np.nansum(splits)

    mean_speed = np.nanmean(np.abs(v)) if len(v) > 0 else 0.0
    peak_accel = np.nanmax(np.abs(a)) if len(a) > 0 else 0.0
    avg_split = np.nanmean(splits) if len(splits) > 0 else float('nan')

    # Compose final score (lower time -> higher score)
    expected_best = 2.5 * 4
    expected_worst = 8.0 * 4
    t_norm = (total_time - expected_best) / (expected_worst - expected_best)
    t_norm = np.clip(t_norm, 0, 1)
    accel_bonus = np.tanh(peak_accel / 5.0)
    turn_factor = 1.0 - np.clip((avg_split - 2.0) / 6.0, 0, 1) if not math.isnan(avg_split) else 0.0

    score = (1 - t_norm) * 70 + accel_bonus * 20 + turn_factor * 10
    score = float(np.clip(score, 0, 100))

    result = {
        'present': True,
        'splits': splits,
        'total_time': float(total_time),
        'mean_speed_m_s': float(mean_speed),
        'peak_accel_m_s2': float(peak_accel),
        'score_0_100': score,
        'meta': {
            'fps': float(round(1.0 / np.mean(dt) if len(dt) else fps, 2)),
            'n_position_samples': int(len(x_m)),
            'calibration_px_per_m': float(px_per_m),
        },
    }

    return result
