"""
run_pipeline.py
Runs the entire ML pipeline in order:
1. Generate sample data (optional if real data exists)
2. Preprocess feature extraction
3. Train model & save artifacts
4. Export TFLite versions
5. Evaluate and plot training metrics
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STEPS = [
    "generate_sample_data.py",
    "preprocess.py",
    "train_model.py",
    "export_tflite.py",
    "evaluate.py",
]

def run_step(script_name):
    script_path = ROOT / script_name
    if not script_path.exists():
        print(f"⚠️  Skipping {script_name}, not found.")
        return
    print(f"\n🚀 Running {script_name} ...")
    result = subprocess.run([sys.executable, str(script_path)], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Error running {script_name}:\n{result.stderr}")
        sys.exit(result.returncode)
    else:
        print(f"✅ Completed {script_name}")
        print(result.stdout)

def main():
    print("========================================")
    print(" 🏃 Running Full Shuttle Run ML Pipeline")
    print("========================================")
    for step in STEPS:
        run_step(step)
    print("\n🎉 Pipeline finished successfully!")

if __name__ == "__main__":
    main()

