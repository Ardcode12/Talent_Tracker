# scripts/train_model.py
"""
Train 10m x 4 shuttle run model:
- Conv1D + BiLSTM + Attention
- Dual regression heads: shuttle_count, agility_score
- Classification head: performance_band
- Derived features: acc_mag, jerk, RMS, directional velocity
- Data augmentation (noise + window shift)
- Uses static athlete features (age, gender, height_cm, weight_kg, etc.)
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
BATCH_SIZE = 32
EPOCHS = 80
LEARNING_RATE = 1e-3
SEED = 42
NUM_CLASSES = 3
tf.random.set_seed(SEED)
np.random.seed(SEED)

LABEL_MAP = {"low": 0, "medium": 1, "high": 2}
SENSOR_COLS = ["acc_x","acc_y","acc_z","gyro_x","gyro_y","gyro_z"]

# ------------------ STATIC (ATHLETE) COLUMNS ------------------
STATIC_COLS = [
    "age","gender","height_cm","weight_kg","stride_length_cm","stride_frequency_hz",
    "reaction_time_ms","change_of_direction_deficit","coordination_score","balance_score",
    "agility_rating","hr_baseline_bpm","hr_peak_bpm","hr_recovery_30s_bpm"
]

# ------------------ FEATURE ENGINEERING ------------------
def derive_features(df):
    acc = df[["acc_x","acc_y","acc_z"]].to_numpy(dtype=np.float32)
    gyro = df[["gyro_x","gyro_y","gyro_z"]].to_numpy(dtype=np.float32)
    acc_mag = np.linalg.norm(acc, axis=1, keepdims=True)
    jerk = np.diff(acc_mag, prepend=acc_mag[0:1], axis=0)
    rms_acc = np.sqrt(pd.Series(acc_mag.flatten()).rolling(window=5,min_periods=1).mean().to_numpy()).reshape(-1,1)
    vel_y = np.cumsum(acc[:,1:2], axis=0)
    features = np.hstack([acc, gyro, acc_mag, jerk, rms_acc, vel_y])
    return features.astype(np.float32)

# ------------------ DATA LOADING ------------------
def safe_get(df, col, default=np.nan):
    return df[col].iloc[0] if (col in df.columns and not df[col].isnull().all()) else default

def load_sequences(seq_len=SEQ_LEN):
    X_seq, X_static, y_band, y_count, y_agility = [], [], [], [], []
    csv_files = sorted(RAW_DIR.glob("trial_*.csv"))
    if len(csv_files) == 0:
        raise FileNotFoundError(f"No files found in {RAW_DIR}")

    for f in csv_files:
        df = pd.read_csv(f).sort_values("timestamp_ms").reset_index(drop=True)
        arr = derive_features(df)
        T, feat_dim = arr.shape
        arr_padded = arr if T >= seq_len else np.vstack([arr, np.zeros((seq_len-T, feat_dim), dtype=np.float32)])
        X_seq.append(arr_padded)

        static_vals = []
        for col in STATIC_COLS:
            if col == "gender":
                raw = safe_get(df, col, default="unknown")
                if pd.isna(raw): g = 2
                else:
                    s = str(raw).strip().lower()
                    g = 1 if s in ("female","f") else 0 if s in ("male","m") else 2
                static_vals.append(float(g))
            else:
                v = safe_get(df, col, default=np.nan)
                static_vals.append(float(v) if not pd.isna(v) else 0.0)
        X_static.append(np.array(static_vals, dtype=np.float32))

        band = safe_get(df, "performance_band", default="low")
        y_band.append(LABEL_MAP.get(str(band).strip().lower(), 0))

        acc_mag = np.linalg.norm(df[["acc_x","acc_y","acc_z"]].to_numpy(), axis=1)
        if acc_mag.size < 3: peaks = np.array([], dtype=int)
        else:
            med = np.median(acc_mag)
            th = med + 0.5*(np.std(acc_mag)+1e-6)
            peaks = np.where((acc_mag[1:-1]>acc_mag[:-2]) & (acc_mag[1:-1]>acc_mag[2:]) & (acc_mag[1:-1]>th))[0]+1
        y_count.append(float(max(1,len(peaks)//2)))

        avg_speed = float(np.mean(acc_mag)) if acc_mag.size>0 else 0.0
        peak_speed = float(np.max(acc_mag)) if acc_mag.size>0 else 0.0
        consistency = 1.0 - (np.std(acc_mag)/(avg_speed+1e-6)) if avg_speed>0 else 0.0
        endurance = 1.0 - ((acc_mag[0]-acc_mag[-1])/(acc_mag[0]+1e-6)) if acc_mag.size>1 else 0.0
        y_agility.append(float(0.4*peak_speed+0.3*avg_speed+0.2*consistency+0.1*endurance))

    return (np.stack(X_seq), np.stack(X_static),
            np.array(y_band,dtype=np.int32),
            np.array(y_count,dtype=np.float32),
            np.array(y_agility,dtype=np.float32))

# ------------------ DATA AUGMENTATION ------------------
def augment_batch(batch, seed=None):
    if seed is not None: np.random.seed(seed)
    X = batch.copy()
    X += np.random.normal(0,0.02,X.shape).astype(X.dtype)
    for i in range(X.shape[0]):
        shift = np.random.randint(-5,6)
        if shift!=0: X[i] = np.roll(X[i], shift, axis=0)
    return X

# ------------------ MODEL ------------------
def attention_block(x):
    scores = layers.Dense(1,use_bias=False)(x)
    scores = layers.Flatten()(scores)
    alpha = layers.Activation("softmax")(scores)
    alpha = layers.Reshape((-1,1))(alpha)
    weighted = layers.Multiply()([x,alpha])
    return tf.reduce_sum(weighted, axis=1)

def build_model(input_shape, static_shape, num_classes=NUM_CLASSES):
    seq_inp = layers.Input(shape=input_shape,name="seq_input")
    x = layers.Conv1D(64,5,padding="same",activation="relu")(seq_inp)
    x = layers.BatchNormalization()(x)
    x = layers.Conv1D(128,5,padding="same",activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling1D(2)(x)
    x = layers.Dropout(0.2)(x)
    x = layers.Bidirectional(layers.LSTM(128,return_sequences=True))(x)
    x = layers.Bidirectional(layers.LSTM(64,return_sequences=True))(x)
    x_att = layers.Lambda(lambda z: attention_block(z), name="att_pool")(x)

    static_inp = layers.Input(shape=(static_shape,), name="static_input")
    s = layers.Dense(64,activation="relu")(static_inp)
    s = layers.BatchNormalization()(s)
    s = layers.Dropout(0.2)(s)

    combined = layers.Concatenate()([x_att,s])
    shared = layers.Dense(256,activation="relu")(combined)
    shared = layers.Dropout(0.4)(shared)
    shared = layers.Dense(128,activation="relu")(shared)

    band_out = layers.Dense(num_classes,activation="softmax",name="band_output")(shared)
    count_out = layers.Dense(1,activation="linear",name="count_output")(shared)
    agility_out = layers.Dense(1,activation="linear",name="agility_output")(shared)

    model = models.Model(inputs=[seq_inp,static_inp], outputs=[band_out,count_out,agility_out])
    model.compile(
        optimizer=optimizers.Adam(LEARNING_RATE),
        loss={"band_output":"sparse_categorical_crossentropy",
              "count_output":"mse",
              "agility_output":"mse"},
        loss_weights={"band_output":1.0,"count_output":0.5,"agility_output":0.5},
        metrics={"band_output":"accuracy","count_output":"mae","agility_output":"mae"}
    )
    return model

# ------------------ TRAINING ------------------
def main():
    print("Loading sequences...")
    X_seq, X_static, y_band, y_count, y_agility = load_sequences()

    # Normalize
    ts_mean = X_seq.mean(axis=(0,1), keepdims=True)
    ts_std = X_seq.std(axis=(0,1), keepdims=True)+1e-8
    X_seq_norm = (X_seq-ts_mean)/ts_std

    static_mean = X_static.mean(axis=0, keepdims=True)
    static_std = X_static.std(axis=0, keepdims=True)+1e-8
    X_static_norm = (X_static-static_mean)/static_std

    # Train/validation split
    Xs_train, Xs_val, Xst_train, Xst_val, yb_train, yb_val, yc_train, yc_val, ya_train, ya_val = train_test_split(
        X_seq_norm, X_static_norm, y_band, y_count, y_agility,
        test_size=0.18, stratify=y_band, random_state=SEED
    )

    # Compute class weights and sample weights
    classes = np.unique(yb_train)
    cw = compute_class_weight("balanced", classes=classes, y=yb_train)
    class_weight_dict = {int(c): float(w) for c,w in zip(classes,cw)}
    print("Class weights (band_output):", class_weight_dict)

    sample_weights = np.array([class_weight_dict[int(c)] for c in yb_train], dtype=np.float32)

    # Dataset with sample weights
    def make_train_ds(X_seq_array,X_static_array,yb,yc,ya,sw):
        dataset = tf.data.Dataset.from_tensor_slices(
            ((X_seq_array, X_static_array),
             {"band_output": yb, "count_output": yc, "agility_output": ya},
             {"band_output": sw})
        )
        dataset = dataset.shuffle(2048, seed=SEED).batch(BATCH_SIZE)
        def aug_map(inputs, labels, weights):
            seqs, stat = inputs
            def py_aug(arr): return augment_batch(arr)
            seqs_aug = tf.numpy_function(py_aug,[seqs],tf.float32)
            seqs_aug.set_shape(seqs.shape)
            return (seqs_aug, stat), labels, weights
        return dataset.map(aug_map, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)

    train_ds = make_train_ds(Xs_train, Xst_train, yb_train, yc_train, ya_train, sample_weights)
    val_ds = tf.data.Dataset.from_tensor_slices(
        ((Xs_val, Xst_val),
         {"band_output": yb_val, "count_output": yc_val, "agility_output": ya_val})
    ).batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)

    # Callbacks
    now = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    cb_list = [
        callbacks.ModelCheckpoint(MODELS_DIR/"shuttle_run_model_best.keras",
                                  monitor="val_band_output_accuracy", save_best_only=True, mode="max"),
        callbacks.EarlyStopping(monitor="val_loss", patience=12, restore_best_weights=True),
        callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=6, min_lr=1e-6),
        callbacks.TensorBoard(log_dir=str(LOGS_DIR/f"tb-{now}"), histogram_freq=1)
    ]

    # Build and train
    model = build_model((SEQ_LEN,X_seq.shape[2]), X_static.shape[1])
    model.summary()

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS,
        callbacks=cb_list,
        verbose=1
    )

    # Save model & scalers
    model.save(MODELS_DIR/"shuttle_run_model.h5")
    joblib.dump({"ts_mean":ts_mean,"ts_std":ts_std,"static_mean":static_mean,"static_std":static_std},
                MODELS_DIR/"shuttle_run_scalers.pkl")

    # Metadata
    meta = {
        "input_shape":[SEQ_LEN,X_seq.shape[2]],
        "static_features":STATIC_COLS,
        "num_classes":NUM_CLASSES,
        "class_map":{v:k for k,v in LABEL_MAP.items()},
        "history":{k:[float(v) for v in vals] for k,vals in history.history.items()}
    }
    with open(MODELS_DIR/"shuttle_run_model_metadata.json","w") as fh:
        json.dump(meta, fh, indent=2)

    # Quick validation check
    print("Running quick validation predictions...")
    val_preds = model.predict((Xs_val,Xst_val), batch_size=32)
    pred_band = np.argmax(val_preds[0], axis=1)
    pred_count = np.clip(np.round(val_preds[1].flatten()),0,None)
    pred_agility = val_preds[2].flatten()
    print("Sample predicted agility scores:", pred_agility[:10])
    print("Sample predicted shuttle counts:", pred_count[:10])
    print("Sample predicted bands:", pred_band[:10])

if __name__=="__main__":
    main()
