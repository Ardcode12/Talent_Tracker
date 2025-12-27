"""
Utility helpers for loading the shuttle-run classifier/regressor and running
predictions.  The objects are cached in module-level globals so they are
loaded only once per   Uvicorn worker process.

Expected artefacts (already present in ml_models/shuttle_run/models):
    ├── shuttle_run_model_best.keras  (Keras functional model)
    ├── shuttle_run_model_scaler.pkl  (sklearn.StandardScaler)
    ├── shuttle_run_label_encoder.pkl (sklearn.LabelEncoder)
    └── shuttle_run_feature_names.pkl (list[str] – feature order used at train)

If any of the “*_best.keras” files are missing we fall back to
“shuttle_run_model_final.keras”.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import tensorflow as tf

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

# ---------------------------------------------------------------------------
# Lazy-loaded singletons
# ---------------------------------------------------------------------------
_MODEL = None          # type: tf.keras.Model | None
_SCALER = None         # type: joblib.BaseEstimator | None
_LABEL_ENCODER = None  # type: joblib.BaseEstimator | None
_FEATURE_NAMES: List[str] | None = None


def _load_artifacts() -> None:
    global _MODEL, _SCALER, _LABEL_ENCODER, _FEATURE_NAMES

    # --- Keras model ---
    model_path = (
        MODELS_DIR / "shuttle_run_model_best.keras"
        if (MODELS_DIR / "shuttle_run_model_best.keras").exists()
        else MODELS_DIR / "shuttle_run_model_final.keras"
    )
    _MODEL = tf.keras.models.load_model(model_path)
    _MODEL.make_predict_function()  # warm-up

    # --- Scaler / encoder / feature names ---
    _SCALER = joblib.load(MODELS_DIR / "shuttle_run_model_scaler.pkl")
    _LABEL_ENCODER = joblib.load(MODELS_DIR / "shuttle_run_label_encoder.pkl")
    _FEATURE_NAMES = joblib.load(MODELS_DIR / "shuttle_run_feature_names.pkl")

    print(
        f"[ShuttleRun]  model = {model_path.name}  "
        f"features = {len(_FEATURE_NAMES)}  classes = {_LABEL_ENCODER.classes_.tolist()}"
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


def preprocess_features(raw: List[float]) -> np.ndarray:
    """
    • Accepts the raw 1-D feature list (length must equal n_features).
    • Returns a scaled numpy array shaped (1, n_features).
    """
    _ensure_loaded()
    if len(raw) != len(_FEATURE_NAMES):
        raise ValueError(
            f"Expected {len(_FEATURE_NAMES)} features, got {len(raw)} instead."
        )
    X = np.asarray(raw, dtype=np.float32).reshape(1, -1)
    X_scaled = _SCALER.transform(X)
    return X_scaled


def predict(raw_features: List[float]) -> Dict[str, float | str]:
    """
    Given a raw feature vector, return:
        {
          "band_label": "Excellent",
          "probability": 0.82,
          "numeric_score": 91.0      # 0-100 derived from class & prob
        }
    """
    _ensure_loaded()

    X = preprocess_features(raw_features)
    y_proba = _MODEL.predict(X, verbose=0)[0]  # shape (n_classes,)

    top_idx = int(np.argmax(y_proba))
    band_label = str(_LABEL_ENCODER.inverse_transform([top_idx])[0])
    prob = float(y_proba[top_idx])

    # Simple 0-100 score where each class gets a band midpoint and is nudged by confidence
    _band_to_base = {
        "Elite": 100,
        "Excellent": 90,
        "Very Good": 80,
        "Good": 70,
        "Average": 60,
        "Below Average": 45,
    }
    base = _band_to_base.get(band_label, 50)
    numeric_score = base * prob + (1 - prob) * (base - 10)

    return {
        "band_label": band_label,
        "probability": round(prob, 4),
        "numeric_score": round(numeric_score, 1),
    }
