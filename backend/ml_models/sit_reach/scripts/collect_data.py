import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import json
import joblib
from pathlib import Path
from datetime import datetime
import sys
sys.path.append(str(Path(__file__).parent.parent))

class SitReachModelTrainer:
    """Train sit & reach classification model"""
    
    def __init__(self):
        self.base_path = Path(__file__).parent.parent
        self.models_path = self.base_path / "models"
        self.models_path.mkdir(exist_ok=True)
        
        self.model = None
        self.scaler = StandardScaler()
        self.history = None
        
    def load_data(self, csv_path=None):
        """Load feature data from CSV"""
        if csv_path is None:
            csv_path = self.base_path / "data" / "features.csv"
        
        print(f"Loading data from: {csv_path}")
        df = pd.read_csv(csv_path)
        
        # Separate features and labels
        X = df.drop(['label', 'filename'], axis=1).values
        y = df['label'].values
        
        print(f"Loaded {len(X)} samples")
        print(f"Feature shape: {X.shape}")
        print(f"Class distribution: {np.bincount(y)}")
        
        return X, y, df.columns[:-2].tolist()  # Return feature names
    
    def create_model(self, input_shape):
        """Create neural network architecture"""
        model = keras.Sequential([
            # Input layer
            keras.layers.Dense(256, activation='relu', input_shape=(input_shape,)),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(0.3),
            
            # Hidden layers
            keras.layers.Dense(128, activation='relu'),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(0.3),
            
            keras.layers.Dense(64, activation='relu'),
            keras.layers.BatchNormalization(),
            keras.layers.Dropout(0.2),
            
            keras.layers.Dense(32, activation='relu'),
            
            # Output layer
            keras.layers.Dense(3, activation='softmax')
        ])
        
        # Compile model
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def train(self, X, y, feature_names):
        """Train the model with cross-validation"""
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Further split for validation
        X_train, X_val, y_train, y_val = train_test_split(
            X_train, y_train, test_size=0.2, random_state=42, stratify=y_train
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Create model
        self.model = self.create_model(X_train_scaled.shape[1])
        self.model.summary()
        
        # Callbacks
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=15,
                restore_best_weights=True
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=0.00001
            ),
            keras.callbacks.ModelCheckpoint(
                str(self.models_path / "best_model.h5"),
                monitor='val_accuracy',
                save_best_only=True
            )
        ]
        
        # Class weights for imbalanced data
        class_weights = self.calculate_class_weights(y_train)
        
        # Train model
        print("\nTraining model...")
        self.history = self.model.fit(
            X_train_scaled, y_train,
            validation_data=(X_val_scaled, y_val),
            epochs=100,
            batch_size=32,
            callbacks=callbacks,
            class_weight=class_weights,
            verbose=1
        )
        
        # Evaluate on test set
        print("\nEvaluating on test set...")
        test_loss, test_accuracy = self.model.evaluate(X_test_scaled, y_test)
        print(f"Test Accuracy: {test_accuracy:.4f}")
        
        # Detailed evaluation
        y_pred = np.argmax(self.model.predict(X_test_scaled), axis=1)
        self.evaluate_model(y_test, y_pred)
        
        # Save everything
        self.save_model(feature_names)
        
        return test_accuracy
    
    def calculate_class_weights(self, y):
        """Calculate class weights for imbalanced dataset"""
        from sklearn.utils.class_weight import compute_class_weight
        
        classes = np.unique(y)
        weights = compute_class_weight('balanced', classes=classes, y=y)
        return dict(zip(classes, weights))
    
    def evaluate_model(self, y_true, y_pred):
        """Comprehensive model evaluation"""
        # Classification report
        print("\nClassification Report:")
        print(classification_report(y_true, y_pred, 
                                  target_names=['Good Form', 'Needs Improvement', 'Poor Form']))
        
        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                    xticklabels=['Good', 'Needs Imp.', 'Poor'],
                    yticklabels=['Good', 'Needs Imp.', 'Poor'])
        plt.title('Confusion Matrix')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.savefig(self.models_path / 'confusion_matrix.png')
        plt.close()
    
    def plot_training_history(self):
        """Plot training history"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
        
        # Accuracy
        ax1.plot(self.history.history['accuracy'], label='Train')
        ax1.plot(self.history.history['val_accuracy'], label='Validation')
        ax1.set_title('Model Accuracy')
        ax1.set_xlabel('Epoch')
        ax1.set_ylabel('Accuracy')
        ax1.legend()
        ax1.grid(True)
        
        # Loss
                ax2.plot(self.history.history['loss'], label='Train')
        ax2.plot(self.history.history['val_loss'], label='Validation')
        ax2.set_title('Model Loss')
        ax2.set_xlabel('Epoch')
        ax2.set_ylabel('Loss')
        ax2.legend()
        ax2.grid(True)
        
        plt.tight_layout()
        plt.savefig(self.models_path / 'training_history.png')
        plt.close()
    
    def save_model(self, feature_names):
        """Save model, scaler, and metadata"""
        # Save model
        self.model.save(self.models_path / 'sit_reach_model.h5')
        
        # Save scaler
        joblib.dump(self.scaler, self.models_path / 'scaler.pkl')
        
        # Save metadata
        metadata = {
            'feature_names': feature_names,
            'num_features': len(feature_names),
            'classes': ['good_form', 'needs_improvement', 'poor_form'],
            'training_date': datetime.now().isoformat(),
            'model_version': '1.0',
            'accuracy': float(self.history.history['val_accuracy'][-1])
        }
        
        with open(self.models_path / 'model_metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Plot training history
        self.plot_training_history()
        
        print(f"\nModel saved to {self.models_path}")

if __name__ == "__main__":
    trainer = SitReachModelTrainer()
    
    # Load data
    X, y, feature_names = trainer.load_data()
    
    # Train model
    accuracy = trainer.train(X, y, feature_names)
    
    print(f"\nTraining complete! Final accuracy: {accuracy:.4f}")
