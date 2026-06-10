"""
=============================================================
SIT-UP POSITION CLASSIFIER - Training Script (Google Colab)
=============================================================
Dataset: Exercise Pose Landmark Dataset (Kaggle)
  https://www.kaggle.com/datasets/hasyimabdillah/workoutfitness-video

What this model learns:
  Input:  33 MediaPipe pose landmark coords (x, y, z, visibility)
  Output: UP position (1) or DOWN position (0)

What this model does NOT learn:
  - Whether the exercise is a sit-up (assumed from app context)
  - Form quality (separate problem)
  - Full video → score (rep counting is done in the analyzer, not here)

The trained model is used as a FRAME-LEVEL CLASSIFIER.
The situp_analyzer.py uses it to count UP→DOWN→UP transitions = reps.

Fixes applied:
  1. Split by VIDEO (not by frame) to prevent data leakage
  3. Column audit printed before training
  4. Metadata columns auto-excluded by pattern matching
  5. Fit scaler on train set ONLY to prevent validation leakage

SETUP IN COLAB:
  1. In Colab, mount your drive:
     from google.colab import drive
     drive.mount('/content/drive')
  2. The script will automatically read from: 
     /content/drive/MyDrive/situps/landmarks.csv
     /content/drive/MyDrive/situps/labels.csv

Output files (download to backend/ml_models/situp/):
  - situp_classifier.keras
  - situp_classifier.tflite
  - situp_scaler.pkl
  - situp_model_config.json
=============================================================
"""

import os
import re
import json
import warnings
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization, Input
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import matplotlib.pyplot as plt
import seaborn as sns

warnings.filterwarnings('ignore')
np.random.seed(42)
tf.random.set_seed(42)

# =============================================
# CONFIG
# =============================================
# Adjust these if the label names in your CSV differ
SITUP_UP_LABELS   = ['sit-up_up',   'situp_up',   'sit_up_up',
                     'SitUp_Up',    'situp-up',   'Sit-Up_Up']
SITUP_DOWN_LABELS = ['sit-up_down', 'situp_down', 'sit_up_down',
                     'SitUp_Down',  'situp-down', 'Sit-Up_Down']

LABEL_MAP  = {0: "sit_down", 1: "sit_up"}
NUM_CLASSES = 2

# Columns that are NEVER features — always metadata
_META_PATTERNS = re.compile(
    r'(video|file|name|id|frame|index|label|class|target|person|subject|'
    r'unnamed|split|set|fold|group|clip|sample)',
    re.IGNORECASE
)

# Columns that ARE landmark features — numeric coords
_LANDMARK_PATTERN = re.compile(
    r'^(x_?\d+|y_?\d+|z_?\d+|v_?\d+|vis_?\d+|'
    r'landmark_\d+|lm\d+|point_?\d+|'
    r'\d+[xyz]|x|y|z)$',
    re.IGNORECASE
)


