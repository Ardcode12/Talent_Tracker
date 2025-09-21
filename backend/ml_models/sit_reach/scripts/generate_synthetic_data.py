import numpy as np
import pandas as pd
from pathlib import Path
import json
from datetime import datetime

class SyntheticDataGenerator:
    """Generate synthetic training data for sit & reach model"""
    
    def __init__(self):
        self.base_path = Path(__file__).parent.parent
        self.num_landmarks = 17  # Key landmarks we're tracking
        self.features_per_landmark = 4  # x, y, z, visibility
        self.num_angles = 7  # Number of calculated angles
        self.num_distances = 9  # Number of calculated distances
        self.num_alignment = 5  # Number of alignment features
        
        self.total_features = (self.num_landmarks * self.features_per_landmark + 
                              self.num_angles + self.num_distances + self.num_alignment)
    
    def generate_good_form_sample(self):
        """Generate sample with good form characteristics"""
        features = []
        
        # Landmark positions (normalized 0-1)
        # Good form: straight legs, proper hip flexion, reaching past toes
        for i in range(self.num_landmarks):
            x = np.random.normal(0.5, 0.1)  # Centered
            y = np.random.normal(0.5, 0.1)  # Appropriate height
            z = np.random.normal(0.0, 0.02)  # Minimal depth variation
            visibility = np.random.uniform(0.9, 1.0)  # High visibility
            features.extend([x, y, z, visibility])
        
        # Angles (in degrees)
        # Good form angles
        hip_angles = [np.random.normal(100, 5), np.random.normal(100, 5)]  # Good hip flexion
        knee_angles = [np.random.normal(175, 3), np.random.normal(175, 3)]  # Straight knees
        spine_angle = np.random.normal(170, 5)  # Relatively straight spine
        arm_angles = [np.random.normal(170, 5), np.random.normal(170, 5)]  # Extended arms
        
        features.extend(hip_angles + knee_angles + [spine_angle] + arm_angles)
        
        # Distances
        # Good reach (positive values = past toes)
        reach_distances = [
            np.random.normal(0.05, 0.02),  # Left wrist past ankle
            np.random.normal(0.08, 0.02),  # Left wrist past foot
            np.random.normal(0.05, 0.02),  # Right wrist past ankle
            np.random.normal(0.08, 0.02),  # Right wrist past foot
        ]
        
        # Other distances
        wrist_hip_height = np.random.normal(-0.3, 0.05)  # Wrists below hips
        torso_length = np.random.normal(0.4, 0.02)
        leg_length = np.random.normal(0.5, 0.02)
        torso_leg_ratio = torso_length / leg_length
        
        features.extend(reach_distances + [wrist_hip_height, torso_length, 
                                          leg_length, torso_leg_ratio, 0])
        
        # Alignment features (small values = good alignment)
        shoulder_tilt = np.random.normal(0.01, 0.005)
        hip_tilt = np.random.normal(0.01, 0.005)
        knee_alignment = np.random.normal(0.01, 0.005)
        com_deviation = np.random.normal(0.02, 0.01)
        com_y = np.random.normal(0.4, 0.05)
        
        features.extend([shoulder_tilt, hip_tilt, knee_alignment, com_deviation, com_y])
        
        return np.array(features)
    
    def generate_needs_improvement_sample(self):
        """Generate sample with moderate form issues"""
        features = []
        
        # Landmarks with more variation
        for i in range(self.num_landmarks):
            x = np.random.normal(0.5, 0.15)
            y = np.random.normal(0.5, 0.15)
            z = np.random.normal(0.0, 0.05)
            visibility = np.random.uniform(0.8, 0.95)
            features.extend([x, y, z, visibility])
        
        # Angles with moderate issues
        hip_angles = [np.random.normal(120, 10), np.random.normal(120, 10)]  # Less hip flexion
        knee_angles = [np.random.normal(160, 10), np.random.normal(160, 10)]  # Slightly bent knees
        spine_angle = np.random.normal(150, 10)  # More curved spine
        arm_angles = [np.random.normal(160, 10), np.random.normal(160, 10)]
        
        features.extend(hip_angles + knee_angles + [spine_angle] + arm_angles)
        
        # Moderate reach
        reach_distances = [
            np.random.normal(-0.05, 0.03),  # Near ankles
            np.random.normal(-0.02, 0.03),  # Near feet
            np.random.normal(-0.05, 0.03),
            np.random.normal(-0.02, 0.03),
        ]
        
        wrist_hip_height = np.random.normal(-0.2, 0.08)
        torso_length = np.random.normal(0.4, 0.03)
        leg_length = np.random.normal(0.5, 0.03)
        torso_leg_ratio = torso_length / leg_length
        
        features.extend(reach_distances + [wrist_hip_height, torso_length,
                                          leg_length, torso_leg_ratio, 0])
        
        # Moderate alignment issues
        shoulder_tilt = np.random.normal(0.03, 0.01)
        hip_tilt = np.random.normal(0.03, 0.01)
        knee_alignment = np.random.normal(0.03, 0.01)
        com_deviation = np.random.normal(0.05, 0.02)
        com_y = np.random.normal(0.45, 0.08)
        
        features.extend([shoulder_tilt, hip_tilt, knee_alignment, com_deviation, com_y])
        
        return np.array(features)
    
    def generate_poor_form_sample(self):
        """Generate sample with poor form"""
        features = []
        
        # Landmarks with high variation
        for i in range(self.num_landmarks):
            x = np.random.normal(0.5, 0.2)
            y = np.random.normal(0.5, 0.2)
            z = np.random.normal(0.0, 0.1)
            visibility = np.random.uniform(0.7, 0.9)
            features.extend([x, y, z, visibility])
        
        # Poor form angles
        hip_angles = [np.random.normal(140, 15), np.random.normal(140, 15)]  # Poor hip flexion
        knee_angles = [np.random.normal(140, 15), np.random.normal(140, 15)]  # Bent knees
        spine_angle = np.random.normal(130, 15)  # Very curved spine
        arm_angles = [np.random.normal(140, 15), np.random.normal(140, 15)]
        
        features.extend(hip_angles + knee_angles + [spine_angle] + arm_angles)
        
        # Poor reach
        reach_distances = [
            np.random.normal(-0.15, 0.05),  # Far from ankles
            np.random.normal(-0.12, 0.05),  # Far from feet
            np.random.normal(-0.15, 0.05),
            np.random.normal(-0.12, 0.05),
        ]
        
        wrist_hip_height = np.random.normal(-0.1, 0.1)
        torso_length = np.random.normal(0.4, 0.05)
        leg_length = np.random.normal(0.5, 0.05)
        torso_leg_ratio = torso_length / leg_length
        
        features.extend(reach_distances + [wrist_hip_height, torso_length,
                                          leg_length, torso_leg_ratio, 0])
        
        # Poor alignment
        shoulder_tilt = np.random.normal(0.06, 0.02)
        hip_tilt = np.random.normal(0.06, 0.02)
        knee_alignment = np.random.normal(0.06, 0.02)
        com_deviation = np.random.normal(0.08, 0.03)
        com_y = np.random.normal(0.5, 0.1)
        
        features.extend([shoulder_tilt, hip_tilt, knee_alignment, com_deviation, com_y])
        
        return np.array(features)
    
    def generate_dataset(self, num_samples_per_class=500):
        """Generate complete synthetic dataset"""
        print(f"Generating synthetic dataset with {num_samples_per_class} samples per class...")
        
        data = []
        labels = []
        
        # Generate good form samples
        for i in range(num_samples_per_class):
            data.append(self.generate_good_form_sample())
            labels.append(0)
        
        # Generate needs improvement samples
        for i in range(num_samples_per_class):
            data.append(self.generate_needs_improvement_sample())
            labels.append(1)
        
        # Generate poor form samples
        for i in range(num_samples_per_class):
            data.append(self.generate_poor_form_sample())
            labels.append(2)
        
        # Convert to numpy arrays
        X = np.array(data)
        y = np.array(labels)
        
        # Shuffle
        indices = np.random.permutation(len(X))
        X = X[indices]
        y = y[indices]
        
        # Create DataFrame
        df = pd.DataFrame(X)
        df['label'] = y
        df['filename'] = [f"synthetic_{i}.jpg" for i in range(len(X))]
        
        # Save to CSV
        output_path = self.base_path / "data" / "synthetic_features.csv"
        output_path.parent.mkdir(exist_ok=True)
        df.to_csv(output_path, index=False)
        
        print(f"Generated {len(X)} synthetic samples")
        print(f"Saved to: {output_path}")
        
        # Save metadata
        metadata = {
            'generation_date': datetime.now().isoformat(),
            'num_samples': len(X),
            'num_features': self.total_features,
            'samples_per_class': num_samples_per_class,
            'feature_composition': {
                'landmarks': self.num_landmarks * self.features_per_landmark,
                'angles': self.num_angles,
                'distances': self.num_distances,
                'alignment': self.num_alignment
            }
        }
        
        metadata_path = self.base_path / "data" / "synthetic_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return X, y

if __name__ == "__main__":
    generator = SyntheticDataGenerator()
    X, y = generator.generate_dataset(num_samples_per_class=500)
    
    print("\nDataset statistics:")
    print(f"Shape: {X.shape}")
    print(f"Classes: {np.unique(y)}")
    print(f"Class distribution: {np.bincount(y)}")
