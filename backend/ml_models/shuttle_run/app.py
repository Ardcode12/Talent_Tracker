import os
import traceback
from datetime import datetime
from pathlib import Path

import numpy as np
import joblib
import tensorflow as tf
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from assessment.agility_analyzer import analyze_agility, compute_score

# -------------------------------
# App Setup
# -------------------------------
app = FastAPI(title="Shuttle Run / Agility API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parent
VIDEOS_DIR = ROOT / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

# -------------------------------
# ML Model Setup
# -------------------------------
MODELS_DIR = ROOT / "models"
MODEL_PATH = MODELS_DIR / "shuttle_run_model.keras"
SCALER_PATH = MODELS_DIR / "shuttle_run_model_scaler.pkl"
ENCODER_PATH = MODELS_DIR / "shuttle_run_label_encoder.pkl"

model, scaler, label_encoder = None, None, None

try:
    if MODEL_PATH.exists():
        model = tf.keras.models.load_model(MODEL_PATH)
    if SCALER_PATH.exists():
        scaler = joblib.load(SCALER_PATH)
    if ENCODER_PATH.exists():
        label_encoder = joblib.load(ENCODER_PATH)
except Exception as e:
    print(f"❌ Failed to load model/scaler/encoder: {e}")

# -------------------------------
# Endpoints
# -------------------------------
@app.get("/")
def root():
    return {"status": "ok", "message": "Agility API running"}

@app.post("/api/ml/predict_video")
async def predict_video(
    file: UploadFile = File(...),
    athlete_name: str = Form(...),
    test_type: str = Form(...)
):
    if model is None or scaler is None or label_encoder is None:
        raise HTTPException(status_code=503, detail="Model/scaler/encoder not loaded.")

    try:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_name = f"{timestamp}_{file.filename}"
        video_path = VIDEOS_DIR / safe_name

        with open(video_path, "wb") as f:
            f.write(await file.read())

        # Extract features
        result = analyze_agility(str(video_path), calibration={"distance_m": 10.0})
        features = [
            result.get("avg_speed", 0.0),
            result.get("total_time", 0.0),
            result.get("num_turns", 0.0),
            *result.get("splits", []),
            *result.get("speeds", []),
            *result.get("accelerations", []),
        ]

        # If some devices have missing features, pad zeros to match scaler
        if scaler is not None:
            expected_features = scaler.mean_.shape[0] if hasattr(scaler, "mean_") else len(features)
            if len(features) < expected_features:
                features = features + [0.0] * (expected_features - len(features))
            features = np.array(features).reshape(1, -1)
            features_scaled = scaler.transform(features)
            preds = model.predict(features_scaled)
            pred_idx = int(np.argmax(preds, axis=1)[0])
            confidence = float(np.max(preds))
            pred_class = label_encoder.inverse_transform([pred_idx])[0]
        else:
            pred_class = "unknown"
            confidence = 0.0

        # Compute score
        times_arr = np.linspace(0, result["total_time"], len(result["splits"]))
        peaks = np.arange(len(result["splits"]))
        score_data = compute_score(
            times_arr,
            peaks,
            v=np.array(result["speeds"]),
            a=np.array(result["accelerations"]),
            dt=np.array([result["total_time"]/len(result["splits"])]*len(result["splits"])),
            fps=30,
            x_m=np.array(result["speeds"]),
            px_per_m=100
        )

        return {
            "athlete_name": athlete_name,
            "test_type": test_type,
            "predicted_class": pred_class,
            "confidence": confidence,
            "features": features.tolist(),
            "score_data": {
                "score": score_data["score_0_100"],
                "feedback": "Good performance!" if score_data["score_0_100"] > 70 else "Needs improvement.",
            },
            "video_path": str(video_path)
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
