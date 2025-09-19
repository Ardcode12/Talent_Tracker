import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

def generate_shuttle_run_dataset(n_samples=5000):
    """
    Generate a comprehensive 10m x 4 shuttle run dataset based on research literature
    and realistic performance parameters for agility testing.
    """
    
    # Performance bands based on literature (seconds for 4x10m shuttle run)
    performance_bands = {
        'Elite': (8.5, 9.5),
        'Excellent': (9.5, 10.5),
        'Very Good': (10.5, 11.5),
        'Good': (11.5, 12.5),
        'Average': (12.5, 13.5),
        'Below Average': (13.5, 15.0)
    }
    
    # Age and gender distributions
    ages = list(range(15, 35))
    genders = ['M', 'F']
    
    # Surface types and their impact on performance
    surfaces = ['synthetic_track', 'gym_floor', 'grass', 'concrete', 'rubberized_floor']
    surface_multipliers = {'synthetic_track': 1.0, 'gym_floor': 1.02, 'grass': 1.15, 
                          'concrete': 1.05, 'rubberized_floor': 1.01}
    
    # Shoe types and their impact
    shoe_types = ['running_shoes', 'cross_trainers', 'basketball_shoes', 'turf_shoes', 'spikes']
    shoe_multipliers = {'running_shoes': 1.0, 'cross_trainers': 0.98, 'basketball_shoes': 1.03,
                       'turf_shoes': 0.95, 'spikes': 0.93}
    
    dataset = []
    
    for i in range(n_samples):
        # Basic participant info
        trial_id = f"SH{str(i+1).zfill(4)}"
        participant_id = f"P{str((i % 1000) + 1).zfill(3)}"
        age = random.choice(ages)
        gender = random.choice(genders)
        
        # Anthropometric data based on age and gender
        if gender == 'M':
            base_height = np.random.normal(175, 8)
            base_weight = np.random.normal(70, 12)
        else:
            base_height = np.random.normal(162, 7)
            base_weight = np.random.normal(58, 10)
        
        height_cm = max(150, min(200, base_height))
        weight_kg = max(45, min(100, base_weight))
        
        # Test conditions
        surface = random.choice(surfaces)
        shoes = random.choice(shoe_types)
        
        # Performance calculation based on multiple factors
        base_time = 11.0  # Base time in seconds
        
        # Age factor (peak performance around 20-25)
        age_factor = 1.0 + abs(age - 22) * 0.008
        
        # Gender factor
        gender_factor = 1.0 if gender == 'M' else 1.15
        
        # Height/weight factor (BMI effect)
        bmi = weight_kg / (height_cm/100)**2
        bmi_factor = 1.0 + max(0, (bmi - 22) * 0.02)
        
        # Calculate total time
        total_time = base_time * age_factor * gender_factor * bmi_factor * surface_multipliers[surface] * shoe_multipliers[shoes]
        
        # Add random variation
        total_time += np.random.normal(0, 0.3)
        total_time = max(8.0, min(16.0, total_time))
        
        # Determine performance band
        performance_band = 'Below Average'
        for band, (min_time, max_time) in performance_bands.items():
            if min_time <= total_time < max_time:
                performance_band = band
                break
        
        # False starts (rare)
        false_start = 1 if random.random() < 0.03 else 0
        if false_start:
            total_time += np.random.uniform(0.2, 0.5)
        
        # Biomechanical and performance metrics
        # Acceleration data (g-forces during direction changes)
        acc_x = np.random.uniform(-2.5, 2.5)  # Lateral acceleration
        acc_y = np.random.uniform(-1.5, 1.5)  # Forward/backward
        acc_z = np.random.uniform(8.5, 10.5)  # Vertical (gravity + movement)
        
        # Gyroscopic data (angular velocity during turns)
        gyro_x = np.random.uniform(-0.8, 0.8)
        gyro_y = np.random.uniform(-0.5, 0.5)
        gyro_z = np.random.uniform(-1.2, 1.2)
        
        # Performance metrics
        max_velocity_ms = 40 / total_time * np.random.uniform(0.8, 1.2)  # Peak speed
        avg_velocity_ms = 40 / total_time  # Average speed
        
        # Turn times (4 turns in shuttle run)
        turn_times = [np.random.uniform(0.3, 0.8) for _ in range(4)]
        avg_turn_time_ms = np.mean(turn_times) * 1000
        
        # Split times for each 10m segment
        split_1 = total_time * np.random.uniform(0.22, 0.28)
        split_2 = total_time * np.random.uniform(0.23, 0.27)
        split_3 = total_time * np.random.uniform(0.23, 0.27)
        split_4 = total_time - (split_1 + split_2 + split_3)
        
        # Stride characteristics
        stride_length_cm = np.random.uniform(140, 200) if gender == 'M' else np.random.uniform(125, 180)
        stride_frequency_hz = np.random.uniform(3.0, 4.5)
        
        # Agility metrics
        change_of_direction_deficit = np.random.uniform(0.1, 0.6)  # Time lost in turns
        acceleration_time = np.random.uniform(1.2, 2.0)
        deceleration_time = np.random.uniform(0.8, 1.4)
        
        # Movement quality scores
        coordination_score = np.random.uniform(6.0, 10.0)
        balance_score = np.random.uniform(6.0, 10.0)
        agility_rating = np.random.uniform(6.0, 10.0)
        
        # Physiological responses
        reaction_time_ms = np.random.uniform(150, 300)
        fatigue_index = np.random.uniform(0.05, 0.4)  # Performance decline over trials
        
        # Body mechanics
        knee_lift_angle_deg = np.random.uniform(60, 95)
        arm_swing_amplitude_deg = np.random.uniform(80, 140)
        body_lean_angle_deg = np.random.uniform(8, 25)
        
        # Foot strike pattern
        foot_strike_patterns = ['forefoot', 'midfoot', 'heel']
        foot_strike_weights = [0.6, 0.3, 0.1]  # Most athletes use forefoot for agility
        foot_strike_pattern = np.random.choice(foot_strike_patterns, p=foot_strike_weights)
        
        # Recovery metrics
        balance_recovery_time_ms = np.random.uniform(100, 400)
        
        # Heart rate response (estimated)
        hr_baseline = np.random.uniform(60, 80)
        hr_peak = hr_baseline + np.random.uniform(40, 80)
        hr_recovery_30s = hr_peak - np.random.uniform(15, 35)
        
        # Timestamp
        base_time_stamp = datetime(2024, 1, 1, 9, 0, 0)
        timestamp = base_time_stamp + timedelta(seconds=i*30)
        timestamp_ms = int(timestamp.timestamp() * 1000)
        
        # Create record
        record = {
            'trial_id': trial_id,
            'participant_id': participant_id,
            'age': age,
            'gender': gender,
            'height_cm': round(height_cm, 1),
            'weight_kg': round(weight_kg, 1),
            'surface': surface,
            'shoes': shoes,
            'false_start': false_start,
            'total_time_sec': round(total_time, 2),
            'performance_band': performance_band,
            'timestamp_ms': timestamp_ms,
            'acc_x': round(acc_x, 2),
            'acc_y': round(acc_y, 2),
            'acc_z': round(acc_z, 2),
            'gyro_x': round(gyro_x, 3),
            'gyro_y': round(gyro_y, 3),
            'gyro_z': round(gyro_z, 3),
            'split_1_sec': round(split_1, 2),
            'split_2_sec': round(split_2, 2),
            'split_3_sec': round(split_3, 2),
            'split_4_sec': round(split_4, 2),
            'max_velocity_ms': round(max_velocity_ms, 2),
            'avg_velocity_ms': round(avg_velocity_ms, 2),
            'stride_length_cm': round(stride_length_cm, 0),
            'stride_frequency_hz': round(stride_frequency_hz, 1),
            'avg_turn_time_ms': round(avg_turn_time_ms, 0),
            'change_of_direction_deficit': round(change_of_direction_deficit, 2),
            'acceleration_time_sec': round(acceleration_time, 2),
            'deceleration_time_sec': round(deceleration_time, 2),
            'reaction_time_ms': round(reaction_time_ms, 0),
            'fatigue_index': round(fatigue_index, 2),
            'coordination_score': round(coordination_score, 1),
            'balance_score': round(balance_score, 1),
            'agility_rating': round(agility_rating, 1),
            'knee_lift_angle_deg': round(knee_lift_angle_deg, 0),
            'arm_swing_amplitude_deg': round(arm_swing_amplitude_deg, 0),
            'body_lean_angle_deg': round(body_lean_angle_deg, 0),
            'foot_strike_pattern': foot_strike_pattern,
            'balance_recovery_time_ms': round(balance_recovery_time_ms, 0),
            'hr_baseline_bpm': round(hr_baseline, 0),
            'hr_peak_bpm': round(hr_peak, 0),
            'hr_recovery_30s_bpm': round(hr_recovery_30s, 0)
        }
        
        dataset.append(record)
    
    return pd.DataFrame(dataset)

