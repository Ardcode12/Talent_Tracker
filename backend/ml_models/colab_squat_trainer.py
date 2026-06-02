"""
=============================================================
SQUAT FORM CLASSIFIER - Training Script (Google Colab)
=============================================================
Dataset: CSV with pose-based features extracted via MediaPipe
Labels: 0=Correct, 1=Shallow, 2=Forward Lean, 
        3=Knees Caving, 4=Heels Off, 5=Asymmetric

Output files (download these to backend/ml_models/):
  - squat_classifier.keras
  - squat_classifier.tflite  
  - squat_scaler.pkl
  - squat_model_config.json

SETUP IN COLAB:
  !pip install tensorflow scikit-learn joblib pandas seaborn
  # Upload your CSV file, then run this script
=============================================================
"""

import os, json, warnings
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Dense, Dropout, BatchNormalization, Input
)
from tensorflow.keras.callbacks import (
    EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
)
from sklearn.model_selection import train_test_split
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
LABEL_MAP = {
    0: "Correct",
    1: "Shallow Squat",
    2: "Forward Lean",
    3: "Knees Caving In",
    4: "Heels Off Ground",
    5: "Asymmetric Squat"
}
NUM_CLASSES = len(LABEL_MAP)

# Columns to DROP (not features - they are metadata)
META_COLUMNS = ['video_filename', 'frame_number', 'frame_num', 'filename', 
                'video', 'file', 'label', 'class', 'target', 'Label',
                'Unnamed: 0', 'index']

# =============================================
# LOAD & PREPARE DATA
# =============================================
def load_dataset(csv_path):
    """Load CSV and split into features / labels"""
    print(f"Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path)
    
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"\nFirst 3 rows:")
    print(df.head(3))
    print(f"\nData types:\n{df.dtypes}")
    
    # Auto-detect label column
    label_col = None
    for candidate in ['label', 'Label', 'class', 'target', 'CLASS', 'TARGET']:
        if candidate in df.columns:
            label_col = candidate
            break
    
    if label_col is None:
        raise ValueError(
            f"Could not find label column. Columns found: {list(df.columns)}\n"
            "Please rename your label column to 'label'"
        )
    
    print(f"\nLabel column: '{label_col}'")
    print(f"Label distribution:\n{df[label_col].value_counts().sort_index()}")
    
    # Separate features and labels
    y = df[label_col].values.astype(int)
    
    # Drop non-feature columns
    drop_cols = [c for c in META_COLUMNS if c in df.columns]
    X_df = df.drop(columns=drop_cols, errors='ignore')
    
    # Drop any remaining non-numeric columns
    non_numeric = X_df.select_dtypes(exclude=[np.number]).columns.tolist()
    if non_numeric:
        print(f"Dropping non-numeric columns: {non_numeric}")
        X_df = X_df.drop(columns=non_numeric)
    
    # Handle missing values
    X_df = X_df.fillna(0)
    
    feature_names = list(X_df.columns)
    X = X_df.values.astype(np.float32)
    
    print(f"\nFinal feature count: {X.shape[1]}")
    print(f"Feature names: {feature_names}")
    print(f"Total samples: {len(y)}")
    
    return X, y, feature_names


# =============================================
# MODEL ARCHITECTURE (Multi-output)
# =============================================
def build_model(input_dim):
    """
    Dual-output model:
      1. Form classification (6 classes)
      2. Quality score regression (0-1)
    """
    inp = Input(shape=(input_dim,), name='features')
    
    # Shared layers
    x = Dense(256, activation='relu')(inp)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    
    x = Dense(128, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.3)(x)
    
    x = Dense(64, activation='relu')(x)
    x = BatchNormalization()(x)
    x = Dropout(0.2)(x)
    
    shared = Dense(32, activation='relu')(x)
    
    # Head 1: Form classification (6 classes)
    cls_branch = Dense(32, activation='relu')(shared)
    cls_out = Dense(NUM_CLASSES, activation='softmax', name='form_class')(cls_branch)
    
    # Head 2: Quality score (0-1, where 1 = perfect form)
    reg_branch = Dense(32, activation='relu')(shared)
    reg_out = Dense(1, activation='sigmoid', name='quality_score')(reg_branch)
    
    model = Model(inputs=inp, outputs=[cls_out, reg_out])
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss={
            'form_class': 'sparse_categorical_crossentropy',
            'quality_score': 'mse'
        },
        loss_weights={'form_class': 1.0, 'quality_score': 0.5},
        metrics={
            'form_class': 'accuracy',
            'quality_score': 'mae'
        }
    )
    return model