# =============================================
# STEP 1: LOAD & FILTER DATA
# =============================================
def load_and_filter(landmarks_csv, labels_csv):
    print(f"\n{'='*60}")
    print(f"  LOADING DATASET")
    print(f"{'='*60}")

    df_landmarks = pd.read_csv(landmarks_csv)
    df_labels    = pd.read_csv(labels_csv)
    
    print(f"Landmarks shape: {df_landmarks.shape}")
    print(f"Labels shape:    {df_labels.shape}")

    # Merge on pose_id (or index if pose_id is missing)
    if 'pose_id' in df_landmarks.columns and 'pose_id' in df_labels.columns:
        df = pd.merge(df_landmarks, df_labels, on='pose_id')
        print("Merged on 'pose_id'")
    else:
        df = pd.concat([df_landmarks, df_labels], axis=1)
        print("Merged by index (no pose_id found)")
        
    print(f"Merged shape:    {df.shape}")

    # ── Auto-detect label column ──────────────────────────────────
    label_col = None
    for c in ['pose', 'label', 'Label', 'class', 'target', 'CLASS', 'exercise', 'activity']:
        if c in df.columns:
            label_col = c
            break
    if label_col is None:
        raise ValueError(
            "Cannot find label column. Columns: " + str(list(df.columns))
        )
    print(f"\nLabel column: '{label_col}'")
    print(f"All unique labels:\n{df[label_col].value_counts().to_string()}")

    # ── Auto-detect video ID column ───────────────────────────────
    video_id_col = None
    for c in ['video_id', 'video', 'filename', 'file', 'video_filename',
              'clip_id', 'clip', 'source', 'video_name']:
        if c in df.columns:
            video_id_col = c
            break
    if video_id_col:
        print(f"\nVideo ID column: '{video_id_col}' ({df[video_id_col].nunique()} unique videos)")
    else:
        print("\n⚠️  No video ID column found. Will split by row index as proxy.")

    # ── Filter to sit-up only ─────────────────────────────────────
    def norm(lbl):
        return str(lbl).lower().strip().replace(' ', '_').replace('-', '_')

    up_norm   = {norm(l) for l in SITUP_UP_LABELS}
    down_norm = {norm(l) for l in SITUP_DOWN_LABELS}

    df['_norm'] = df[label_col].apply(norm)
    mask_up     = df['_norm'].isin(up_norm)
    mask_down   = df['_norm'].isin(down_norm)

    print(f"\nSit-up UP   frames: {mask_up.sum()}")
    print(f"Sit-up DOWN frames: {mask_down.sum()}")

    if mask_up.sum() == 0 or mask_down.sum() == 0:
        # Show closest matches to help user fix label names
        print("\n❌ Could not match sit-up labels automatically.")
        print("Looking for UP labels:", up_norm)
        print("Looking for DOWN labels:", down_norm)
        print("\nActual labels in dataset:")
        for lbl in df[label_col].unique():
            print(f"  → '{lbl}' (normalized: '{norm(lbl)}')")
        raise ValueError("Please update SITUP_UP_LABELS / SITUP_DOWN_LABELS above.")

    df_up   = df[mask_up].copy();   df_up['binary_label']   = 1
    df_down = df[mask_down].copy(); df_down['binary_label'] = 0
    df_situp = pd.concat([df_up, df_down], ignore_index=True)

    print(f"\n✅ Total sit-up frames: {len(df_situp)}")
    return df_situp, label_col, video_id_col


# =============================================
# STEP 2: COLUMN AUDIT & FEATURE EXTRACTION
# =============================================
def extract_features(df, video_id_col):
    print(f"\n{'='*60}")
    print(f"  COLUMN AUDIT")
    print(f"{'='*60}")
    print(f"Total columns: {len(df.columns)}\n")

    landmark_cols = []
    meta_cols     = []
    unknown_cols  = []

    for col in df.columns:
        if col in ['binary_label', '_norm']:
            continue
        if _META_PATTERNS.search(col):
            meta_cols.append(col)
        elif _LANDMARK_PATTERN.match(col):
            landmark_cols.append(col)
        elif df[col].dtype in [np.float32, np.float64, np.int32, np.int64]:
            unknown_cols.append(col)
        else:
            meta_cols.append(col)

    print(f"✅ Landmark feature columns ({len(landmark_cols)}):")
    if landmark_cols:
        print(f"   {landmark_cols[:8]} ... {landmark_cols[-3:]}")
    else:
        print("   None detected by pattern!")

    print(f"\n🚫 Metadata columns excluded ({len(meta_cols)}):")
    for c in meta_cols:
        print(f"   '{c}'")

    print(f"\n⚠️  Unknown numeric columns ({len(unknown_cols)}) — please verify:")
    for c in unknown_cols:
        print(f"   '{c}'  dtype={df[c].dtype}  sample={df[c].iloc[0]}")

    # ── Decision: use landmark_cols + unknown_cols ────────────────
    # Unknown numerics might be landmarks not matching the pattern
    # Inspect them manually and decide
    feat_cols = landmark_cols + unknown_cols

    if not feat_cols:
        raise ValueError(
            "No feature columns found! Check the column audit above.\n"
            "You may need to update _LANDMARK_PATTERN to match your CSV column names."
        )

    print(f"\n📊 Using {len(feat_cols)} feature columns")

    X = df[feat_cols].values.astype(np.float32)
    y = df['binary_label'].values.astype(np.int32)

    # Sanity: expected 132 features (33 landmarks × 4) or 66 (×2)
    expected = {66, 99, 132}
    if len(feat_cols) not in expected:
        print(f"\n⚠️  Feature count {len(feat_cols)} is not a standard landmark count.")
        print(f"   Expected: {expected}")
        print(f"   Proceeding, but verify the columns above.")

    # Remove NaN / Inf
    X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=-1.0)

    print(f"Feature matrix: {X.shape}")
    print(f"UP={np.sum(y==1)}, DOWN={np.sum(y==0)}")

    # Get video IDs for grouped split
    if video_id_col and video_id_col in df.columns:
        video_ids = df[video_id_col].values
    else:
        # Use row index as proxy — split first 80% train, last 20% val
        video_ids = np.arange(len(df))

    return X, y, feat_cols, video_ids


