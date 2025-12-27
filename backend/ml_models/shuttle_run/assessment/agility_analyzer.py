# backend/ml_models/shuttle_run/assessment/agility_analyzer.py

import cv2
import numpy as np
import mediapipe as mp
from typing import Dict, Any

def analyze_agility(video_path: str, calibration: Dict[str, float]) -> Dict[str, Any]:
    """
    Analyzes agility from a video by tracking movement and detecting turns.
    
    Args:
        video_path: Path to the video file.
        calibration: Dictionary containing 'distance_m' for the shuttle run.

    Returns:
        A dictionary with agility metrics.
    """
    distance_m = calibration.get("distance_m", 10.0)
    
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(static_image_mode=False, model_complexity=1, min_detection_confidence=0.5)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"success": False, "error": "Cannot open video file"}

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps == 0:
        fps = 30  # Default FPS

    positions_x = []
    timestamps = []
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
            right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
            
            # Use hip average as center of mass for horizontal position
            center_x = (left_hip.x + right_hip.x) / 2.0
            positions_x.append(center_x)
            timestamps.append(frame_count / fps)
        
        frame_count += 1

    cap.release()
    pose.close()

    if len(positions_x) < fps:  # Require at least 1 second of tracking
        return {"success": False, "error": "Not enough valid motion detected"}

    # Detect turns by finding peaks and troughs in horizontal movement
    positions_x = np.array(positions_x)
    velocities_x = np.diff(positions_x) / np.diff(timestamps)
    
    # A turn is where velocity changes sign
    turns = np.where(np.diff(np.sign(velocities_x)))[0] + 1
    
    if len(turns) < 1:
        return {"success": False, "error": "No turns were detected"}

    turn_times = [timestamps[i] for i in turns]
    splits = np.diff([timestamps[0]] + turn_times + [timestamps[-1]]).tolist()
    
    total_time = timestamps[-1] - timestamps[0]
    num_turns = len(turns)
    
    # Calculate speeds and accelerations
    avg_speed = (distance_m * num_turns) / max(total_time, 0.1)
    speeds = [distance_m / s for s in splits if s > 0]
    
    accelerations = np.abs(np.diff(velocities_x) / np.diff(timestamps[:-1]))
    peak_accel = np.max(accelerations) if len(accelerations) > 0 else 0

    return {
        "success": True,
        "total_time": total_time,
        "num_turns": num_turns,
        "avg_speed": avg_speed,
        "peak_accel": float(peak_accel),
        "splits": splits,
        "speeds": speeds,
        "fps": fps
    }
