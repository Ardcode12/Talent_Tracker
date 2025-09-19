# scripts/train_shuttle_run_model.py
import os
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.utils.class_weight import compute_class_weight
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_PATH = BASE_DIR / "data" / "processed" / "shuttle_run_dataset.csv"
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

def load_training_data(dataset_path: Path):
    print("[INFO] Loading dataset...")
    df = pd.read_csv(dataset_path)
    
    # Clean column names
    df.columns = df.columns.str.strip().str.lower()  # Remove whitespace and lowercase

    target_col = "label"
    if target_col not in df.columns:
        raise ValueError(f"❌ Dataset must contain '{target_col}' as target column. Available columns: {df.columns.tolist()}")

    # Drop unwanted columns if they exist
    drop_cols = ["trial_id", "participant_id", "timestamp_ms", "foot_strike_pattern"]
    existing_drop_cols = [c for c in drop_cols if c in df.columns]
    if len(existing_drop_cols) < len(drop_cols):
        missing = set(drop_cols) - set(existing_drop_cols)
        print(f"[WARN] These columns were not found in dataset and will be skipped: {missing}")

    feature_df = df.drop(columns=existing_drop_cols)
    feature_df.fillna(feature_df.mean(numeric_only=True), inplace=True)

    X = feature_df.drop(columns=[target_col]).values
    y = df[target_col].values

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    print(f"[INFO] Loaded {len(X)} samples, {len(le.classes_)} classes: {list(le.classes_)}")
    return X, y_encoded, le, feature_df.drop(columns=[target_col]).columns



def build_model(input_dim, num_classes):
    print("[INFO] Building neural network model...")
    model = Sequential([
        Dense(64, activation='relu', input_shape=(input_dim,)),
        Dropout(0.3),
        Dense(32, activation='relu'),
        Dropout(0.2),
        Dense(num_classes, activation='softmax')
    ])
    model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    return model

def train(dataset_path):
    X, y, le, feature_names = load_training_data(dataset_path)

    # Scale features
    print("[INFO] Preprocessing data with StandardScaler...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Compute class weights
    classes = np.unique(y)
    class_weights = compute_class_weight(class_weight='balanced', classes=classes, y=y)
    class_weight_dict = {cls: weight for cls, weight in zip(classes, class_weights)}
    print(f"[INFO] Using class weights: {class_weight_dict}")

    # Build model
    model = build_model(input_dim=X_scaled.shape[1], num_classes=len(classes))

    # Callbacks
    checkpoint = ModelCheckpoint(
        filepath=MODELS_DIR / "shuttle_run_model_best.keras",
        monitor='val_loss',
        save_best_only=True
    )
    early_stopping = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)

    # Train
    print("[INFO] Training model...")
    history = model.fit(
        X_scaled, y,
        validation_split=0.2,
        epochs=50,
        batch_size=32,
        class_weight=class_weight_dict,
        callbacks=[checkpoint, early_stopping],
        verbose=1
    )

    # Save final model, label encoder, and scaler
    print("[INFO] Saving model, label encoder, and scaler...")
    model.save(MODELS_DIR / "shuttle_run_model_final.keras")
    joblib.dump(le, MODELS_DIR / "shuttle_run_label_encoder.pkl")
    joblib.dump(scaler, MODELS_DIR / "shuttle_run_model_scaler.pkl")
    joblib.dump(feature_names.tolist(), MODELS_DIR / "shuttle_run_feature_names.pkl")
    print(f"✅ Training complete! Model and artifacts saved to {MODELS_DIR}")

if __name__ == "__main__":
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")
    train(DATASET_PATH)
