# backend/ml_models/vertical_jump_analyzer.py

import cv2
import numpy as np
import mediapipe as mp
from typing import Dict, Any

class VerticalJumpAnalyzer:
    def analyze_video(self, video_path: str) -> Dict[str, Any]:
        """
        Analyze vertical jump video using a pure Python approach with MediaPipe.
        This is the primary analysis method.
        """
        print("INFO: Starting Python-based vertical jump analysis.")
        return self._python_fallback_analysis(video_path)

    def _python_fallback_analysis(self, video_path: str) -> Dict[str, Any]:
        """Fallback analysis using OpenCV and basic physics"""
        try:
            mp_pose = mp.solutions.pose
            
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return {"success": False, "error": "Unable to open video file"}
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps is None or fps == 0: fps = 30 # Default FPS if not available

            height_px = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            positions = []
            with mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5) as pose:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    if results.pose_landmarks:
                        left_hip = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_HIP]
                        right_hip = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_HIP]
                        hip_y = (left_hip.y + right_hip.y) / 2.0
                        positions.append(hip_y)
            
            cap.release()
            
            if len(positions) < 10:
                return {"success": False, "error": "Not enough movement detected for analysis"}
            
            positions = np.array(positions)
            baseline = np.median(positions[:5]) # Use first 5 frames as standing baseline
            peak = np.min(positions) # Min y-value is the highest point
            
            # Simple calibration: Assume person's height is ~90% of frame height in pixels
            # This is a rough estimate and can be improved with a reference object.
            person_height_px = height_px * 0.9
            cm_per_pixel = 175 / person_height_px # Assume average height of 175cm
            
            jump_height_pixels = (baseline - peak) * height_px
            jump_height_cm = jump_height_pixels * cm_per_pixel
            
            if jump_height_cm < 2: # Filter out noise
                return {"success": False, "error": "Jump height too low to be considered valid."}

            # Physics calculations
            g = 9.81 # m/s^2
            hang_time = np.sqrt((2 * (jump_height_cm / 100)) / g) * 2
            takeoff_velocity = g * (hang_time / 2)
            
            ai_score = self._calculate_score_from_height(jump_height_cm)
            
            return {
                "success": True,
                "jump_height_cm": float(jump_height_cm),
                "hang_time_s": float(hang_time),
                "takeoff_velocity": float(takeoff_velocity),
                "ai_score": ai_score,
                "feedback": self._generate_feedback_from_height(jump_height_cm)
            }
            
        except Exception as e:
            print(f"Fallback analysis error: {e}")
            return {"success": False, "error": str(e)}

    def _calculate_score_from_height(self, height_cm: float) -> float:
        """Calculate score based on jump height"""
        if height_cm >= 60: score = 95 + (height_cm - 60) * 0.2
        elif height_cm >= 45: score = 80 + (height_cm - 45) * 1.0
        elif height_cm >= 30: score = 60 + (height_cm - 30) * 1.33
        elif height_cm >= 15: score = 40 + (height_cm - 15) * 1.33
        else: score = max(0, height_cm * 2.67)
        return min(100.0, max(0.0, score))
    
    def _generate_feedback_from_height(self, height_cm: float) -> str:
        """Generate feedback based on jump height"""
        feedback = f"ðŸ¦˜ Vertical Jump Analysis:\n\n"
        if height_cm >= 60: performance = "Elite level! ðŸŒŸ"
        elif height_cm >= 45: performance = "Excellent! ðŸŽ¯"
        elif height_cm >= 30: performance = "Good! ðŸ‘ "
        elif height_cm >= 15: performance = "Fair ðŸ’ª"
        else: performance = "Needs improvement"
        
        feedback += f"â€¢ Jump Height: {height_cm:.1f} cm\n"
        feedback += f"â€¢ Performance: {performance}\n"
        
        return feedback
