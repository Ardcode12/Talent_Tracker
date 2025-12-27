# backend/ml_models/squat_counter_enhanced.py
import cv2
import numpy as np
from collections import deque
from enum import Enum
import mediapipe as mp
import time
import json
from pathlib import Path
import traceback # Added for better error reporting

class SquatState(Enum):
    STANDING = "standing"
    DESCENDING = "descending"
    AT_BOTTOM = "at_bottom"
    ASCENDING = "ascending"

class EnhancedSquatCounter:
    def __init__(self, debug=True):
        # MediaPipe setup
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,  # Reduced for faster processing
            enable_segmentation=False,
            min_detection_confidence=0.3,  # Lower threshold
            min_tracking_confidence=0.3   # Lower threshold
        )
        
        self.debug = debug
        
        # Counting parameters
        self.squat_count = 0
        self.current_state = SquatState.STANDING
        self.previous_state = SquatState.STANDING
        
        # Tracking arrays
        self.knee_angles_history = deque(maxlen=10) # Renamed to avoid confusion with avg_knee_angle
        self.hip_positions = deque(maxlen=10)
        self.hip_velocities = deque(maxlen=5) # Not currently used, but kept from original structure
        
        # Adjusted thresholds for better detection (will be overridden by benchmark if loaded)
        self.KNEE_ANGLE_THRESHOLD_DOWN = 120
        self.KNEE_ANGLE_THRESHOLD_UP = 150    
        self.HIP_DESCENT_THRESHOLD = 0.05
        self.MIN_SQUAT_DEPTH_RATIO = 0.10 # Renamed for clarity: ratio of hip movement
        self.VELOCITY_THRESHOLD = 0.005 # Not currently used

        # Time validation
        self.state_timestamps = {state: 0 for state in SquatState}
        self.MIN_STATE_DURATION = 0.1
        self.last_squat_time = 0
        self.MIN_SQUAT_INTERVAL = 0.3
        
        # Quality metrics
        self.partial_squats = 0
        self.invalid_squats = 0 # Not fully implemented, but kept
        self.rep_times = []
        self.form_issues_total = 0 # Track form issues

        # Calibration
        self.standing_hip_height_norm = None # Normalized standing height
        self.calibration_frames = 0
        self.is_calibrated = False
        self.lowest_hip_position_norm = float('inf') # Normalized min/max
        self.highest_hip_position_norm = float('-inf')
        
        # Debug info
        self.frames_processed = 0
        self.poses_detected = 0

        # Load benchmark data for consistency
        # Corrected path: relative to ml_models/ for ml_models/squad_jump/data/benchmark.json
        benchmark_path = Path(__file__).parent / "squad_jump" / "data" / "benchmark.json"
        try:
            if benchmark_path.exists():
                with open(benchmark_path, 'r') as f:
                    self.benchmark = json.load(f)
                print(f"INFO: EnhancedSquatCounter loaded squat benchmark from {benchmark_path}")
                # Update thresholds from benchmark if available (use 'ideal_knee_angle' for 'down' threshold)
                # Note: The benchmark.json has 'ideal_knee_angle' which is for the *bottom* of the squat.
                # So, KNEE_ANGLE_THRESHOLD_DOWN should be around that ideal angle.
                # KNEE_ANGLE_THRESHOLD_UP needs to be a higher angle (standing).
                self.KNEE_ANGLE_THRESHOLD_DOWN = self.benchmark.get("ideal_knee_angle", self.KNEE_ANGLE_THRESHOLD_DOWN)
                self.KNEE_ANGLE_THRESHOLD_UP = self.benchmark.get("max_knee_angle_up", 160) # Assume 160 if not in benchmark
            else:
                raise FileNotFoundError(f"Benchmark file not found at {benchmark_path}")
        except FileNotFoundError:
            print(f"WARNING: Squat benchmark file not found at {benchmark_path}. Using default values.")
            self.benchmark = { # Default config if file is missing
                "min_hip_angle_down": 80,
                "max_hip_angle_up": 170,
                "min_knee_angle_down": 80, # This would be ideal_knee_angle in squat_benchmark.py
                "max_knee_angle_up": 170,  # This is for the 'up' position
                "min_form_threshold": 160,
                "rep_time_ideal_min": 1.5,
                "rep_time_ideal_max": 3.0,
            }
        except Exception as e:
            print(f"ERROR: Failed to load squat benchmark for EnhancedSquatCounter: {e}")
            traceback.print_exc()
            self.benchmark = {} # Fallback

    def calculate_angle(self, point1, point2, point3):
        """Calculate angle between three points. Returns None if points are invalid."""
        try:
            # Check if any point is None or invalid
            if None in [point1, point2, point3]: return None
            if not all(hasattr(p, 'x') and hasattr(p, 'y') for p in [point1, point2, point3]): return None

            a = np.array([point1.x, point1.y])
            b = np.array([point2.x, point2.y])
            c = np.array([point3.x, point3.y])
            
            ba = a - b
            bc = c - b
            
            cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
            angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0)) # Clip to avoid NaN for tiny numerical errors
            
            return np.degrees(angle)
        except Exception as e:
            if self.debug:
                print(f"DEBUG: Angle calculation error: {e}")
            return None
    
    def process_frame(self, frame, timestamp):
        """Process a single frame and update squat count. Returns (squat_count, feedback_dict)."""
        self.frames_processed += 1
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb_frame)
        
        if not results.pose_landmarks:
            if self.debug and self.frames_processed % 60 == 0: # Reduced frequency
                print(f"Frame {self.frames_processed}: No pose detected")
            return self.squat_count, None
        
        self.poses_detected += 1
        landmarks = results.pose_landmarks.landmark
        
        # Get key points (using LEFT side for consistency)
        # Ensure landmarks are valid before accessing .x/.y
        left_hip = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[self.mp_pose.PoseLandmark.RIGHT_HIP]
        left_knee = landmarks[self.mp_pose.PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[self.mp_pose.PoseLandmark.RIGHT_KNEE]
        left_ankle = landmarks[self.mp_pose.PoseLandmark.LEFT_ANKLE]
        right_ankle = landmarks[self.mp_pose.PoseLandmark.RIGHT_ANKLE]
        
        # Calculate hip position (average of left and right) - normalized y-coordinate
        hip_y = (left_hip.y + right_hip.y) / 2 if left_hip and right_hip else None
        
        if hip_y is None: # If hip points invalid
            return self.squat_count, None

        # Track min/max normalized positions
        self.lowest_hip_position_norm = min(self.lowest_hip_position_norm, hip_y)
        self.highest_hip_position_norm = max(self.highest_hip_position_norm, hip_y)
        
        # Calculate knee angles
        left_knee_angle = self.calculate_angle(left_hip, left_knee, left_ankle)
        right_knee_angle = self.calculate_angle(right_hip, right_knee, right_ankle)
        
        if left_knee_angle is None or right_knee_angle is None:
            if self.debug and self.frames_processed % 60 == 0:
                print(f"Frame {self.frames_processed}: Invalid knee angle calculation.")
            return self.squat_count, None

        avg_knee_angle = (left_knee_angle + right_knee_angle) / 2
        self.knee_angles_history.append(avg_knee_angle) # Store history
            
        if self.debug and self.frames_processed % 60 == 0:
            print(f"Frame {self.frames_processed}: Knee angle = {avg_knee_angle:.1f}°, Hip Y = {hip_y:.3f} (norm)")
        
        # Simple calibration - establish standing hip height
        if not self.is_calibrated:
            self.calibration_frames += 1
            if self.calibration_frames == 1:
                self.standing_hip_height_norm = hip_y
            else:
                self.standing_hip_height_norm = self.standing_hip_height_norm * 0.9 + hip_y * 0.1 # EMA
            
            if self.calibration_frames >= 30: # Calibrate over 30 frames
                self.is_calibrated = True
                if self.debug:
                    print(f"Calibration complete. Standing hip height (norm): {self.standing_hip_height_norm:.3f}")
            return self.squat_count, None # Don't count squats during calibration
        
        # Track hip position (normalized)
        self.hip_positions.append(hip_y)
        
        # Calculate hip descent/relative position for state change
        # Ensure hip_range_val is not zero to avoid division by zero
        hip_range_val = self.highest_hip_position_norm - self.lowest_hip_position_norm
        hip_relative_position = (hip_y - self.lowest_hip_position_norm) / (hip_range_val if hip_range_val > 0 else 1)
        
        new_state = self.current_state
        
        if self.current_state == SquatState.STANDING:
            # Check if hip starts descending significantly
            if hip_relative_position < 0.8 and avg_knee_angle < 150: # Assume 150 as start of bending
                new_state = SquatState.DESCENDING
                self.start_rep_time = timestamp # Start timing the rep
                if self.debug: print(f"State: STANDING -> DESCENDING")
                    
        elif self.current_state == SquatState.DESCENDING:
            # Check if reached bottom based on knee angle and hip depth
            if avg_knee_angle < self.KNEE_ANGLE_THRESHOLD_DOWN and hip_relative_position < 0.3: # Deep enough
                new_state = SquatState.AT_BOTTOM
                if self.debug: print(f"State: DESCENDING -> AT_BOTTOM")
            # If started ascending without reaching proper depth (partial)
            elif hip_relative_position > 0.5 and avg_knee_angle > (self.KNEE_ANGLE_THRESHOLD_DOWN + self.KNEE_ANGLE_THRESHOLD_UP) / 2: # Moved up halfway
                new_state = SquatState.ASCENDING
                self.partial_squats += 1
                if self.debug: print(f"State: DESCENDING -> ASCENDING (partial squat)")
                    
        elif self.current_state == SquatState.AT_BOTTOM:
            # Check if ascending from bottom
            if avg_knee_angle > self.KNEE_ANGLE_THRESHOLD_DOWN + 10: # Angle starts increasing from bottom
                new_state = SquatState.ASCENDING
                if self.debug: print(f"State: AT_BOTTOM -> ASCENDING")
                    
        elif self.current_state == SquatState.ASCENDING:
            # Check if back to standing position (full extension)
            if avg_knee_angle > self.KNEE_ANGLE_THRESHOLD_UP and hip_relative_position > 0.8: # Fully extended
                # Count the squat! Only if came from AT_BOTTOM
                if self.previous_state == SquatState.AT_BOTTOM:
                    self.squat_count += 1
                    if self.start_rep_time is not None:
                        self.rep_times.append(timestamp - self.start_rep_time)
                    self.last_squat_time = timestamp
                    if self.debug: print(f"SQUAT COUNTED! Total: {self.squat_count}")
                new_state = SquatState.STANDING
                if self.debug: print(f"State: ASCENDING -> STANDING")
        
        # Update state if changed
        if new_state != self.current_state:
            self.previous_state = self.current_state
            self.current_state = new_state
            self.state_timestamps[new_state] = timestamp
        
        # Basic form issue detection (can be more sophisticated)
        # E.g., if back rounding (hip angle too small) or knees caving in (not tracked here)
        if self.current_state == SquatState.DESCENDING or self.current_state == SquatState.AT_BOTTOM:
            if avg_knee_angle > self.benchmark.get("max_knee_angle_at_bottom", 100) or \
               avg_knee_angle < self.benchmark.get("min_knee_angle_at_bottom", 70): # Example thresholds
                self.form_issues_total += 1


        feedback_data = {
            'count': self.squat_count,
            'partial_squats': self.partial_squats,
            'current_state': self.current_state.value,
            'avg_knee_angle': avg_knee_angle,
            'hip_relative_position': hip_relative_position * 100,  # As percentage
            'frames_processed': self.frames_processed,
            'poses_detected': self.poses_detected
        }
        
        return self.squat_count, feedback_data
    
    def analyze_video(self, video_path):
        """Analyze entire video and return results"""
        if self.debug:
            print(f"\n=== Starting Enhanced Squat analysis: {video_path} ===")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"ERROR: Cannot open video file: {video_path}")
            return {
                'count': 0,
                'partial_squats': 0,
                'consistency_score': 0.0,
                'average_rep_time': 0.0,
                'quality_assessment': "Error: Could not open video file",
                'form_quality_score': 0.0,
                'debug_info': {'error': 'Could not open video file for processing'}
            }
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if self.debug:
            print(f"Video info: {total_frames} frames @ {fps:.1f} FPS")
        
        frame_count = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            timestamp = frame_count / fps if fps > 0 else frame_count
            current_squat_count, _ = self.process_frame(frame, timestamp) # We just need the count, feedback_data is internal state
            frame_count += 1
            
            # Progress update
            if self.debug and frame_count % 60 == 0:
                print(f"Progress: {frame_count}/{total_frames} frames ({frame_count/total_frames*100:.1f}%)")
        
        cap.release()
        
        # Calculate final metrics
        consistency_score = 0.0
        avg_rep_time = 0.0
        
        if len(self.rep_times) > 1:
            consistency_score = (1 - (np.std(self.rep_times) / np.mean(self.rep_times))) * 100
            consistency_score = max(0, min(100, consistency_score)) # Clamp between 0-100
        elif len(self.rep_times) == 1:
            consistency_score = 100.0 # Only one rep is perfectly consistent
        
        if self.rep_times:
            avg_rep_time = np.mean(self.rep_times)

        # Form quality based on total form issues during processed frames
        form_quality_score = max(0.0, 100.0 - (self.form_issues_total / (self.frames_processed + 1e-6)) * 100.0) # Avoid div by zero
        
        if self.debug:
            print(f"\n=== Enhanced Squat Analysis Complete ===")
            print(f"Frames processed: {self.frames_processed}")
            print(f"Poses detected: {self.poses_detected} ({self.poses_detected/self.frames_processed*100:.1f}%)")
            print(f"Valid squats: {self.squat_count}")
            print(f"Partial squats: {self.partial_squats}")
            print(f"Consistency: {consistency_score:.1f}%")
            print(f"Avg Rep Time: {avg_rep_time:.2f}s")
            print(f"Form Quality: {form_quality_score:.1f}%")
            print(f"Hip range (norm): {self.lowest_hip_position_norm:.3f} to {self.highest_hip_position_norm:.3f}")
        
        # Generate quality assessment
        if self.squat_count == 0 and self.partial_squats == 0:
            quality_assessment = "No squats detected. Ensure full body is visible in frame, good lighting, and proper execution."
        elif self.squat_count == 0:
            quality_assessment = f"No complete squats detected, but {self.partial_squats} partial attempts. Work on achieving full depth."
        else:
            quality_assessment = f"Good workout! {self.squat_count} complete squats detected."
        
        return {
            'count': self.squat_count,
            'partial_squats': self.partial_squats,
            'invalid_squats': self.invalid_squats,
            'consistency_score': float(consistency_score), # Ensure float
            'average_rep_time': float(avg_rep_time),     # Ensure float
            'quality_assessment': quality_assessment,
            'form_quality_score': float(form_quality_score), # Ensure float
            'debug_info': {
                'frames_processed': self.frames_processed,
                'poses_detected': self.poses_detected,
                'detection_rate': f"{self.poses_detected/self.frames_processed*100:.1f}%" if self.frames_processed > 0 else "0%",
                'rep_times_raw': [float(t) for t in self.rep_times]
            }
        }