# =============================================
# SCORE GENERATOR
# =============================================
def labels_to_scores(y):
    """
    Convert class labels to quality scores (0-1).
    Class 0 (Correct) = high score, errors = lower scores.
    """
    score_map = {
        0: 0.90,  # Correct form → 85-95%
        1: 0.50,  # Shallow → 40-60%
        2: 0.45,  # Forward lean → 35-55%
        3: 0.40,  # Knees caving → 30-50%
        4: 0.35,  # Heels off → 25-45%
        5: 0.42,  # Asymmetric → 32-52%
    }
    scores = []
    for label in y:
        base = score_map.get(label, 0.5)
        noise = np.random.uniform(-0.08, 0.08)
        scores.append(np.clip(base + noise, 0.05, 1.0))
    return np.array(scores, dtype=np.float32)


# =============================================
# FEEDBACK GENERATOR
# =============================================
def generate_feedback(pred_class, pred_score, confidence, feature_values=None, feature_names=None):
    """
    Generate actionable training suggestions based on prediction.
    This function will be used in the backend after deployment.
    """
    score_pct = pred_score * 100
    form_label = LABEL_MAP.get(pred_class, "Unknown")
    
    # Base feedback per form error
    FORM_FEEDBACK = {
        0: {  # Correct
            "summary": "Excellent squat form!",
            "suggestions": [
                "Maintain this form consistency across all reps",
                "Gradually increase weight or reps to progress",
                "Focus on controlled tempo (2s down, 1s pause, 2s up)"
            ]
        },
        1: {  # Shallow
            "summary": "Squat depth is insufficient",
            "suggestions": [
                "Aim to bring thighs parallel to the ground or lower",
                "Practice box squats to learn proper depth",
                "Work on ankle mobility with calf stretches",
                "Use a mirror or record yourself to check depth"
            ]
        },
        2: {  # Forward Lean
            "summary": "Excessive forward lean detected",
            "suggestions": [
                "Strengthen your upper back with rows and face pulls",
                "Keep chest up and eyes forward during the squat",
                "Work on thoracic spine mobility",
                "Try front squats to improve upright posture",
                "Stretch hip flexors before squatting"
            ]
        },
        3: {  # Knees Caving In
            "summary": "Knee valgus (knees caving inward) detected",
            "suggestions": [
                "Strengthen glutes with hip abduction exercises",
                "Use a resistance band above knees during warm-up squats",
                "Focus on pushing knees out over toes",
                "Add single-leg glute bridges to your routine",
                "Consider reducing weight until form improves"
            ]
        },
        4: {  # Heels Off Ground
            "summary": "Heels lifting off the ground during squat",
            "suggestions": [
                "Work on ankle dorsiflexion mobility",
                "Try elevating heels with small plates or squat shoes",
                "Perform calf stretches and foam rolling before squats",
                "Widen your stance slightly",
                "Practice goblet squats to improve balance"
            ]
        },
        5: {  # Asymmetric
            "summary": "Asymmetric movement pattern detected",
            "suggestions": [
                "Add single-leg exercises (Bulgarian split squats, lunges)",
                "Check for muscle imbalances with a physiotherapist",
                "Use lighter weight and focus on even distribution",
                "Film squats from behind to identify the weaker side",
                "Incorporate unilateral leg press work"
            ]
        }
    }
    
    feedback_data = FORM_FEEDBACK.get(pred_class, FORM_FEEDBACK[0])
    
    # Analyze specific features if available
    feature_insights = []
    if feature_values is not None and feature_names is not None:
        feat_dict = dict(zip(feature_names, feature_values))
        
        # Check knee angles
        for col in feature_names:
            col_lower = col.lower()
            val = feat_dict[col]
            
            if 'knee' in col_lower and 'angle' in col_lower:
                if val > 120:
                    feature_insights.append(f"Knee angle ({val:.1f}°) indicates shallow depth")
                elif val < 70:
                    feature_insights.append(f"Knee angle ({val:.1f}°) shows deep squat - watch for knee stress")
            
            elif 'hip' in col_lower and 'angle' in col_lower:
                if val < 60:
                    feature_insights.append(f"Hip angle ({val:.1f}°) shows excessive forward lean")
            
            elif 'spine' in col_lower or 'torso' in col_lower:
                if isinstance(val, (int, float)) and abs(val) > 20:
                    feature_insights.append(f"Torso/spine deviation detected ({val:.1f}°)")
            
            elif 'symmetry' in col_lower:
                if isinstance(val, (int, float)) and val < 0.8:
                    feature_insights.append(f"Low symmetry score ({val:.2f}) - work on balance")
    
    return {
        "score": round(score_pct, 1),
        "quality": form_label,
        "is_correct_form": pred_class == 0,
        "confidence": round(float(confidence) * 100, 1),
        "summary": feedback_data["summary"],
        "suggestions": feedback_data["suggestions"],
        "feature_insights": feature_insights,
        "form_errors_detected": [] if pred_class == 0 else [form_label]
    }


