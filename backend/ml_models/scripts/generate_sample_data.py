# scripts/generate_sample_data.py
"""
Synthetic sensor CSV generator.
Creates multiple trial_XXXX.csv files into ../data/raw/
Each CSV has columns: sensor_0 .. sensor_{SENSORS-1}, timestamp, label
"""
import os
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)
LABELS_CSV = ROOT / "data" / "labels.csv"

np.random.seed(1234)

def make_trial(idx, seq_len=300, sensors=6, label=0, drift=0.0):
    t = np.arange(seq_len) / 50.0  # 50 Hz
    df = {}
    for s in range(sensors):
        freq = 0.5 + 1.5 * np.random.rand()
        phase = np.random.rand() * 2*np.pi
        amplitude = 1.0 + 0.5*np.random.randn()
        base = amplitude * np.sin(2*np.pi*freq*t + phase)
        noise = 0.15 * np.random.randn(seq_len)
        drift_term = drift * np.linspace(0, 1, seq_len)
        df[f"sensor_{s}"] = base + noise + drift_term + 0.05 * s
    df["timestamp"] = t
    df["label"] = label
    return pd.DataFrame(df)

def generate(n_samples=600, seq_len=300, sensors=6, class_probs=(0.4,0.5,0.1)):
    labels = []
    for i in range(n_samples):
        label = int(np.random.choice(len(class_probs), p=class_probs))
        # simulate class-specific dynamics by varying amplitude/freq/drift
        drift = 0.0
        if label == 1:
            drift = 0.05 * np.random.rand()
        if label == 2:
            drift = 0.1 * np.random.rand()
        df = make_trial(i, seq_len=seq_len, sensors=sensors, label=label, drift=drift)
        fname = f"trial_{i:04d}.csv"
        df.to_csv(RAW_DIR / fname, index=False)
        labels.append({"filename": fname, "label": int(label)})
    pd.DataFrame(labels).to_csv(LABELS_CSV, index=False)
    print(f"Generated {n_samples} trials into {RAW_DIR}")

if __name__ == "__main__":
    generate(n_samples=800, seq_len=300, sensors=6)
