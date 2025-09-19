# scripts/preprocess.py
"""
Preprocessing:
- Reads all CSVs in data/raw/
- Optionally performs windowing (here: entire trial)
- Computes per-trial features (stats) and saves features.csv for quick checks
- Saves scaler (StandardScaler) to models/
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import joblib

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROC_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"
PROC_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

def extract_statistics(df):
    sensor_cols = [c for c in df.columns if c.startswith("sensor_")]
    arr = df[sensor_cols].values
    stats = {}
    for i, c in enumerate(sensor_cols):
        col = arr[:, i]
        stats[f"{c}_mean"] = float(col.mean())
        stats[f"{c}_std"] = float(col.std())
        stats[f"{c}_max"] = float(col.max())
        stats[f"{c}_min"] = float(col.min())
        stats[f"{c}_ptp"] = float(col.ptp())
        stats[f"{c}_energy"] = float((col**2).sum())
    stats["mag_mean"] = float(np.linalg.norm(arr, axis=1).mean())
    stats["length"] = int(arr.shape[0])
    return stats

def main():
    rows = []
    seqs = []
    labels = []
    sensor_cols = None
    for f in sorted(RAW_DIR.glob("trial_*.csv")):
        df = pd.read_csv(f)
        if sensor_cols is None:
            sensor_cols = [c for c in df.columns if c.startswith("sensor_")]
        rows.append({"filename": f.name, "label": int(df["label"].iloc[0]), **extract_statistics(df)})
        # store raw sequence for scaler
        seqs.append(df[sensor_cols].values.astype(np.float32))
        labels.append(int(df["label"].iloc[0]))
    feats_df = pd.DataFrame(rows)
    feats_df.to_csv(PROC_DIR / "features.csv", index=False)
    # build scaler from concatenated timesteps (per-channel)
    concat = np.vstack(seqs)
    scaler = StandardScaler()
    scaler.fit(concat)
    joblib.dump(scaler, MODELS_DIR / "shuttle_run_model_scaler.pkl")
    # save stats summary
    stats = feats_df.describe().to_dict()
    with open(PROC_DIR / "feature_statistics.json", "w") as fh:
        json.dump(stats, fh, indent=2)
    # save a small sample numpy pack for representative dataset
    np.savez(COMPR := PROC_DIR / "repr_dataset.npz", *seqs[:100])
    print("Preprocessing done. Saved features.csv, scaler, and repr_dataset.npz")

if __name__ == "__main__":
    main()