# =============================================
# VISUALIZATION
# =============================================
def plot_training_history(history):
    """Plot training curves"""
    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    
    # Loss
    axes[0].plot(history.history['loss'], label='Train Loss')
    axes[0].plot(history.history['val_loss'], label='Val Loss')
    axes[0].set_title('Total Loss')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)
    
    # Classification Accuracy
    axes[1].plot(history.history['form_class_accuracy'], label='Train Acc')
    axes[1].plot(history.history['val_form_class_accuracy'], label='Val Acc')
    axes[1].set_title('Form Classification Accuracy')
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)
    
    # Score MAE
    axes[2].plot(history.history['quality_score_mae'], label='Train MAE')
    axes[2].plot(history.history['val_quality_score_mae'], label='Val MAE')
    axes[2].set_title('Quality Score MAE')
    axes[2].legend()
    axes[2].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('training_curves.png', dpi=150)
    plt.show()
    print("Saved: training_curves.png")


def plot_confusion_matrix(y_true, y_pred):
    """Plot confusion matrix"""
    cm = confusion_matrix(y_true, y_pred)
    labels = [LABEL_MAP[i] for i in range(NUM_CLASSES)]
    
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=labels, yticklabels=labels)
    plt.title('Squat Form Classification - Confusion Matrix')
    plt.ylabel('Actual')
    plt.xlabel('Predicted')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig('confusion_matrix.png', dpi=150)
    plt.show()
    print("Saved: confusion_matrix.png")


