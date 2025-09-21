import cv2
import numpy as np
import mediapipe as mp
from typing import Dict, Any

class JumpAnalyzer:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
    
    def analyze_jump(self, video_path: str, jump_type: str = "vertical") -> Dict[str, Any]:
        """Analyze jump video for vertical jump"""
        try:
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            print(f"Video info - FPS: {fps}, Frames: {frame_count}")
            
            if frame_count < 30:  # Need at least 1 second of video
                return self._error_result("Video too short for analysis")
            
            # Track key points
            hip_positions = []
            feet_positions = []
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
                    
                    # Get feet position for landing detection
                    left_foot = landmarks[self.mp_pose.PoseLandmark.LEFT_ANKLE]
                    right_foot = landmarks[self.mp_pose.PoseLandmark.RIGHT_ANKLE]
                    foot_y = (left_foot.y + right_foot.y) / 2
                    foot_x = (left_foot.x + right_foot.x) / 2
                    
                    hip_positions.append((frame_idx / fps, hip_x, hip_y))
                    feet_positions.append((frame_idx / fps, foot_x, foot_y))
                
                frame_idx += 1
            
            cap.release()
            
            print(f"Detected {len(hip_positions)} frames with pose landmarks")
            
            if len(hip_positions) < 10:
                return self._error_result("Not enough valid frames detected")
            
            # Analyze vertical jump
            return self._analyze_vertical_jump(hip_positions, feet_positions, fps)
                
        except Exception as e:
            print(f"Jump analysis error: {e}")
            import traceback
            traceback.print_exc()
            return self._error_result(str(e))
    
    def _analyze_vertical_jump(self, hip_positions: list, feet_positions: list, fps: float) -> Dict[str, Any]:
        """Analyze vertical jump metrics"""
        try:
            # Extract y-coordinates
            times = np.array([p[0] for p in hip_positions])
            hip_ys = np.array([p[2] for p in hip_positions])
            
            # Find baseline (standing position) - average of first 30% of frames
            baseline = np.median(hip_ys[:int(0.3 * len(hip_ys))])
            
            # Find peak (highest point - lowest y value due to inverted coordinates)
            peak_idx = np.argmin(hip_ys)
            peak_height = baseline - hip_ys[peak_idx]
            
            print(f"Baseline: {baseline}, Peak: {hip_ys[peak_idx]}, Height diff: {peak_height}")
            
            # Ensure we have a positive jump height
            if peak_height <= 0:
                print(f"Warning: Negative or zero peak height detected: {peak_height}")
                peak_height = 0.05  # Set minimum height
            
            # Convert to real-world measurements
            # Using a more conservative conversion factor
            pixel_to_cm = 150  # This assumes the person is roughly 170cm tall
            jump_height_cm = peak_height * pixel_to_cm
            
            # Ensure reasonable bounds
            jump_height_cm = max(10, min(80, jump_height_cm))  # Between 10-80 cm
            
            # Find takeoff and landing frames
            threshold = 0.01  # 1% threshold
            in_air = hip_ys < (baseline - threshold)
            
            if np.any(in_air):
                # Find first and last frame where person is in air
                air_indices = np.where(in_air)[0]
                takeoff_idx = air_indices[0]
                landing_idx = air_indices[-1]
                hang_time = times[landing_idx] - times[takeoff_idx]
            else:
                # If no clear air time detected, estimate based on peak
                hang_time = 0.3  # Default hang time
            
            # Ensure reasonable hang time
            hang_time = max(0.1, min(1.0, hang_time))
            
            # Calculate takeoff velocity using physics
            takeoff_velocity = np.sqrt(2 * 9.8 * jump_height_cm / 100)
            
            # Assess technique
            technique_score = self._assess_jump_technique(hip_positions, feet_positions)
            
            # Calculate AI score
            ai_score = self._calculate_vertical_score(jump_height_cm, hang_time, technique_score)
            
            print(f"Final results - Height: {jump_height_cm:.1f}cm, Hang time: {hang_time:.2f}s, AI Score: {ai_score:.1f}")
            
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
            import traceback
            traceback.print_exc()
            return self._error_result(f"Analysis error: {str(e)}")
    
    def _assess_jump_technique(self, hip_positions: list, feet_positions: list) -> float:
        """Assess jump technique based on movement patterns"""
        try:
            hip_ys = np.array([p[2] for p in hip_positions])
            
            # Check for smooth motion (less jerky = better)
            # Calculate second derivative to measure smoothness
            if len(hip_ys) > 2:
                velocity = np.diff(hip_ys)
                acceleration = np.diff(velocity)
                smoothness_score = 50 / (1 + np.std(acceleration) * 100)
            else:
                smoothness_score = 25
            
            # Check for proper crouch before jump (first third of movement)
            pre_jump_positions = hip_ys[:len(hip_ys)//3]
            if len(pre_jump_positions) > 1:
                crouch_depth = np.ptp(pre_jump_positions)  # peak-to-peak
                crouch_score = min(50, crouch_depth * 500)  # Scale appropriately
            else:
                crouch_score = 25
            
            technique = smoothness_score + crouch_score
            return min(100, max(0, technique))
        except Exception as e:
            print(f"Error in technique assessment: {e}")
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
            feedback += "\n📐 Technique tip: Work on your pre-jump crouch and landing form"
        
        return feedback
    
    def _error_result(self, error_msg: str) -> Dict[str, Any]:
        """Return error result"""
        return {
            "success": False,
            "error": error_msg,
            "ai_score": 0,
            "feedback": f"❌ Analysis failed: {error_msg}"
        }
