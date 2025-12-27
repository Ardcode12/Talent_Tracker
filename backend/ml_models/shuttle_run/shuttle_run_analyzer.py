# backend/ml_models/shuttle_run/shuttle_run_analyzer_enhanced.py
from __future__ import annotations

import traceback
from pathlib import Path
from typing import Dict, Any, Tuple, List
import numpy as np
import cv2
import mediapipe as mp

# Use relative imports within the package
from .assessment.agility_analyzer import analyze_agility
from .shuttle_run_model_utils import predict, get_feature_names

# Initialize MediaPipe
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

class ShuttleRunAnalyzer:
    """
    Enhanced analyzer with cheat detection capabilities
    """

    def __init__(self, distance_m: float = 10.0):
        self.distance_m = distance_m

    def analyze_video(self, video_path: str | Path) -> Dict[str, Any]:
        video_path = str(video_path)
        try:
            # 1) Extract biomechanical / timing features -------------------
            agi = analyze_agility(video_path, calibration={"distance_m": self.distance_m})
            if not agi.get("success", False):
                return {
                    "success": False,
                    "error": agi.get("error", "Agility analyser failed"),
                }

            feature_vec = self._to_fixed_vector(agi)
            model_out = predict(feature_vec)

            # 2) Add cheat detection analysis -----------------------------
            cheat_result = self._detect_cheating(video_path, feature_vec)
            
            return {
                "success": True,
                "features": feature_vec,
                "band_prediction": model_out["band_label"],
                "confidence": model_out["probability"],
                "ai_score": model_out["numeric_score"],
                "feedback": self._build_feedback(model_out, agi),
                "cheat_detection": cheat_result,
                "details": agi,
            }
        except Exception as exc:
            traceback.print_exc()
            return {"success": False, "error": str(exc)}

    def _to_fixed_vector(self, agi: Dict[str, Any]) -> List[float]:
        """
        Convert the variable-length dictionary returned by analyze_agility()
        into the fixed-length vector expected by the ML model.
        """
        splits = agi.get("splits", [])
        mean_speed = float(agi.get("avg_speed", 0.0))
        total_time = float(agi.get("total_time", 0.0))
        num_turns = int(agi.get("num_turns", 0))

        vec = [mean_speed, total_time, num_turns] + splits
        if len(vec) > _N_FEATURES:
            vec = vec[:_N_FEATURES]
        else:
            vec += [0.0] * (_N_FEATURES - len(vec))
        return vec

    def _build_feedback(self, model_out: Dict[str, Any], agi: Dict[str, Any]) -> str:
        band = model_out["band_label"]
        score = model_out["numeric_score"]
        total_time = agi.get("total_time", 0.0)

        return (
            f"ðŸƒâ€â™‚ï¸ Shuttle-Run Analysis\n"
            f"â€¢ Band: {band}\n"
            f"â€¢ AI Score: {score:.1f}%\n"
            f"â€¢ Total Time: {total_time:.2f} s\n"
            f"\nKeep training to move to the next band!"
        )

    def _detect_cheating(self, video_path: str, feature_vec: List[float]) -> Dict[str, Any]:
        """Detect potential cheating patterns in the video"""
        cheat_flags = []
        anomaly_score = 0
        
        # 1) Check for unrealistic acceleration
        mean_speed = feature_vec[0]
        total_time = feature_vec[1]
        
        # Calculate expected speed based on distance and time
        expected_speed = self.distance_m / total_time if total_time > 0 else 0
        
        # If reported speed doesn't match calculated speed
        if abs(mean_speed - expected_speed) > 2.0:  # 2 m/s threshold
            cheat_flags.append("Speed measurement inconsistency")
            anomaly_score += 3
        
        # 2) Check for video manipulation
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        
        # Check for unusually short videos for shuttle run
        if duration < 10:  # 10 seconds minimum
            cheat_flags.append("Video duration too short")
            anomaly_score += 5
            
        # 3) Check for frame dropping anomalies
        if frame_count / duration < 10:  # Less than 10 fps
            cheat_flags.append("Low frame rate detected")
            anomaly_score += 2
            
        cap.release()
        
        # 4) Check feature vector anomalies
        if feature_vec[2] == 0:  # Number of turns is zero
            cheat_flags.append("No turns detected")
            anomaly_score += 4
            
        # Determine overall status
        status = "clean"
        if anomaly_score >= 5:
            status = "flagged"
        elif anomaly_score >= 2:
            status = "suspicious"
            
        return {
            "status": status,
            "anomaly_score": anomaly_score,
            "flags": cheat_flags,
            "video_metadata": {
                "duration": duration,
                "fps": fps,
                "frame_count": frame_count
            }
        }

# For a *very* small model we fixed the feature vector length to 20
_N_FEATURES = len(get_feature_names())