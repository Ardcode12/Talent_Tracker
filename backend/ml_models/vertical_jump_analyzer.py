import os
import json
import subprocess
import tempfile
from pathlib import Path
import cv2
import numpy as np
from typing import Dict, Any

class VerticalJumpAnalyzer:
    def __init__(self):
        self.model_path = Path(__file__).parent / "vertical"
        self.node_path = self.model_path / "dist" / "server.js"
        
        # Check if the TypeScript model is built
        if not self.node_path.exists():
            raise RuntimeError(f"Vertical jump model not built. Run 'npm run build' in {self.model_path}")
    
    def analyze_video(self, video_path: str) -> Dict[str, Any]:
        """Analyze vertical jump video and return metrics"""
        try:
            # First, do a quick video validation
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return {
                    "success": False,
                    "error": "Unable to open video file"
                }
            
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            duration = frame_count / fps if fps > 0 else 0
            cap.release()
            
            if duration < 1:
                return {
                    "success": False,
                    "error": "Video too short for jump analysis"
                }
            
            # Call the TypeScript analyzer
            result = subprocess.run(
                ["node", str(self.node_path), "analyze", video_path],
                capture_output=True,
                text=True,
                cwd=str(self.model_path)
            )
            
            if result.returncode != 0:
                print(f"Node.js error: {result.stderr}")
                # Fallback to Python-based analysis
                return self._python_fallback_analysis(video_path)
            
            # Parse the output
            try:
                analysis_result = json.loads(result.stdout)
                return {
                    "success": True,
                    "jump_height_cm": analysis_result.get("jumpHeight", 0),
                    "hang_time_s": analysis_result.get("hangTime", 0),
                    "takeoff_velocity": analysis_result.get("takeoffVelocity", 0),
                    "landing_quality": analysis_result.get("landingQuality", "Unknown"),
                    "technique_score": analysis_result.get("techniqueScore", 0),
                    "ai_score": self._calculate_ai_score(analysis_result),
                    "feedback": self._generate_feedback(analysis_result)
                }
            except json.JSONDecodeError:
                return self._python_fallback_analysis(video_path)
                
        except Exception as e:
            print(f"Vertical jump analysis error: {e}")
            return self._python_fallback_analysis(video_path)
    
    def _python_fallback_analysis(self, video_path: str) -> Dict[str, Any]:
        """Fallback analysis using OpenCV and basic physics"""
        try:
            import mediapipe as mp
            mp_pose = mp.solutions.pose
            
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            positions = []
            with mp_pose.Pose(static_image_mode=False) as pose:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    if results.pose_landmarks:
                        # Get hip position (center of mass approximation)
                        left_hip = results.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_HIP]
                        right_hip = results.pose_landmarks.landmark[mp_pose.PoseLandmark.RIGHT_HIP]
                        hip_y = (left_hip.y + right_hip.y) / 2
                        positions.append(hip_y)
            
            cap.release()
            
            if len(positions) < 10:
                return {
                    "success": False,
                    "error": "Not enough frames for analysis"
                }
            
            # Find jump height (difference between lowest and highest point)
            positions = np.array(positions)
            baseline = np.median(positions[:10])  # First 10 frames as baseline
            peak = np.min(positions)  # Minimum because y-axis is inverted
            
            # Convert to real-world measurements (approximate)
            # Assuming average person height of 170cm
            pixel_height_ratio = 170 / 1.0  # Full frame height
            jump_height_cm = (baseline - peak) * pixel_height_ratio
            
            # Calculate hang time
            above_baseline = positions < (baseline - 0.05)
            if np.any(above_baseline):
                first_above = np.argmax(above_baseline)
                last_above = len(above_baseline) - np.argmax(above_baseline[::-1]) - 1
                hang_time = (last_above - first_above) / fps
            else:
                hang_time = 0
            
            # Calculate AI score
            ai_score = self._calculate_score_from_height(jump_height_cm)
            
            return {
                "success": True,
                "jump_height_cm": float(jump_height_cm),
                "hang_time_s": float(hang_time),
                "takeoff_velocity": float(np.sqrt(2 * 9.8 * jump_height_cm / 100)),
                "landing_quality": "Good" if jump_height_cm > 20 else "Fair",
                "technique_score": 70 + min(30, jump_height_cm / 2),
                "ai_score": ai_score,
                "feedback": self._generate_feedback_from_height(jump_height_cm)
            }
            
        except Exception as e:
            print(f"Fallback analysis error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _calculate_ai_score(self, analysis: Dict) -> float:
        """Calculate AI score based on jump metrics"""
        jump_height = analysis.get("jumpHeight", 0)
        technique = analysis.get("techniqueScore", 0)
        landing = 1.0 if analysis.get("landingQuality") == "Good" else 0.7
        
        # Weighted score
        height_score = min(100, (jump_height / 60) * 100)  # 60cm is excellent
        final_score = (height_score * 0.6 + technique * 0.3 + landing * 100 * 0.1)
        
        return min(100, max(0, final_score))
    
    def _calculate_score_from_height(self, height_cm: float) -> float:
        """Calculate score based on jump height"""
        if height_cm >= 60:
            return 95 + (height_cm - 60) * 0.1  # Excellent
        elif height_cm >= 45:
            return 80 + (height_cm - 45) * 1.0  # Good
        elif height_cm >= 30:
            return 60 + (height_cm - 30) * 1.33  # Fair
        elif height_cm >= 15:
            return 40 + (height_cm - 15) * 1.33  # Below average
        else:
            return max(0, height_cm * 2.67)  # Poor
    
    def _generate_feedback(self, analysis: Dict) -> str:
        """Generate feedback based on analysis"""
        height = analysis.get("jumpHeight", 0)
        return self._generate_feedback_from_height(height)
    
    def _generate_feedback_from_height(self, height_cm: float) -> str:
        """Generate feedback based on jump height"""
        feedback = f"🦘 Vertical Jump Analysis:\n\n"
        feedback += f"• Jump height: {height_cm:.1f} cm\n"
        
        if height_cm >= 60:
            feedback += "• Performance: Elite level! 🌟\n"
            feedback += "• Category: Professional athlete\n"
            feedback += "\n💡 Tips:\n"
            feedback += "  - Maintain this exceptional performance\n"
            feedback += "  - Focus on injury prevention\n"
            feedback += "  - Consider sport-specific training"
        elif height_cm >= 45:
            feedback += "• Performance: Excellent! 🎯\n"
            feedback += "• Category: Advanced\n"
            feedback += "\n💡 Tips:\n"
            feedback += "  - Work on explosive power\n"
            feedback += "  - Add plyometric exercises\n"
            feedback += "  - Focus on landing mechanics"
        elif height_cm >= 30:
            feedback += "• Performance: Good! 👍\n"
            feedback += "• Category: Intermediate\n"
            feedback += "\n💡 Tips:\n"
            feedback += "  - Strengthen leg muscles\n"
            feedback += "  - Practice jump technique\n"
            feedback += "  - Work on core stability"
        elif height_cm >= 15:
            feedback += "• Performance: Fair 💪\n"
            feedback += "• Category: Beginner\n"
            feedback += "\n💡 Tips:\n"
            feedback += "  - Focus on basic strength training\n"
            feedback += "  - Practice bodyweight squats\n"
            feedback += "  - Work on flexibility"
        else:
            feedback += "• Performance: Needs improvement\n"
            feedback += "• Category: Starter\n"
            feedback += "\n💡 Tips:\n"
            feedback += "  - Start with basic exercises\n"
            feedback += "  - Focus on form over height\n"
            feedback += "  - Build foundational strength"
        
        return feedback
    