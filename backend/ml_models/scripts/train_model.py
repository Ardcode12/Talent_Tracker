# scripts/train_model_advanced.py
"""
Train 10m x 4 shuttle run model with:
- Conv1D + BiLSTM + Multi-head Attention
- Dual regression heads: shuttle_count, agility_score
- Classification head: performance_band
- Derived features: acc_mag, jerk, RMS, directional velocity
- Data augmentation (noise + window shift)
- Scientific agility calculation
"""

import os
from pathlib import Path
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks, optimizers
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
import joblib, json, datetime

# ------------------ PATHS ------------------
ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
MODELS_DIR = ROOT / "models"
LOGS_DIR = ROOT / "logs"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# ------------------ HYPERPARAMS ------------------
SEQ_LEN = 300
SENSORS = 6
BATCH_SIZE = 32
EPOCHS = 80
LEARNING_RATE = 1e-3
SEED = 42
NUM_CLASSES = 3
tf.random.set_seed(SEED)
np.random.seed(SEED)

LABEL_MAP = {"low":0,"medium":1,"high":2}
SENSOR_COLS = ["acc_x","acc_y","acc_z","gyro_x","gyro_y","gyro_z"]

# ------------------ FEATURE ENGINEERING ------------------
def derive_features(df):
    """
    Create additional derived features:
    - acc_mag: sqrt(ax^2+ay^2+az^2)
    - jerk: diff of acc_mag
    - rms_acc: moving RMS of acceleration
    - velocity_y: cumulative sum of acc_y
    """
    acc = df[["acc_x","acc_y","acc_z"]].values.astype(np.float32)
    gyro = df[["gyro_x","gyro_y","gyro_z"]].values.astype(np.float32)
    acc_mag = np.linalg.norm(acc, axis=1, keepdims=True)
    jerk = np.diff(acc_mag, prepend=acc_mag[0:1], axis=0)
    rms_acc = np.sqrt(pd.Series(acc_mag.flatten()).rolling(window=5, min_periods=1).mean().values).reshape(-1,1)
    vel_y = np.cumsum(acc[:,1:2], axis=0)
    features = np.hstack([acc, gyro, acc_mag, jerk, rms_acc, vel_y])
    return features.astype(np.float32)