# Generate the dataset
print("Generating 5000-sample 10m x 4 Shuttle Run Dataset...")
df = generate_shuttle_run_dataset(5000)

# Display basic statistics
print(f"\nDataset Overview:")
print(f"Total samples: {len(df)}")
print(f"Unique participants: {df['participant_id'].nunique()}")
print(f"Age range: {df['age'].min()} - {df['age'].max()}")
print(f"Gender distribution: {df['gender'].value_counts().to_dict()}")
print(f"Time range: {df['total_time_sec'].min():.2f} - {df['total_time_sec'].max():.2f} seconds")

print(f"\nPerformance Band Distribution:")
print(df['performance_band'].value_counts())

print(f"\nSample of first 5 records:")
print(df.head())

# Create directory if it doesn't exist
import os
# Since you're running from backend1/scripts/, go up one level to backend1, then into dataset
dataset_dir = "../dataset"
os.makedirs(dataset_dir, exist_ok=True)

# Save to CSV at specified path
csv_filename = "../dataset/shuttle_run_data.csv"
df.to_csv(csv_filename, index=False)
print(f"\nDataset saved as '{csv_filename}'")
print(f"Full path from your current directory: {os.path.abspath(csv_filename)}")

# Generate summary statistics
print(f"\nSummary Statistics for Key Metrics:")
key_metrics = ['total_time_sec', 'max_velocity_ms', 'avg_turn_time_ms', 
               'coordination_score', 'agility_rating']
print(df[key_metrics].describe())