# =============================================
# MAIN TRAINING
# =============================================
def main():
    print("=" * 60)
    print("  SQUAT FORM CLASSIFIER - TRAINING PIPELINE")
    print("=" * 60)
    
    # ---- CHANGE THIS to your CSV path in Colab ----
    CSV_PATH = "squat_dataset.csv"  
    # e.g., "/content/squat_dataset.csv" in Colab
    
    if not os.path.exists(CSV_PATH):
        print(f"\nERROR: CSV file not found at: {CSV_PATH}")
        print("Please upload your CSV and update CSV_PATH")
        print("Example: CSV_PATH = '/content/your_file.csv'")
        return
    
    # Step 1: Load data
    X, y, feature_names = load_dataset(CSV_PATH)
    
    # Step 2: Generate quality scores from labels
    y_scores = labels_to_scores(y)
    
    # Step 3: Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Step 4: Split
    X_train, X_val, yc_train, yc_val, ys_train, ys_val = train_test_split(
        X_scaled, y, y_scores, test_size=0.2, stratify=y, random_state=42
    )
    print(f"\nTrain: {len(X_train)} | Val: {len(X_val)}")
    
    # Step 5: Build model
    model = build_model(X_train.shape[1])
    model.summary()
    
    # Step 6: Train
    callbacks = [
        EarlyStopping(monitor='val_loss', patience=20, restore_best_weights=True),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=7, min_lr=1e-6),
        ModelCheckpoint('best_squat_model.keras', monitor='val_loss', save_best_only=True)
    ]
    
    history = model.fit(
        X_train,
        {'form_class': yc_train, 'quality_score': ys_train},
        validation_data=(X_val, {'form_class': yc_val, 'quality_score': ys_val}),
        epochs=150,
        batch_size=32,
        callbacks=callbacks,
        verbose=1
    )
    
    # Step 7: Evaluate
    print("\n" + "=" * 60)
    print("  EVALUATION RESULTS")
    print("=" * 60)
    
    results = model.evaluate(
        X_val, {'form_class': yc_val, 'quality_score': ys_val}, verbose=0
    )
    print(f"Total Loss: {results[0]:.4f}")
    print(f"Classification Accuracy: {results[3]*100:.1f}%")
    print(f"Score MAE: {results[4]:.4f}")
    
    # Detailed classification report
    cls_preds, score_preds = model.predict(X_val, verbose=0)
    y_pred = np.argmax(cls_preds, axis=1)
    
    print(f"\nClassification Report:")
    target_names = [LABEL_MAP[i] for i in range(NUM_CLASSES)]
    # Only include classes present in data
    present_classes = sorted(set(yc_val) | set(y_pred))
    present_names = [LABEL_MAP[i] for i in present_classes]
    print(classification_report(yc_val, y_pred, 
                                labels=present_classes,
                                target_names=present_names))
    
    # Step 8: Plots
    plot_training_history(history)
    plot_confusion_matrix(yc_val, y_pred)
    
    # Step 9: Save everything
    print("\n" + "=" * 60)
    print("  SAVING MODELS")
    print("=" * 60)
    
    model.save('squat_classifier.keras')
    joblib.dump(scaler, 'squat_scaler.pkl')
    
    # TFLite
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    with open('squat_classifier.tflite', 'wb') as f:
        f.write(tflite_model)
    tflite_size = os.path.getsize('squat_classifier.tflite') / 1024
    
    # Config
    config = {
        "model_type": "squat_form_classifier",
        "version": "2.0",
        "input_features": len(feature_names),
        "feature_names": feature_names,
        "num_classes": NUM_CLASSES,
        "label_map": {str(k): v for k, v in LABEL_MAP.items()},
        "outputs": {
            "form_class": "6-class softmax (squat form type)",
            "quality_score": "sigmoid 0-1 (multiply by 100 for percentage)"
        }
    }
    with open('squat_model_config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"  squat_classifier.keras  - Full Keras model")
    print(f"  squat_classifier.tflite - Lite model ({tflite_size:.1f} KB)")
    print(f"  squat_scaler.pkl        - Feature scaler")
    print(f"  squat_model_config.json - Model config")
    print(f"  training_curves.png     - Training plots")
    print(f"  confusion_matrix.png    - Confusion matrix")
    
    # Step 10: Demo prediction with feedback
    print("\n" + "=" * 60)
    print("  DEMO PREDICTIONS WITH FEEDBACK")
    print("=" * 60)
    
    for i in range(min(5, len(X_val))):
        sample = X_val[i:i+1]
        cls_pred, score_pred = model.predict(sample, verbose=0)
        pred_class = np.argmax(cls_pred[0])
        pred_score = score_pred[0][0]
        confidence = cls_pred[0][pred_class]
        
        # Unscale features for analysis
        raw_features = scaler.inverse_transform(sample)[0]
        
        feedback = generate_feedback(
            pred_class, pred_score, confidence,
            raw_features, feature_names
        )
        
        print(f"\nSample {i+1} (Actual: {LABEL_MAP[yc_val[i]]}):")
        print(f"  Predicted: {feedback['quality']} ({feedback['confidence']}% conf)")
        print(f"  Score: {feedback['score']}%")
        print(f"  Summary: {feedback['summary']}")
        print(f"  Suggestions:")
        for s in feedback['suggestions'][:3]:
            print(f"    - {s}")
    
    print("\n✅ TRAINING COMPLETE! Download the 4 model files to your backend.")


if __name__ == "__main__":
    main()
