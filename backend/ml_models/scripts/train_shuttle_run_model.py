import os
import json
from pathlib import Path
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import StandardScaler
import joblib

# === Paths ===
ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

# === Config ===
SEQ_LEN = 300
SENSORS = 6
EXPECTED_SENSOR_COLS = ["acc_x", "acc_y", "acc_z", "gyro_x", "gyro_y", "gyro_z"]

# === Load Dataset ===
def load_training_data(dataset_path: str):
    """
    Load dataset from CSV.
    Each CSV must have accelerometer + gyroscope columns.
    """
    df = pd.read_csv(dataset_path)

    missing = [c for c in EXPECTED_SENSOR_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    X = df[EXPECTED_SENSOR_COLS].values.astype(np.float32)
    y = df["label"].values  # Label column required
    return X, y

# === Preprocessing ===
def preprocess_data(X):
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    joblib.dump(scaler, MODELS_DIR / "shuttle_run_model_scaler.pkl")
    return X_scaled, scaler

# === Build Model ===
def build_model(input_shape, num_classes):
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=input_shape),
        tf.keras.layers.LSTM(64, return_sequences=True),
        tf.keras.layers.LSTM(32),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(num_classes, activation="softmax")
    ])
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model

# === Train ===
def train(dataset_path):
    print("[INFO] Loading dataset...")
    X, y = load_training_data(dataset_path)

    print("[INFO] Preprocessing data...")
    X_scaled, scaler = preprocess_data(X)

    # Reshape for LSTM [samples, timesteps, features]
    num_samples = len(X_scaled) // SEQ_LEN
    X_reshaped = X_scaled[:num_samples * SEQ_LEN].reshape(num_samples, SEQ_LEN, SENSORS)
    y_reshaped = y[:num_samples]

    print("[INFO] Building model...")
    model = build_model((SEQ_LEN, SENSORS), num_classes=len(np.unique(y)))

    print("[INFO] Training model...")
    model.fit(X_reshaped, y_reshaped, epochs=10, batch_size=32, validation_split=0.2)

    print("[INFO] Saving model...")
    model.save(MODELS_DIR / "shuttle_run_model_best.h5")

    # Save metadata
    metadata = {
        "input_shape": [SEQ_LEN, SENSORS],
        "class_map": {int(i): str(label) for i, label in enumerate(np.unique(y))}
    }
    with open(MODELS_DIR / "shuttle_run_model_metadata.json", "w") as f:
        json.dump(metadata, f)

    print("[INFO] Training complete! Model and scaler saved.")

if __name__ == "__main__":
    dataset_path = "dataset/shuttle_run_data.csv"  # <-- Pass dynamically or from CLI
    train(dataset_path)
