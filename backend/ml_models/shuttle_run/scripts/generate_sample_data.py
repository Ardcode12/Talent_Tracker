import pandas as pd
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "processed"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ---- PARAMETERS ----
NUM_SAMPLES = 500
NUM_FEATURES = 20
LABELS = ["good", "average", "poor"]  # Example performance classes

def generate_dummy_dataset():
    print("[INFO] Generating synthetic shuttle run dataset...")
    # Random feature data
    X = np.random.rand(NUM_SAMPLES, NUM_FEATURES)

    # Assign random labels (balanced)
    y = np.random.choice(LABELS, size=NUM_SAMPLES)

    # Create DataFrame
    df = pd.DataFrame(X, columns=[f"feature_{i}" for i in range(NUM_FEATURES)])
    df["label"] = y

    output_path = DATA_DIR / "shuttle_run_dataset.csv"
    df.to_csv(output_path, index=False)
    print(f"✅ Dummy dataset saved to: {output_path}")

if __name__ == "__main__":
    generate_dummy_dataset()