# =============================================
# STEP 3: VIDEO-LEVEL TRAIN/VAL SPLIT
# =============================================
def video_level_split(X, y, video_ids, val_ratio=0.2):
    """
    Split by VIDEO to prevent data leakage.
    Frames from the same video go entirely to train OR val — never both.
    """
    unique_vids = np.unique(video_ids)
    np.random.shuffle(unique_vids)

    n_val  = max(1, int(len(unique_vids) * val_ratio))
    val_vids  = set(unique_vids[:n_val])
    train_vids = set(unique_vids[n_val:])

    train_mask = np.array([v in train_vids for v in video_ids])
    val_mask   = ~train_mask

    X_train, y_train = X[train_mask], y[train_mask]
    X_val,   y_val   = X[val_mask],   y[val_mask]

    print(f"\n📂 Video-level split:")
    print(f"   Train videos: {len(train_vids)}  → {len(X_train)} frames")
    print(f"   Val   videos: {len(val_vids)}  → {len(X_val)} frames")
    print(f"   Train UP={np.sum(y_train==1)}, DOWN={np.sum(y_train==0)}")
    print(f"   Val   UP={np.sum(y_val==1)},   DOWN={np.sum(y_val==0)}")

    return X_train, X_val, y_train, y_val


# =============================================
# STEP 4: BUILD MODEL
# =============================================
def build_model(input_dim):
    inp = Input(shape=(input_dim,), name='landmarks')

    x = Dense(256, activation='relu')(inp)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)

    x = Dense(128, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)

    x = Dense(64, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.2)(x)

    x = Dense(32, activation='relu')(x)
    out = Dense(NUM_CLASSES, activation='softmax', name='output')(x)

    model = Model(inputs=inp, outputs=out)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy'],
    )
    return model


# =============================================
# STEP 5: TRAIN
# =============================================
def train(X, y, feat_cols, video_ids):
    print(f"\n{'='*60}")
    print(f"  TRAINING")
    print(f"{'='*60}")

    # Video-level split first
    X_train_raw, X_val_raw, y_train, y_val = video_level_split(
        X, y, video_ids, val_ratio=0.2
    )

    # Scale AFTER split — fit scaler on train data only
    scaler   = StandardScaler()
    X_train  = scaler.fit_transform(X_train_raw)
    X_val    = scaler.transform(X_val_raw)

    model = build_model(X.shape[1])
    model.summary()

    callbacks = [
        EarlyStopping(patience=15, restore_best_weights=True, monitor='val_accuracy'),
        ReduceLROnPlateau(patience=8, factor=0.5, min_lr=1e-6),
        ModelCheckpoint('situp_best.keras', save_best_only=True,
                        monitor='val_accuracy', mode='max'),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=120,
        batch_size=32,
        callbacks=callbacks,
        verbose=1,
    )

    return model, scaler, history, X_val, y_val


