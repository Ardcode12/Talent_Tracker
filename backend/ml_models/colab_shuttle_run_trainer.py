"""
=============================================================================
🏃 SHUTTLE RUN MODEL TRAINER — Google Colab Script (v2 - Single Output)
=============================================================================
Upload shuttle_run_data.csv to your Google Drive, then run this notebook.

Dataset: 5000 rows × 43 columns
Labels: performance_band (Below Average, Average, Good, Very Good, Excellent)

Output files → backend/ml_models/shuttle_run/models/
=============================================================================
"""

# ── Cell 1: Mount Drive & Install ────────────────────────────────────────────
from google.colab import drive
drive.mount('/content/drive')

!pip install -q tensorflow scikit-learn joblib pandas numpy matplotlib seaborn

# ── Cell 2: Imports ──────────────────────────────────────────────────────────
import pandas as pd
import numpy as np
import json
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks, regularizers

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight

print(f"TensorFlow version: {tf.__version__}")
print(f"GPU available: {len(tf.config.list_physical_devices('GPU')) > 0}")

# ── Cell 3: Load Dataset ────────────────────────────────────────────────────
CSV_PATH = "/content/drive/MyDrive/shuttle_run_data.csv"

df = pd.read_csv(CSV_PATH)
print(f"Dataset shape: {df.shape}")
print(f"\nPerformance Band Distribution:")
print(df['performance_band'].value_counts().sort_index())

# ── Cell 4: Feature Engineering ──────────────────────────────────────────────
DROP_COLS = ['trial_id', 'participant_id', 'performance_band', 'timestamp_ms']
CAT_COLS = ['gender', 'surface', 'shoes', 'foot_strike_pattern']

y_raw = df['performance_band'].copy()

df_features = df.drop(columns=DROP_COLS, errors='ignore')
df_features = pd.get_dummies(df_features, columns=CAT_COLS, drop_first=False)

for col in df_features.columns:
    if df_features[col].dtype == 'bool':
        df_features[col] = df_features[col].astype(int)

df_features = df_features.apply(pd.to_numeric, errors='coerce').fillna(0)

FEATURE_NAMES = list(df_features.columns)
print(f"\n✅ Total features: {len(FEATURE_NAMES)}")

X = df_features.values.astype(np.float32)

# ── Cell 5: Encode Labels ───────────────────────────────────────────────────
le = LabelEncoder()
y_encoded = le.fit_transform(y_raw)
NUM_CLASSES = len(le.classes_)

print(f"✅ Classes ({NUM_CLASSES}): {le.classes_.tolist()}")
print(f"Distribution: {np.bincount(y_encoded)}")

y_onehot = keras.utils.to_categorical(y_encoded, NUM_CLASSES)

# Band → score mapping (used in post-processing, NOT in training)
BAND_SCORES = {
    'Below Average': 0.25,
    'Average':       0.50,
    'Good':          0.70,
    'Very Good':     0.85,
    'Excellent':     0.95,
}

# ── Cell 6: Train/Val/Test Split ─────────────────────────────────────────────
X_train_full, X_test, y_train_full, y_test = train_test_split(
    X, y_onehot, test_size=0.15, random_state=42, stratify=y_encoded
)

y_train_labels_full = np.argmax(y_train_full, axis=1)
X_train, X_val, y_train, y_val = train_test_split(
    X_train_full, y_train_full,
    test_size=0.18, random_state=42, stratify=y_train_labels_full
)

print(f"\n✅ Train: {X_train.shape[0]}, Val: {X_val.shape[0]}, Test: {X_test.shape[0]}")

# ── Cell 7: Scale Features ──────────────────────────────────────────────────
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled = scaler.transform(X_val)
X_test_scaled = scaler.transform(X_test)

# ── Cell 8: Compute Class Weights ────────────────────────────────────────────
train_labels = np.argmax(y_train, axis=1)
class_weights_arr = compute_class_weight(
    'balanced', classes=np.arange(NUM_CLASSES), y=train_labels
)
class_weight_dict = {i: float(w) for i, w in enumerate(class_weights_arr)}

print(f"\n✅ Class weights:")
for i, cls_name in enumerate(le.classes_):
    print(f"  {cls_name}: {class_weight_dict[i]:.3f}")

# ── Cell 9: Build Model (Single Output — Classification Only) ────────────────
N_FEATURES = X_train_scaled.shape[1]

model = keras.Sequential([
    layers.Input(shape=(N_FEATURES,), name='features'),

    layers.Dense(256, kernel_regularizer=regularizers.l2(1e-4)),
    layers.BatchNormalization(),
    layers.Activation('relu'),
    layers.Dropout(0.3),

    layers.Dense(128, kernel_regularizer=regularizers.l2(1e-4)),
    layers.BatchNormalization(),
    layers.Activation('relu'),
    layers.Dropout(0.25),

    layers.Dense(64, kernel_regularizer=regularizers.l2(1e-4)),
    layers.BatchNormalization(),
    layers.Activation('relu'),
    layers.Dropout(0.2),

    layers.Dense(32, activation='relu'),
    layers.Dense(NUM_CLASSES, activation='softmax', name='band_class'),
])

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

model.summary()

# ── Cell 10: Callbacks ───────────────────────────────────────────────────────
OUTPUT_DIR = Path("/content/shuttle_run_output")
OUTPUT_DIR.mkdir(exist_ok=True)

