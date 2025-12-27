"""
Standalone FastAPI micro-service for shuttle-run analysis.
"""
from pathlib import Path
from datetime import datetime

import cv2
import mediapipe as mp
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .shuttle_run_analyzer import ShuttleRunAnalyzer

app = FastAPI(title="Shuttle-Run API", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parent
VIDEO_DIR = ROOT / "videos"
VIDEO_DIR.mkdir(parents=True, exist_ok=True)

analyzer = ShuttleRunAnalyzer()


def _has_turns(path: str, min_turns: int = 2, delta: float = 0.02) -> bool:
    mp_pose = mp.solutions.pose
    cap = cv2.VideoCapture(path)
    turns, prev_x = 0, None
    with mp_pose.Pose(static_image_mode=False) as pose:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            res = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if res.pose_landmarks:
                lms = res.pose_landmarks.landmark
                x = (lms[mp_pose.PoseLandmark.LEFT_HIP].x + lms[mp_pose.PoseLandmark.RIGHT_HIP].x) / 2
                if prev_x is not None and abs(x - prev_x) > delta:
                    turns += 1
                prev_x = x
    cap.release()
    return turns >= min_turns


@app.post("/predict_video")
async def predict_video(
    file: UploadFile = File(...),
    athlete_name: str = Form(...),
    test_type: str = Form("shuttle_run"),
):
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    fname = VIDEO_DIR / f"{ts}_{file.filename}"
    fname.write_bytes(await file.read())

    if not _has_turns(str(fname)):
        return JSONResponse({"error": "No shuttle-run movement detected."}, status_code=400)

    result = analyzer.analyze_video(str(fname))
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Analysis failed"))

    return {
        "athlete_name": athlete_name,
        "test_type": test_type,
        **result,
        "video_path": f"/videos/{fname.name}",
    }
