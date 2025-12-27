# backend/ml_models/jump_analyzer.py
import cv2
import numpy as np
import mediapipe as mp
from typing import Dict, Any
from pathlib import Path # Added for robust path handling
import json # Added to load jump_config.json
import random # Added for fallback scores
import traceback # Added for better error reporting

class JumpAnalyzer:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Load configuration for jump types (e.g., vertical vs broad)
        # Corrected path: relative to ml_models/ for jump_config.json
        config_path = Path(__file__).parent / "jump_config.json"
        try:
            if config_path.exists():
                with open(config_path, 'r') as f:
                    self.config = json.load(f)
                print(f"INFO: JumpAnalyzer loaded jump analysis config from {config_path}")
            else:
                raise FileNotFoundError(f"Jump config file not found at {config_path}")
        except FileNotFoundError:
            print(f"WARNING: Jump config file not found at {config_path}. Using default values.")
            self.config = { # Default config
                "vertical": {
                    "min_hip_angle_land": 90, # Angle at deepest point of landing
                    "max_hip_angle_takeoff": 170, # Angle just before leaving ground
                    "min_knee_angle_land": 90,
                    "max_knee_angle_takeoff": 170,
                    "min_ankle_angle_takeoff": 90, # Plantarflexion at takeoff
                    "body_height_factor": 0.8, # Factor for estimating max body height from landmarks
                    "min_jump_frames": 10 # Minimum frames in air to be considered a jump
                },
                "broad": {
                    # ... broad jump specific configs
                }
            }
        except Exception as e:
            print(f"ERROR: Failed to load jump config: {e}")
            traceback.print_exc()
            self.config = {} # Fallback


    def calculate_angle(self, point1, point2, point3):
        """Calculate angle between three points"""
        # Ensure points are passed as [x, y] coordinates
        a = np.array(point1)  
        b = np.array(point2)  
        c = np.array(point3)  

        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - \
                  np.arctan2(a[1] - b[1], a[0] - b[0])
        angle = np.abs(radians * 180.0 / np.pi)

        if angle > 180.0:
            angle = 360 - angle
        return angle

    def analyze_jump(self, video_path: str, jump_type: str = "vertical") -> Dict[str, Any]:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"ERROR: Could not open video file for jump analysis: {video_path}")
            return self._error_result("Could not open video file.")

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"Jump Analysis Video Info - FPS: {fps}, Frames: {frame_count}")
        
        if frame_count < 30 or fps == 0:  # Need at least 1 second of video and valid FPS
            return self._error_result("Video too short or invalid FPS for analysis")
        
        # Track key points
        hip_positions = [] # (timestamp, x, y_normalized)
        feet_positions = [] # (timestamp, x, y_normalized)
        
        frame_idx = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process frame
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.pose.process(rgb_frame)
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Get hip center (approximate center of mass)
                left_hip = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP]
                right_hip = landmarks[self.mp_pose.PoseLandmark.RIGHT_HIP]
                hip_y = (left_hip.y + right_hip.y) / 2
                hip_x = (left_hip.x + right_hip.x) / 2
                
                # Get feet position for landing detection (using ankle for now)
                left_foot = landmarks[self.mp_pose.PoseLandmark.LEFT_ANKLE]
                right_foot = landmarks[self.mp_pose.PoseLandmark.RIGHT_ANKLE]
                foot_y = (left_foot.y + right_foot.y) / 2
                foot_x = (left_foot.x + right_foot.x) / 2
                
                hip_positions.append((frame_idx / fps, hip_x, hip_y))
                feet_positions.append((frame_idx / fps, foot_x, foot_y))
            
            frame_idx += 1
        
        cap.release()
        
        print(f"Detected {len(hip_positions)} frames with pose landmarks for jump analysis")
        
        if len(hip_positions) < 10:
            return self._error_result("Not enough valid frames detected for jump analysis")
        
        # Analyze vertical jump
        return self._analyze_vertical_jump(hip_positions, feet_positions, fps, jump_type)
                
    except Exception as e:
        print(f"CRITICAL Jump analysis error: {e}")
        traceback.print_exc()
        return self._error_result(str(e))
    
    def _analyze_vertical_jump(self, hip_positions: list, feet_positions: list, fps: float, jump_type: str) -> Dict[str, Any]:
        """Analyze vertical jump metrics"""
        try:
            # Get specific configs for the jump type (with fallback)
            jump_config = self.config.get(jump_type, self.config.get("vertical", {})) 

            # Extract y-coordinates
            times = np.array([p[0] for p in hip_positions])
            hip_ys_norm = np.array([p[2] for p in hip_positions]) # Normalized y-coordinates (0 to 1)
            
            # --- Jump Detection Heuristics ---
            # 1. Baseline: Median of initial stable hip Y positions
            initial_frames_for_baseline = int(min(len(hip_ys_norm), 2 * fps)) # First 2 seconds or available frames
            if initial_frames_for_baseline > 0:
                baseline_y_norm = np.median(hip_ys_norm[:initial_frames_for_baseline])
            else:
                baseline_y_norm = 0.5 # Fallback to middle of frame if no initial data
            print(f"DEBUG: Baseline Y (norm): {baseline_y_norm:.3f}")

            # 2. Identify Takeoff:
            # Look for point where hip starts significant upward movement after a dip
            # Or the lowest point before the highest point (min Y)
            min_y_idx = np.argmin(hip_ys_norm) # Global minimum Y (highest physical point)
            
            # Search backwards from min_y_idx for the *last* frame where hip_y_norm was significantly low (crouch)
            # and before rising.
            takeoff_idx = 0
            crouch_threshold_y = baseline_y_norm + 0.05 # significantly below standing (higher Y)
            
            # Find the deepest crouch just before the jump
            deepest_crouch_y = 0
            crouch_start_idx = 0
            for i in range(1, min_y_idx):
                if hip_ys_norm[i] > baseline_y_norm + 0.02 and hip_ys_norm[i] > deepest_crouch_y: # Deeper than baseline
                    deepest_crouch_y = hip_ys_norm[i]
                    crouch_start_idx = i
            
            # The takeoff is usually the point where the hip starts rising rapidly from the deepest crouch
            # or from a relatively low position, leading to the actual jump
            
            # Simplified: Find the lowest point before `min_y_idx` that signifies the "true" takeoff preparation.
            # Look for the last frame where the feet are on the ground and the hip is at its lowest *before* ascending
            # to the peak jump height.
            # A simple heuristic: find a local maximum in y-values (lowest physical point) before the jump.
            # This is complex. For simplicity, let's assume takeoff_idx is the lowest point before peak.
            
            # Use `np.diff` to find changes. Negative means upward motion (y-coord decreasing).
            y_diff = np.diff(hip_ys_norm)
            
            # Find point of max upward velocity (most negative diff) before peak
            takeoff_moment_idx = np.argmin(y_diff[:min_y_idx]) # index of max velocity *upwards*
            takeoff_idx = takeoff_moment_idx # This is a reasonable guess for takeoff
            
            # 3. Landing: First point after `min_y_idx` where hip_y_norm returns close to baseline
            landing_idx = len(hip_ys_norm) - 1
            for i in range(min_y_idx + 1, len(hip_ys_norm)):
                if hip_ys_norm[i] > baseline_y_norm - 0.02: # Within 2% of baseline_y
                    landing_idx = i
                    break
            
            print(f"DEBUG: Takeoff idx: {takeoff_idx}, Peak Y idx: {min_y_idx}, Landing idx: {landing_idx}")

            if takeoff_idx >= min_y_idx or min_y_idx >= landing_idx: # Invalid sequence
                 print(f"WARNING: Invalid jump sequence (takeoff: {takeoff_idx}, peak: {min_y_idx}, landing: {landing_idx}). Falling back.")
                 return self._error_result("Invalid jump sequence detected. Video may be unclear.")
            
            jump_height_norm = baseline_y_norm - hip_ys_norm[min_y_idx]
            
            # Convert to real-world measurements (very rough estimate without calibration)
            # Assuming a typical person's height in normalized coordinates.
            # If a person is 'X' normalized units tall, and 'Y' cm tall in reality.
            # For rough estimation, assume 1 unit_norm (full screen height) relates to 180cm.
            normalized_unit_to_cm_factor = 180.0 
            jump_height_cm = jump_height_norm * normalized_unit_to_cm_factor
            
            # Ensure reasonable bounds
            jump_height_cm = max(5, min(100, jump_height_cm))  # Between 5-100 cm
            
            hang_time = times[landing_idx] - times[takeoff_idx]
            hang_time = max(0.05, min(2.0, hang_time)) # Between 0.05 - 2.0 seconds
            
            # Calculate takeoff velocity using physics (v = g*t/2)
            takeoff_velocity = (9.81 * hang_time) / 2 if hang_time > 0 else 0 # m/s
            
            # Assess technique (pass relevant portions of position data)
            technique_score = self._assess_jump_technique(hip_positions, feet_positions, takeoff_idx, landing_idx)
            
            # Calculate AI score
            ai_score = self._calculate_vertical_score(jump_height_cm, hang_time, technique_score)
            
            print(f"Final results - Height: {jump_height_cm:.1f}cm, Hang time: {hang_time:.2f}s, AI Score: {ai_score:.1f}%")
            
            return {
                "success": True,
                "jump_height_cm": float(jump_height_cm),
                "hang_time_s": float(hang_time),
                "takeoff_velocity": float(takeoff_velocity),
                "technique_score": float(technique_score),
                "ai_score": float(ai_score),
                "feedback": self._generate_vertical_feedback(jump_height_cm, technique_score)
            }
        except Exception as e:
            print(f"Error in _analyze_vertical_jump: {e}")
            traceback.print_exc()
            return self._error_result(f"Analysis error: {str(e)}")
    
    def _assess_jump_technique(self, hip_positions: list, feet_positions: list, takeoff_idx: int, landing_idx: int) -> float:
        """Assess jump technique based on movement patterns"""
        try:
            hip_ys_norm = np.array([p[2] for p in hip_positions])
            
            # Check for smooth motion (less jerky = better) during the jump phase
            jump_hip_ys_norm = hip_ys_norm[takeoff_idx:landing_idx]
            if len(jump_hip_ys_norm) > 2:
                velocity = np.diff(jump_hip_ys_norm)
                acceleration = np.diff(velocity)
                # Lower std dev of acceleration means smoother motion
                smoothness_score = max(0, 100 - np.std(acceleration) * 200) # Scale appropriately
            else:
                smoothness_score = 50
            
            # Check for proper crouch before jump (initial phase before takeoff)
            pre_jump_hip_ys_norm = hip_ys_norm[:takeoff_idx]
            if len(pre_jump_hip_ys_norm) > 5:
                # Look for a significant dip
                initial_hip_y = np.median(pre_jump_hip_ys_norm[:5])
                deepest_crouch_y = np.max(pre_jump_hip_ys_norm) # Max y is lowest point (largest normalized value)
                crouch_depth_norm = deepest_crouch_y - initial_hip_y
                
                # Ideal crouch depth is hard without calibration. Use a relative score.
                # Max 0.2-0.3 normalized depth could be ideal.
                ideal_crouch_depth_norm = 0.25 
                crouch_score = max(0, 100 - abs(crouch_depth_norm - ideal_crouch_depth_norm) * 500) # Penalize deviation
            else:
                crouch_score = 50
            
            technique = (smoothness_score * 0.5) + (crouch_score * 0.5)
            return min(100, max(0, technique))
        except Exception as e:
            print(f"Error in technique assessment: {e}")
            traceback.print_exc()
            return 50  # Default middle score
    
    def _calculate_vertical_score(self, height_cm: float, hang_time: float, technique: float) -> float:
        """Calculate AI score for vertical jump"""
        # Score based on jump height (0-60 points)
        if height_cm >= 60:
            height_score = 60
        elif height_cm >= 45:
            height_score = 50 + (height_cm - 45) / 15 * 10
        elif height_cm >= 30:
            height_score = 35 + (height_cm - 30) / 15 * 15
        else:
            height_score = height_cm / 30 * 35
        
        # Score based on hang time (0-20 points)
        if hang_time >= 0.8:
            time_score = 20
        elif hang_time >= 0.6:
            time_score = 15 + (hang_time - 0.6) / 0.2 * 5
        else:
            time_score = hang_time / 0.6 * 15
        
        # Technique score (0-20 points)
        technique_score = technique * 0.2
        
        # Total score
        total = height_score + time_score + technique_score
        return min(100, max(0, total))
    
    def _generate_vertical_feedback(self, height_cm: float, technique: float) -> str:
        """Generate feedback for vertical jump"""
        feedback = f"🏀 Vertical Jump Analysis:\n\n"
        feedback += f"• Jump height: {height_cm:.1f} cm\n"
        feedback += f"• Technique score: {technique:.0f}%\n\n"
        
        if height_cm >= 60:
            feedback += "🌟 Elite Performance!\n"
            feedback += "• You're in the top tier of athletes\n"
            feedback += "• Focus on maintaining this level\n"
        elif height_cm >= 45:
            feedback += "🎯 Excellent Jump!\n"
            feedback += "• Great explosive power\n"
            feedback += "• Work on consistency\n"
        elif height_cm >= 30:
            feedback += "👍 Good Performance!\n"
            feedback += "• Solid foundation\n"
            feedback += "• Add plyometric training\n"
        else:
            feedback += "💪 Keep Training!\n"
            feedback += "• Focus on leg strength\n"
            feedback += "• Practice jump technique\n"
        
        if technique < 70:
            feedback += "\n📊 Technique tip: Work on your pre-jump crouch and landing form"
        
        return feedback
    
    def _error_result(self, error_msg: str) -> Dict[str, Any]:
        """Return error result"""
        print(f"ERROR: Jump Analysis Fallback: {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "ai_score": 0,
            "feedback": f"❌ Analysis failed: {error_msg}"
        }