# =============================================
# STEP 6: EVALUATE
# =============================================
def evaluate(model, X_val, y_val):
    print(f"\n{'='*60}")
    print(f"  EVALUATION (on held-out val videos)")
    print(f"{'='*60}")

    y_pred = np.argmax(model.predict(X_val, verbose=0), axis=1)

    print(classification_report(
        y_val, y_pred,
        target_names=[LABEL_MAP[i] for i in range(NUM_CLASSES)]
    ))

    cm = confusion_matrix(y_val, y_pred)
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=list(LABEL_MAP.values()),
                yticklabels=list(LABEL_MAP.values()))
    plt.title('Sit-Up Classifier — Confusion Matrix (Val Videos)')
    plt.ylabel('Actual')
    plt.xlabel('Predicted')
    plt.tight_layout()
    plt.savefig('situp_confusion_matrix.png', dpi=150)
    plt.show()

    acc = np.mean(y_pred == y_val)
    print(f"\nVal Accuracy: {acc*100:.1f}%")
    return acc


# =============================================
# STEP 7: EXPORT
# =============================================
def export(model, scaler, feat_cols, history, val_acc):
    print(f"\n{'='*60}")
    print(f"  EXPORTING")
    print(f"{'='*60}")

    model.save('situp_classifier.keras')
    print("✅ situp_classifier.keras")

    joblib.dump(scaler, 'situp_scaler.pkl')
    print("✅ situp_scaler.pkl")

    # TFLite (quantized for faster inference)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    with open('situp_classifier.tflite', 'wb') as f:
        f.write(tflite_model)
    print("✅ situp_classifier.tflite")

    config = {
        "num_features":   len(feat_cols),
        "feature_names":  feat_cols,
        "num_classes":    NUM_CLASSES,
        "label_map":      LABEL_MAP,
        "val_accuracy":   round(val_acc, 4),
        "split_method":   "video_level",
    }
    with open('situp_model_config.json', 'w') as f:
        json.dump(config, f, indent=2)
    print("✅ situp_model_config.json")

    # Training plot
    plt.figure(figsize=(12, 4))
    plt.subplot(1, 2, 1)
    plt.plot(history.history['accuracy'], label='Train')
    plt.plot(history.history['val_accuracy'], label='Val')
    plt.title(f'Accuracy (best val={val_acc*100:.1f}%)')
    plt.legend()
    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'], label='Train')
    plt.plot(history.history['val_loss'], label='Val')
    plt.title('Loss')
    plt.legend()
    plt.tight_layout()
    plt.savefig('situp_training_history.png', dpi=150)
    plt.show()

    print(f"\n🎯 Val accuracy: {val_acc*100:.1f}%")
    print("\n📦 Download to backend/ml_models/situp/:")
    print("   situp_classifier.tflite  ← main model")
    print("   situp_scaler.pkl         ← feature scaler")
    print("   situp_model_config.json  ← config")


# =============================================
# MAIN
# =============================================
if __name__ == '__main__':
    # ── Set your CSV paths here ──────────────────────────────────────────────
    # Reading directly from your Google Drive 'situps' folder
    LANDMARKS_CSV = '/content/drive/MyDrive/situps/landmarks.csv'
    LABELS_CSV    = '/content/drive/MyDrive/situps/labels.csv'
    # ─────────────────────────────────────────────────────────────────────────

    df, label_col, video_id_col = load_and_filter(LANDMARKS_CSV, LABELS_CSV)
    X, y, feat_cols, video_ids  = extract_features(df, video_id_col)
    model, scaler, history, X_val, y_val = train(X, y, feat_cols, video_ids)
    val_acc = evaluate(model, X_val, y_val)
    export(model, scaler, feat_cols, history, val_acc)