cb_list = [
    callbacks.ModelCheckpoint(
        str(OUTPUT_DIR / "shuttle_run_model_best.keras"),
        monitor='val_accuracy',
        save_best_only=True,
        mode='max',
        verbose=1
    ),
    callbacks.EarlyStopping(
        monitor='val_accuracy',
        patience=20,
        restore_best_weights=True,
        mode='max',
        verbose=1
    ),
    callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=8,
        min_lr=1e-6,
        verbose=1
    ),
]

# ── Cell 11: Train ───────────────────────────────────────────────────────────
EPOCHS = 150
BATCH_SIZE = 64

history = model.fit(
    X_train_scaled,
    y_train,
    validation_data=(X_val_scaled, y_val),
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    class_weight=class_weight_dict,
    callbacks=cb_list,
    verbose=1
)

# ── Cell 12: Save Final Model ───────────────────────────────────────────────
model.save(str(OUTPUT_DIR / "shuttle_run_model_final.keras"))
print("✅ Final model saved")

# ── Cell 13: Evaluate on Test Set ────────────────────────────────────────────
y_pred_proba = model.predict(X_test_scaled, verbose=0)
y_pred_labels = np.argmax(y_pred_proba, axis=1)
y_true_labels = np.argmax(y_test, axis=1)

print("\n" + "="*60)
print("📊 CLASSIFICATION REPORT")
print("="*60)
print(classification_report(y_true_labels, y_pred_labels,
                            target_names=le.classes_))

test_acc = np.mean(y_pred_labels == y_true_labels) * 100
print(f"\n🎯 Test Accuracy: {test_acc:.1f}%")

# Demonstrate score computation (same logic used in production)
pred_bands = le.inverse_transform(y_pred_labels)
pred_scores = np.array([BAND_SCORES.get(b, 0.5) for b in pred_bands])
pred_confidences = np.max(y_pred_proba, axis=1)
final_scores = pred_scores * pred_confidences + (1 - pred_confidences) * (pred_scores - 0.1)
final_scores = np.clip(final_scores * 100, 5, 100)
print(f"📈 Score range: {final_scores.min():.0f}% - {final_scores.max():.0f}% (mean: {final_scores.mean():.0f}%)")

# ── Cell 14: Confusion Matrix & Training History ─────────────────────────────
cm = confusion_matrix(y_true_labels, y_pred_labels)

fig, axes = plt.subplots(1, 2, figsize=(16, 5))

sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=le.classes_, yticklabels=le.classes_, ax=axes[0])
axes[0].set_title('Confusion Matrix')
axes[0].set_xlabel('Predicted')
axes[0].set_ylabel('Actual')

axes[1].plot(history.history['accuracy'], label='Train Acc')
axes[1].plot(history.history['val_accuracy'], label='Val Acc')
axes[1].set_title('Training History')
axes[1].set_xlabel('Epoch')
axes[1].set_ylabel('Accuracy')
axes[1].legend()
axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(str(OUTPUT_DIR / "evaluation_plots.png"), dpi=150)
plt.show()
print("✅ Plots saved")

# ── Cell 15: Export TFLite ───────────────────────────────────────────────────
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()

tflite_path = OUTPUT_DIR / "shuttle_run_model_best.tflite"
with open(tflite_path, 'wb') as f:
    f.write(tflite_model)
print(f"✅ TFLite model: {tflite_path} ({len(tflite_model)/1024:.1f} KB)")

# ── Cell 16: Save All Artifacts ──────────────────────────────────────────────
joblib.dump(scaler, str(OUTPUT_DIR / "shuttle_run_model_scaler.pkl"))
joblib.dump(le, str(OUTPUT_DIR / "shuttle_run_label_encoder.pkl"))
joblib.dump(FEATURE_NAMES, str(OUTPUT_DIR / "shuttle_run_feature_names.pkl"))

config = {
    "model_type": "shuttle_run_classifier",
    "input_features": len(FEATURE_NAMES),
    "feature_names": FEATURE_NAMES,
    "num_classes": NUM_CLASSES,
    "class_names": le.classes_.tolist(),
    "band_scores": BAND_SCORES,
    "test_accuracy": round(test_acc, 2),
}
with open(OUTPUT_DIR / "shuttle_run_model_config.json", 'w') as f:
    json.dump(config, f, indent=2)

print("\n✅ All artifacts saved:")
for p in sorted(OUTPUT_DIR.iterdir()):
    print(f"  📁 {p.name} ({p.stat().st_size/1024:.1f} KB)")

# ── Cell 17: Copy to Drive ───────────────────────────────────────────────────
import shutil

DRIVE_OUT = Path("/content/drive/MyDrive/shuttle_run_trained")
DRIVE_OUT.mkdir(exist_ok=True)

for f in OUTPUT_DIR.iterdir():
    shutil.copy2(f, DRIVE_OUT / f.name)

print(f"\n✅ All files copied to Google Drive: {DRIVE_OUT}")
print(f"\n🎉 TRAINING COMPLETE!")
print(f"   Test Accuracy: {test_acc:.1f}%")
print(f"   Classes: {le.classes_.tolist()}")
print(f"\n📥 Put these files in: backend/ml_models/shuttle_run/models/")