# ------------------ DATA LOADING ------------------
def load_sequences(seq_len=SEQ_LEN):
    X, y_band, y_count, y_agility = [], [], [], []
    for f in sorted(RAW_DIR.glob("trial_*.csv")):
        df = pd.read_csv(f).sort_values("timestamp_ms")
        arr = derive_features(df)
        # pad/truncate
        if arr.shape[0] < seq_len:
            pad = np.zeros((seq_len - arr.shape[0], arr.shape[1]), dtype=np.float32)
            arr = np.vstack([arr, pad])
        else:
            arr = arr[:seq_len]
        X.append(arr)
        # labels
        band = df["performance_band"].iloc[0]
        y_band.append(LABEL_MAP[band])
        # shuttle count (peak detection)
        acc_mag = np.linalg.norm(df[["acc_x","acc_y","acc_z"]].values, axis=1)
        peaks = np.where((acc_mag[1:-1]>acc_mag[:-2]) & (acc_mag[1:-1]>acc_mag[2:]))[0]
        count = max(1,len(peaks)//2)  # at least 1
        y_count.append(count)
        # agility score (scientific calculation)
        avg_speed = np.mean(acc_mag)
        peak_speed = np.max(acc_mag)
        consistency = 1 - (np.std(acc_mag)/ (avg_speed+1e-6))
        endurance = 1 - ((acc_mag[0]-acc_mag[-1])/(acc_mag[0]+1e-6))
        agility_score = 0.4*peak_speed + 0.3*avg_speed + 0.2*consistency + 0.1*endurance
        y_agility.append(agility_score)

    return np.stack(X), np.array(y_band), np.array(y_count), np.array(y_agility)

# ------------------ DATA AUGMENTATION ------------------
def augment_batch(batch):
    """Apply random Gaussian noise and small time shift"""
    X = batch.copy()
    noise = np.random.normal(0,0.02,X.shape)
    X += noise
    # small random circular shift
    shift = np.random.randint(-5,5)
    X = np.roll(X, shift, axis=1)
    return X

# ------------------ MODEL ------------------
def build_model(input_shape, num_classes=NUM_CLASSES):
    inp = layers.Input(shape=input_shape)
    x = layers.Conv1D(64,5,padding="same",activation="relu")(inp)
    x = layers.BatchNormalization()(x)
    x = layers.Conv1D(128,5,padding="same",activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling1D(2)(x)
    x = layers.Dropout(0.2)(x)
    x = layers.Bidirectional(layers.LSTM(128, return_sequences=True))(x)
    x = layers.Bidirectional(layers.LSTM(64, return_sequences=True))(x)

    # Multi-head attention
    attn = layers.Dense(1, activation="tanh")(x)
    attn = layers.Flatten()(attn)
    attn = layers.Activation("softmax")(attn)
    attn = layers.RepeatVector(x.shape[-1])(attn)
    attn = layers.Permute([2,1])(attn)
    x = layers.Multiply()([x, attn])
    x = layers.Lambda(lambda z: tf.reduce_sum(z, axis=1))(x)

    shared = layers.Dense(128,activation="relu")(x)
    shared = layers.Dropout(0.4)(shared)

    # Classification head
    band_out = layers.Dense(num_classes, activation="softmax", name="band_output")(shared)
    # Regression heads
    count_out = layers.Dense(1, activation="linear", name="count_output")(shared)
    agility_out = layers.Dense(1, activation="linear", name="agility_output")(shared)

    model = models.Model(inp,[band_out,count_out,agility_out])
    model.compile(
        optimizer=optimizers.Adam(LEARNING_RATE),
        loss={
            "band_output":"sparse_categorical_crossentropy",
            "count_output":"mse",
            "agility_output":"mse"
        },
        loss_weights={"band_output":1.0, "count_output":0.5, "agility_output":0.5},
        metrics={
            "band_output":"accuracy",
            "count_output":"mae",
            "agility_output":"mae"
        }
    )
    return model

# ------------------ TRAINING ------------------
def main():
    X, y_band, y_count, y_agility = load_sequences()
    mean,std = X.mean((0,1),keepdims=True), X.std((0,1),keepdims=True)+1e-8
    X = (X-mean)/std

    X_train,X_val, yb_train,yb_val, yc_train,yc_val, ya_train,ya_val = train_test_split(
        X, y_band, y_count, y_agility, test_size=0.18, stratify=y_band, random_state=SEED
    )

    classes = np.unique(yb_train)
    cw = compute_class_weight("balanced", classes=classes, y=yb_train)
    class_weight = {int(c): float(w) for c,w in zip(classes, cw)}

    train_ds = tf.data.Dataset.from_tensor_slices((X_train, {"band_output": yb_train,"count_output":yc_train,"agility_output":ya_train}))
    train_ds = train_ds.shuffle(2048, seed=SEED).batch(BATCH_SIZE).map(lambda x,y: (augment_batch(x),y)).prefetch(tf.data.AUTOTUNE)

    val_ds = tf.data.Dataset.from_tensor_slices((X_val, {"band_output": yb_val,"count_output":yc_val,"agility_output":ya_val})).batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)

    now = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    cb_list = [
        callbacks.ModelCheckpoint(MODELS_DIR/"shuttle_run_model_best.h5", monitor="val_band_output_accuracy", save_best_only=True, mode="max"),
        callbacks.EarlyStopping(monitor="val_loss", patience=12, restore_best_weights=True),
        callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=6, min_lr=1e-6),
        callbacks.TensorBoard(log_dir=str(LOGS_DIR/f"tb-{now}"), histogram_freq=1)
    ]

    model = build_model((SEQ_LEN,X.shape[2]))
    history = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS, class_weight={"band_output":class_weight}, callbacks=cb_list, verbose=1)

    # Save model + metadata
    model.save(MODELS_DIR/"shuttle_run_model.h5")
    meta = {
        "input_shape":[SEQ_LEN,X.shape[2]],
        "num_classes":NUM_CLASSES,
        "class_map":{v:k for k,v in LABEL_MAP.items()},
        "history":{k:[float(v) for v in vals] for k,vals in history.history.items()}
    }
    with open(MODELS_DIR/"shuttle_run_model_metadata.json","w") as fh:
        json.dump(meta,fh,indent=2)

    # Predict validation agility and count
    y_pred = model.predict(X_val)
    y_pred_count = np.clip(np.round(y_pred[1].flatten()),0,None)
    y_pred_agility = y_pred[2].flatten()
    print("Sample predicted agility scores:", y_pred_agility[:10])
    print("Sample predicted shuttle counts:", y_pred_count[:10])

if __name__=="__main__":
    main()
