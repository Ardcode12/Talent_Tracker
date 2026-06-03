"""
Shuttle-Run model utilities — loads the trained Keras classifier and runs
predictions.  Objects are cached in module-level globals (loaded once per worker).

Expected artefacts in ml_models/shuttle_run/models/:
    ├── shuttle_run_model_best.keras   (Sequential classifier)
    ├── shuttle_run_model_scaler.pkl   (StandardScaler)
    ├── shuttle_run_label_encoder.pkl  (LabelEncoder)
    ├── shuttle_run_feature_names.pkl  (list[str])
    └── shuttle_run_model_config.json  (metadata)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
import tensorflow as tf

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

# ---------------------------------------------------------------------------
# Lazy-loaded singletons
# ---------------------------------------------------------------------------
_MODEL = None
_SCALER = None
_LABEL_ENCODER = None
_FEATURE_NAMES: List[str] | None = None
_CONFIG: Dict | None = None


def _load_artifacts() -> None:
    global _MODEL, _SCALER, _LABEL_ENCODER, _FEATURE_NAMES, _CONFIG

    # --- Keras model ---
    model_path = (
        MODELS_DIR / "shuttle_run_model_best.keras"
        if (MODELS_DIR / "shuttle_run_model_best.keras").exists()
        else MODELS_DIR / "shuttle_run_model_final.keras"
    )
    _MODEL = tf.keras.models.load_model(model_path)
    print(f"[ShuttleRun] Loaded model: {model_path.name}")

    # --- Scaler / encoder / feature names ---
    _SCALER = joblib.load(MODELS_DIR / "shuttle_run_model_scaler.pkl")
    _LABEL_ENCODER = joblib.load(MODELS_DIR / "shuttle_run_label_encoder.pkl")
    _FEATURE_NAMES = joblib.load(MODELS_DIR / "shuttle_run_feature_names.pkl")

    # --- Config ---
    config_path = MODELS_DIR / "shuttle_run_model_config.json"
    if config_path.exists():
        with open(config_path) as f:
            _CONFIG = json.load(f)

    print(
        f"[ShuttleRun] features={len(_FEATURE_NAMES)}  "
        f"classes={_LABEL_ENCODER.classes_.tolist()}"
    )


def _ensure_loaded() -> None:
    if _MODEL is None:
        _load_artifacts()


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------
def get_feature_names() -> List[str]:
    _ensure_loaded()
    return list(_FEATURE_NAMES)


def get_num_features() -> int:
    _ensure_loaded()
    return len(_FEATURE_NAMES)


def preprocess_features(raw: List[float]) -> np.ndarray:
    """Scale a raw feature vector → shape (1, n_features)."""
    _ensure_loaded()
    n = len(_FEATURE_NAMES)
    if len(raw) != n:
        raise ValueError(f"Expected {n} features, got {len(raw)}")
    X = np.asarray(raw, dtype=np.float32).reshape(1, -1)
    return _SCALER.transform(X)


# Band → base score mapping
_BAND_TO_BASE = {
    "Excellent":     95,
    "Very Good":     82,
    "Good":          70,
    "Average":       55,
    "Below Average": 35,
}


def predict(raw_features: List[float]) -> Dict[str, float | str]:
    """
    Given a raw feature vector (length = n_features), return:
        {
          "band_label": "Very Good",
          "probability": 0.87,
          "numeric_score": 82.3
        }
    """
    _ensure_loaded()

    X = preprocess_features(raw_features)
    y_proba = _MODEL.predict(X, verbose=0)[0]  # shape (n_classes,)

    top_idx = int(np.argmax(y_proba))
    band_label = str(_LABEL_ENCODER.inverse_transform([top_idx])[0])
    prob = float(y_proba[top_idx])

    # Score = base * confidence + (1-confidence) * (base - 10)
    base = _BAND_TO_BASE.get(band_label, 50)
    numeric_score = base * prob + (1 - prob) * (base - 10)
    numeric_score = max(5, min(100, numeric_score))

    return {
        "band_label": band_label,
        "probability": round(prob, 4),
        "numeric_score": round(numeric_score, 1),
    }
