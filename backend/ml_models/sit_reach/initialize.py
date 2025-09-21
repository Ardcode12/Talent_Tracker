#!/usr/bin/env python3
"""Initialize sit & reach model with synthetic data"""

from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent))

from scripts.generate_synthetic_data import SyntheticDataGenerator
from scripts.train_model import SitReachModelTrainer

def initialize_sit_reach_model():
    """Initialize the sit & reach model"""
    print("Initializing Sit & Reach Model...")
    
    # Step 1: Generate synthetic data
    print("\n1. Generating synthetic training data...")
    generator = SyntheticDataGenerator()
    X, y = generator.generate_dataset(num_samples_per_class=500)
    
    # Step 2: Train model
    print("\n2. Training model...")
    trainer = SitReachModelTrainer()
    
    # Use synthetic data for initial training
    feature_names = [f"feature_{i}" for i in range(X.shape[1])]
    accuracy = trainer.train(X, y, feature_names)
    
    print(f"\n✅ Model initialized successfully!")
    print(f"   Final accuracy: {accuracy:.4f}")
    print(f"   Model saved to: {trainer.models_path}")
    
    return accuracy

if __name__ == "__main__":
    initialize_sit_reach_model()
