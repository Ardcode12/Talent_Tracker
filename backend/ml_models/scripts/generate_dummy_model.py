"""
generate_dummy_model.py
Creates a dummy LSTM model + scaler + metadata + TFLite exports
so you can immediately run the backend API without training first.
"""

from pathlib import Path
import numpy as np
import joblib
import json
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt

# --- Paths ---
ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# --- Config ---
SEQ_LEN = 300
FEATURES = 6
CLASSES = ["start", "mid", "finish"]

print("🚀 Generating dummy model and artifacts...")

# 1️⃣ Create and save dummy Keras model
model = Sequential([
    Input(shape=(SEQ_LEN, FEATURES)),
    LSTM(32, return_sequences=False),
    Dense(len(CLASSES), activation="softmax")
])
model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])

model.save(MODELS_DIR / "shuttle_run_model.h5")
model.save(MODELS_DIR / "shuttle_run_model_best.h5")
print("✅ Saved dummy Keras model (.h5 and best checkpoint)")

# 2️⃣ Save dummy scaler
scaler = StandardScaler()
scaler.mean_ = np.zeros(FEATURES)
scaler.scale_ = np.ones(FEATURES)
scaler.var_ = np.ones(FEATURES)
scaler.n_features_in_ = FEATURES
joblib.dump(scaler, MODELS_DIR / "shuttle_run_model_scaler.pkl")
print("✅ Saved dummy StandardScaler")

# 3️⃣ Save metadata JSON
metadata = {
    "input_shape": [SEQ_LEN, FEATURES],
    "num_classes": len(CLASSES),
    "class_map": {str(i): c for i, c in enumerate(CLASSES)},
    "training_config": {
        "epochs": 50,
        "batch_size": 32,
        "optimizer": "adam",
        "loss": "categorical_crossentropy",
        "metrics": ["accuracy"]
    },
    "train_val_split": 0.2,
    "feature_scaler": "StandardScaler"
}
with open(MODELS_DIR / "shuttle_run_model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=4)
print("✅ Saved metadata JSON")

# 4️⃣ Export dummy TFLite models
try:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    # ✅ Fix: enable SELECT_TF_OPS and disable lowering of tensor list ops for LSTM
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS
    ]
    converter._experimental_lower_tensor_list_ops = False

    # Full precision TFLite
    tflite_full = converter.convert()
    (MODELS_DIR / "shuttle_run_model_full.tflite").write_bytes(tflite_full)
    json.dump({"conversion": "float32", "input_shape": [1, SEQ_LEN, FEATURES]},
              open(MODELS_DIR / "shuttle_run_model_full_params.json", "w"), indent=4)

    # FP16 quantization
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_fp16 = converter.convert()
    (MODELS_DIR / "shuttle_run_model_fp16.tflite").write_bytes(tflite_fp16)
    json.dump({"conversion": "float16", "input_shape": [1, SEQ_LEN, FEATURES]},
              open(MODELS_DIR / "shuttle_run_model_fp16_params.json", "w"), indent=4)

    # Dynamic range quantization
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_quant = converter.convert()
    (MODELS_DIR / "shuttle_run_model_quantized.tflite").write_bytes(tflite_quant)
    json.dump({"conversion": "dynamic_range_quant", "input_shape": [1, SEQ_LEN, FEATURES]},
              open(MODELS_DIR / "shuttle_run_model_quantized_params.json", "w"), indent=4)

    print("✅ Saved TFLite models (full, fp16, quantized)")
except Exception as e:
    print(f"⚠️ Skipping TFLite conversion due to error: {e}")

# 5️⃣ Generate dummy training curves
epochs = np.arange(1, 11)
train_acc = np.linspace(0.7, 0.95, len(epochs)) + np.random.normal(0, 0.02, len(epochs))
val_acc = np.linspace(0.65, 0.9, len(epochs)) + np.random.normal(0, 0.03, len(epochs))

plt.figure(figsize=(6, 4))
plt.plot(epochs, train_acc, label="Train Accuracy")
plt.plot(epochs, val_acc, label="Val Accuracy")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.title("Training Curves (Dummy)")
plt.legend()
plt.tight_layout()
plt.savefig(MODELS_DIR / "evaluation_plots.png")
plt.close()
print("✅ Saved dummy evaluation_plots.png")

print("\n🎉 Dummy model generation complete! Your models/ folder is ready.")
