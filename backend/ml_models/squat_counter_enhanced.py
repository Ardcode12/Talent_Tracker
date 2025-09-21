import cv2
import numpy as np
from collections import deque
from enum import Enum
import mediapipe as mp
import time

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
        self.knee_angles = deque(maxlen=10)
        self.hip_positions = deque(maxlen=10)
        self.hip_velocities = deque(maxlen=5)
        
        # Adjusted thresholds for better detection
        self.KNEE_ANGLE_THRESHOLD_DOWN = 120  # Increased from 100
        self.KNEE_ANGLE_THRESHOLD_UP = 150    # Decreased from 160
        self.HIP_DESCENT_THRESHOLD = 0.05     # More sensitive
        self.MIN_SQUAT_DEPTH = 0.10           # Less strict
        self.VELOCITY_THRESHOLD = 0.005       # More sensitive
        
        # Time validation
        self.state_timestamps = {state: 0 for state in SquatState}
        self.MIN_STATE_DURATION = 0.1  # Reduced from 0.2
        self.last_squat_time = 0
        self.MIN_SQUAT_INTERVAL = 0.3  # Reduced from 0.5
        
        # Quality metrics
        self.partial_squats = 0
        self.invalid_squats = 0
        self.rep_times = []
        
        # Calibration
        self.standing_hip_height = None
        self.calibration_frames = 0
        self.is_calibrated = False
        self.lowest_hip_position = float('inf')
        self.highest_hip_position = float('-inf')
        
        # Debug info
        self.frames_processed = 0
        self.poses_detected = 0
    
    def calculate_angle(self, point1, point2, point3):
        """Calculate angle between three points"""
        try:
            a = np.array([point1.x, point1.y])
            b = np.array([point2.x, point2.y])
            c = np.array([point3.x, point3.y])
            
            ba = a - b
            bc = c - b
            
            cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
            angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
            
            return np.degrees(angle)
        except:
            return None
    
    def process_frame(self, frame, timestamp):
        """Process a single frame and update squat count"""
        self.frames_processed += 1
        
        # Convert to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb_frame)
        
        if not results.pose_landmarks:
            if self.debug and self.frames_processed % 30 == 0:
                print(f"Frame {self.frames_processed}: No pose detected")
            return self.squat_count, None
        
        self.poses_detected += 1
        landmarks = results.pose_landmarks.landmark
        
        # Get key points
        left_hip = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP]
        right_hip = landmarks[self.mp_pose.PoseLandmark.RIGHT_HIP]
        left_knee = landmarks[self.mp_pose.PoseLandmark.LEFT_KNEE]
        right_knee = landmarks[self.mp_pose.PoseLandmark.RIGHT_KNEE]
        left_ankle = landmarks[self.mp_pose.PoseLandmark.LEFT_ANKLE]
        right_ankle = landmarks[self.mp_pose.PoseLandmark.RIGHT_ANKLE]
        
        # Calculate hip position (average of left and right)
        hip_y = (left_hip.y + right_hip.y) / 2
        
        # Track min/max positions
        self.lowest_hip_position = min(self.lowest_hip_position, hip_y)
        self.highest_hip_position = max(self.highest_hip_position, hip_y)
        
        # Calculate knee angles
        left_knee_angle = self.calculate_angle(left_hip, left_knee, left_ankle)
        right_knee_angle = self.calculate_angle(right_hip, right_knee, right_ankle)
        
        if left_knee_angle and right_knee_angle:
            avg_knee_angle = (left_knee_angle + right_knee_angle) / 2
            self.knee_angles.append(avg_knee_angle)
            
            if self.debug and self.frames_processed % 30 == 0:
                print(f"Frame {self.frames_processed}: Knee angle = {avg_knee_angle:.1f}°, Hip Y = {hip_y:.3f}")
        
        # Simple calibration
        if not self.is_calibrated:
            self.calibration_frames += 1
            if self.calibration_frames == 1:
                self.standing_hip_height = hip_y
            else:
                # Exponential moving average
                self.standing_hip_height = self.standing_hip_height * 0.9 + hip_y * 0.1
            
            if self.calibration_frames >= 30:
                self.is_calibrated = True
                if self.debug:
                    print(f"Calibration complete. Standing hip height: {self.standing_hip_height:.3f}")
            return self.squat_count, None
        
        # Track hip position
        self.hip_positions.append(hip_y)
        
        # Simple squat detection based on hip movement
        hip_range = self.highest_hip_position - self.lowest_hip_position
        hip_relative_position = (hip_y - self.lowest_hip_position) / (hip_range if hip_range > 0 else 1)
        
        # State detection with simple logic
        new_state = self.current_state
        
        if self.current_state == SquatState.STANDING:
            # Check if starting to descend
            if hip_relative_position < 0.8 and avg_knee_angle < 150:
                new_state = SquatState.DESCENDING
                if self.debug:
                    print(f"State: STANDING -> DESCENDING")
                    
        elif self.current_state == SquatState.DESCENDING:
            # Check if reached bottom
            if hip_relative_position < 0.3 and avg_knee_angle < self.KNEE_ANGLE_THRESHOLD_DOWN:
                new_state = SquatState.AT_BOTTOM
                if self.debug:
                    print(f"State: DESCENDING -> AT_BOTTOM")
            # Or if started ascending without reaching bottom
            elif hip_relative_position > 0.5:
                new_state = SquatState.ASCENDING
                self.partial_squats += 1
                if self.debug:
                    print(f"State: DESCENDING -> ASCENDING (partial)")
                    
        elif self.current_state == SquatState.AT_BOTTOM:
            # Check if ascending
            if hip_relative_position > 0.4:
                new_state = SquatState.ASCENDING
                if self.debug:
                    print(f"State: AT_BOTTOM -> ASCENDING")
                    
        elif self.current_state == SquatState.ASCENDING:
            # Check if back to standing
            if hip_relative_position > 0.8 and avg_knee_angle > self.KNEE_ANGLE_THRESHOLD_UP:
                # Count the squat!
                if self.previous_state == SquatState.AT_BOTTOM:
                    self.squat_count += 1
                    self.last_squat_time = timestamp
                    if self.debug:
                        print(f"SQUAT COUNTED! Total: {self.squat_count}")
                new_state = SquatState.STANDING
                if self.debug:
                    print(f"State: ASCENDING -> STANDING")
        
        # Update state
        if new_state != self.current_state:
            self.previous_state = self.current_state
            self.current_state = new_state
            self.state_timestamps[new_state] = timestamp
        
        # Create feedback
        feedback = {
            'count': self.squat_count,
            'partial_squats': self.partial_squats,
            'current_state': self.current_state.value,
            'knee_angle': avg_knee_angle,
            'hip_position': hip_relative_position * 100,  # As percentage
            'frames_processed': self.frames_processed,
            'poses_detected': self.poses_detected
        }
        
        return self.squat_count, feedback
    
    def analyze_video(self, video_path):
        """Analyze entire video and return results"""
        if self.debug:
            print(f"\n=== Starting video analysis: {video_path} ===")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"ERROR: Cannot open video file: {video_path}")
            return {
                'count': 0,
                'partial_squats': 0,
                'consistency_score': 0,
                'average_rep_time': 0,
                'quality_assessment': "Error: Could not open video file"
            }
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if self.debug:
            print(f"Video info: {total_frames} frames @ {fps:.1f} FPS")
        
        frame_count = 0
        last_feedback = None
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            timestamp = frame_count / fps if fps > 0 else frame_count
            count, feedback = self.process_frame(frame, timestamp)
            last_feedback = feedback
            frame_count += 1
            
            # Progress update
            if self.debug and frame_count % 60 == 0:
                print(f"Progress: {frame_count}/{total_frames} frames ({frame_count/total_frames*100:.1f}%)")
        
        cap.release()
        
        # Calculate final metrics
        consistency_score = 100.0  # Simplified for now
        avg_rep_time = 0.0
        
        if self.debug:
            print(f"\n=== Analysis Complete ===")
            print(f"Frames processed: {self.frames_processed}")
            print(f"Poses detected: {self.poses_detected} ({self.poses_detected/self.frames_processed*100:.1f}%)")
            print(f"Valid squats: {self.squat_count}")
            print(f"Partial squats: {self.partial_squats}")
            print(f"Hip range: {self.lowest_hip_position:.3f} to {self.highest_hip_position:.3f}")
        
        # Generate quality assessment
        if self.squat_count == 0 and self.partial_squats == 0:
            quality_assessment = "No squats detected. Ensure full body is visible in frame."
        elif self.squat_count == 0:
            quality_assessment = f"No complete squats detected, but {self.partial_squats} partial attempts. Work on achieving full depth."
        else:
            quality_assessment = f"Good workout! {self.squat_count} complete squats detected."
        
        return {
            'count': self.squat_count,
            'partial_squats': self.partial_squats,
            'invalid_squats': self.invalid_squats,
            'consistency_score': consistency_score,
            'average_rep_time': avg_rep_time,
            'quality_assessment': quality_assessment,
            'debug_info': {
                'frames_processed': self.frames_processed,
                'poses_detected': self.poses_detected,
                'detection_rate': f"{self.poses_detected/self.frames_processed*100:.1f}%" if self.frames_processed > 0 else "0%"
            }
        }
