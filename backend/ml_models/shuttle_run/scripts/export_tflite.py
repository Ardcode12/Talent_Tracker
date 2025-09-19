# scripts/export_tflite.py
"""
Export Keras model to TFLite:
- Full float32
- FP16
- Integer quantization with representative dataset (recommended for mobile)
"""
import json
from pathlib import Path
import tensorflow as tf
import numpy as np
import joblib

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"
PROC_DIR = ROOT / "data" / "processed"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

def representative_gen():
    # uses saved repr_dataset.npz from preprocess
    try:
        data = np.load(PROC_DIR / "repr_dataset.npz")
        arr = [data[f"arr_{i}"] if f"arr_{i}" in data.files else data[list(data.files)[i]] for i in range(len(data.files))]
    except Exception:
        # fallback: generate random samples shaped (SEQ_LEN, SENSORS)
        def rand_gen():
            for _ in range(100):
                yield np.random.randn(300,6).astype(np.float32)
        arr = list(rand_gen())[:100]
    def gen():
        for a in arr:
            yield [a]
    return gen

def main():
    model_path = MODELS_DIR / "shuttle_run_model_best.h5"
    if not model_path.exists():
        model_path = MODELS_DIR / "shuttle_run_model.h5"
    model = tf.keras.models.load_model(str(model_path))

    saved_tf_dir = MODELS_DIR / "saved_model_for_tflite"
    tf.keras.models.save_model(model, saved_tf_dir, include_optimizer=False, save_format="tf")

    # full float
    converter = tf.lite.TFLiteConverter.from_saved_model(str(saved_tf_dir))
    tflite_full = converter.convert()
    (MODELS_DIR / "shuttle_run_model_full.tflite").write_bytes(tflite_full)
    with open(MODELS_DIR / "shuttle_run_model_full_params.json", "w") as fh:
        json.dump({"type":"float32"}, fh)

    # fp16
    converter = tf.lite.TFLiteConverter.from_saved_model(str(saved_tf_dir))
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    tflite_fp16 = converter.convert()
    (MODELS_DIR / "shuttle_run_model_fp16.tflite").write_bytes(tflite_fp16)
    with open(MODELS_DIR / "shuttle_run_model_fp16_params.json", "w") as fh:
        json.dump({"type":"fp16"}, fh)

    # integer quantization (full integer) -- needs representative dataset
    converter = tf.lite.TFLiteConverter.from_saved_model(str(saved_tf_dir))
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    gen = representative_gen()
    converter.representative_dataset = gen()
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    tflite_int = converter.convert()
    (MODELS_DIR / "shuttle_run_model_int8.tflite").write_bytes(tflite_int)
    with open(MODELS_DIR / "shuttle_run_model_int8_params.json", "w") as fh:
        json.dump({"type":"int8", "notes":"use input/output int8; may require scaling on client"}, fh)

    print("TFLite export complete (full, fp16, int8)")

if __name__ == "__main__":
    main()
