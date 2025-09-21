import os
from pathlib import Path
from datetime import datetime
import traceback
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp

# -------------------------------
# App Setup
# -------------------------------
app = FastAPI(title="Shuttle Run API", version="1.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(_file_).resolve().parent
VIDEOS_DIR = ROOT / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

# -------------------------------
# Import your functions
# -------------------------------
from assessment.agility_analyzer import analyze_agility, compute_score

# -------------------------------
# Helper: Human shuttle-run detection
# -------------------------------
def is_valid_shuttle_run(video_path, min_turns=2, distance_threshold=2.0):
    mp_pose = mp.solutions.pose
    cap = cv2.VideoCapture(video_path)
    turn_count = 0
    prev_x = None

    with mp_pose.Pose(static_image_mode=False) as pose:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if results.pose_landmarks:
                left_hip = results.pose_landmarks.landmark[mp.solutions.pose.PoseLandmark.LEFT_HIP]
                right_hip = results.pose_landmarks.landmark[mp.solutions.pose.PoseLandmark.RIGHT_HIP]
                curr_x = (left_hip.x + right_hip.x) / 2.0
                if prev_x is not None and abs(curr_x - prev_x) > distance_threshold * 0.01:
                    turn_count += 1
                prev_x = curr_x
    cap.release()
    return turn_count >= min_turns

# -------------------------------
# Extract features + score using functions
# -------------------------------
def analyze_video(video_path):
    features_data = analyze_agility(video_path, calibration={"distance_m": 10.0})

    splits = features_data.get("splits", [])
    speeds = features_data.get("speeds", [])
    accelerations = features_data.get("accelerations", [])
    total_time = features_data.get("total_time", 1.0)
    num_turns = features_data.get("num_turns", len(splits))
    dt = [1.0/30.0]*num_turns
    x_m = [0]*num_turns
    px_per_m = 100.0

    # Convert to numpy arrays for scoring
    times_arr = np.cumsum(splits)
    peaks = np.arange(len(splits))
    v = np.array(speeds)
    a = np.array(accelerations)
    dt_arr = np.array(dt)
    x_m_arr = np.array(x_m)

    score_result = compute_score(times_arr, peaks, v, a, dt_arr, 30, x_m_arr, px_per_m)

    # Ensure features length is 20 for ML compatibility
    features = np.concatenate([
        [score_result.get("mean_speed_m_s", 0.0), total_time, num_turns],
        splits,
        np.zeros(20 - 3 - len(splits))
    ]).tolist()

    return features, score_result

# -------------------------------
# Endpoint
# -------------------------------
@app.post("/api/ml/predict_video")
async def predict_video(
    file: UploadFile = File(...),
    athlete_name: str = Form(...),
    test_type: str = Form(...),
):
    try:
        # Save video
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_name = f"{timestamp}_{file.filename}"
        video_path = VIDEOS_DIR / safe_name
        with open(video_path, "wb") as f:
            f.write(await file.read())

        # Validate human shuttle-run
        if not is_valid_shuttle_run(str(video_path)):
            return JSONResponse(
                {"error": "No valid shuttle-run activity detected in video"},
                status_code=400
            )

        # Analyze video and compute score
        features, score_data = analyze_video(str(video_path))

        return {
            "athlete_name": athlete_name,
            "test_type": test_type,
            "features": features,
            "score_data": score_data,
            "video_path": str(video_path)
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))