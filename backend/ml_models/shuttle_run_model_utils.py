import numpy as np
import tensorflow as tf
import joblib, json
import cv2
from pathlib import Path

SEQ_LEN = 300
SENSORS = 6
MODELS_DIR = Path(__file__).resolve().parent / "shuttle_run"

model = tf.keras.models.load_model(str(MODELS_DIR / "shuttle_run_model_best.h5"))
scaler = joblib.load(MODELS_DIR / "shuttle_run_model_scaler.pkl")
with open(MODELS_DIR / "shuttle_run_model_metadata.json") as f:
    METADATA = json.load(f)

CLASS_MAP = {int(k): v for k, v in METADATA["class_map"].items()}

def preprocess(arr: np.ndarray):
    if arr.shape[0] < SEQ_LEN:
        pad = np.zeros((SEQ_LEN - arr.shape[0], arr.shape[1]))
        arr = np.vstack([arr, pad])
    else:
        arr = arr[:SEQ_LEN]
    arr = scaler.transform(arr)
    return arr[np.newaxis, ...].astype(np.float32)

def extract_features(video_path):
    cap = cv2.VideoCapture(video_path)
    frames = []
    while True:
        ret, frame = cap.read()
        if not ret: break
        frame = cv2.resize(frame, (64,64))
        mean_rgb = frame.mean(axis=(0,1))
        std_rgb = frame.std(axis=(0,1))
        frames.append(np.concatenate([mean_rgb, std_rgb]))
    cap.release()
    return np.array(frames, dtype=np.float32)

def analyze(arr, pred_class, probs):
    speed = float(np.clip(arr[:,0].mean() * 12, 0,100))
    endurance = float(np.clip(arr[:,1:].mean(), 0,100))
    total = (speed+endurance)/2
    feedback = "Good speed but improve endurance" if total<60 else "Excellent agility"
    return {"ai_score": round(total,1), "feedback": feedback}

def predict_from_video(video_path):
    arr = extract_features(video_path)
    if arr.shape[0] == 0:
        return {"ai_score": 0, "feedback": "No frames extracted"}
    x = preprocess(arr)
    probs = model.predict(x)[0].tolist()
    pred_idx = int(np.argmax(probs))
    pred_class = CLASS_MAP.get(pred_idx, str(pred_idx))
    analysis = analyze(arr, pred_class, probs)
    return analysis

# backend/ml_models/shuttle_run_model_utils.py

def predict_from_video(video_path: str):
    print(f"🚀 Starting Shuttle Run Analysis for {video_path}")
    arr = extract_features(video_path)

    if arr.shape[0] == 0:
        print(f"❌ No frames extracted for {video_path}")
        return {"ai_score": 0, "feedback": "No frames extracted"}

    try:
        print(f"✅ Extracted {arr.shape[0]} frames with {arr.shape[1]} features each")
        x = preprocess(arr)
        print(f"✅ Preprocessed array shape: {x.shape}")

        probs = model.predict(x, verbose=0)[0].tolist()
        pred_idx = int(np.argmax(probs))
        pred_class = CLASS_MAP.get(pred_idx, str(pred_idx))

        print(f"🎯 Prediction: {pred_class} (idx={pred_idx})")
        analysis = analyze(arr, pred_class, probs)
        print(f"✅ Analysis complete: {analysis}")
        return analysis

    except Exception as e:
        import traceback
        print("❌ Shuttle model error:", traceback.format_exc())
        return {"ai_score": 0, "feedback": f"Model error: {str(e)}"}
