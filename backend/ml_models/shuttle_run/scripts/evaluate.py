# scripts/evaluate.py
"""
Evaluate shuttle run model:
- Training curves
- Confusion matrix for band classification
- Shuttle run count metrics
- Agility score examples
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path
import json, joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay, mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"
RAW_DIR = ROOT / "data" / "raw"
OUT_PLOT = MODELS_DIR / "evaluation_plots.png"

SENSOR_COLS = ["acc_x","acc_y","acc_z","gyro_x","gyro_y","gyro_z"]

def load_val_data(seq_len=300):
    X, y_band, y_count = [], [], []
    for f in sorted(RAW_DIR.glob("trial_*.csv")):
        df = pd.read_csv(f)
        arr = df[SENSOR_COLS].values.astype(np.float32)
        if arr.shape[0] < seq_len:
            pad = np.zeros((seq_len - arr.shape[0], arr.shape[1]), dtype=np.float32)
            arr = np.vstack([arr, pad])
        else:
            arr = arr[:seq_len]
        X.append(arr)
        y_band.append(int(df["performance_band"].map({"low":0,"medium":1,"high":2}).iloc[0]))
        # Approx shuttle count (same as train)
        acc_mag = np.linalg.norm(df[["acc_x","acc_y","acc_z"]].values, axis=1)
        peaks = np.where((acc_mag[1:-1] > acc_mag[:-2]) & (acc_mag[1:-1] > acc_mag[2:]))[0]
        y_count.append(len(peaks)//2)
    X = np.stack(X); y_band = np.array(y_band); y_count = np.array(y_count)
    return train_test_split(X, y_band, y_count, test_size=0.18, stratify=y_band, random_state=42)

def main():
    meta_path = MODELS_DIR / "shuttle_run_model_metadata.json"
    if not meta_path.exists():
        print("No metadata found. Run training first.")
        return
    with open(meta_path) as fh:
        meta = json.load(fh)
    history = meta.get("history", {})

    # --- training curves ---
    fig, axes = plt.subplots(1,2, figsize=(12,4))
    if "loss" in history:
        axes[0].plot(history["loss"], label="train_loss")
        if "val_loss" in history:
            axes[0].plot(history["val_loss"], label="val_loss")
        axes[0].legend(); axes[0].set_title("Loss")
    if "band_output_accuracy" in history:
        axes[1].plot(history["band_output_accuracy"], label="train_band_acc")
    if "val_band_output_accuracy" in history:
        axes[1].plot(history["val_band_output_accuracy"], label="val_band_acc")
    axes[1].legend(); axes[1].set_title("Band Accuracy")
    plt.tight_layout()
    plt.savefig(OUT_PLOT)
    print("Saved training curves to", OUT_PLOT)

    # --- confusion matrix + count metrics ---
    model_path = MODELS_DIR / "shuttle_run_model_best.h5"
    if not model_path.exists():
        model_path = MODELS_DIR / "shuttle_run_model.h5"
    if model_path.exists():
        model = tf.keras.models.load_model(str(model_path))
        X_train, X_val, yb_train, yb_val, yc_train, yc_val = load_val_data(seq_len=meta.get("input_shape",[300,6])[0])

        # scaling (if used)
        scaler_p = MODELS_DIR / "shuttle_run_model_scaler.pkl"
        if scaler_p.exists():
            scaler = joblib.load(scaler_p)
            ns, t, ch = X_val.shape
            X_val = scaler.transform(X_val.reshape(-1, ch)).reshape(ns, t, ch)

        # predictions
        band_pred, count_pred = model.predict(X_val, batch_size=32)
        y_pred_band = band_pred.argmax(axis=1)
        y_pred_count = np.clip(np.round(count_pred.flatten()), 0, None)

        # confusion matrix
        cm = confusion_matrix(yb_val, y_pred_band, labels=list(meta.get("class_map", {}).keys()))
        disp = ConfusionMatrixDisplay(cm, display_labels=list(meta.get("class_map", {}).values()))
        fig2, ax2 = plt.subplots(figsize=(6,6))
        disp.plot(ax=ax2, cmap=plt.cm.Blues)
        fig2.tight_layout()
        fig2.savefig(MODELS_DIR / "confusion_matrix.png")
        print("Saved confusion matrix to", MODELS_DIR / "confusion_matrix.png")

        # regression metrics
        mae = mean_absolute_error(yc_val, y_pred_count)
        rmse = mean_squared_error(yc_val, y_pred_count, squared=False)
        print(f"Shuttle count MAE: {mae:.2f}, RMSE: {rmse:.2f}")

        # agility scores
        agility_true = yc_val / X_val.shape[1]
        agility_pred = y_pred_count / X_val.shape[1]
        print("Sample agility scores (true vs pred):")
        for i in range(min(5, len(agility_true))):
            print(f"  {agility_true[i]:.3f} vs {agility_pred[i]:.3f}")
    else:
        print("No trained model found for evaluation.")

if __name__ == "__main__":
    main()
