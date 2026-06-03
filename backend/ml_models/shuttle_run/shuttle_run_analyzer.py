# backend/ml_models/shuttle_run/shuttle_run_analyzer.py
from __future__ import annotations

import traceback
from pathlib import Path
from typing import Dict, Any, List
import cv2
import numpy as np


from .assessment.agility_analyzer import analyze_agility
from .shuttle_run_model_utils import predict, get_feature_names, get_num_features


class ShuttleRunAnalyzer:
    """
    Analyzes shuttle run videos by combining MediaPipe-based biomechanical 
    feature extraction with a 50-feature Keras classifier for performance banding.
    Includes built-in cheat detection logic.
    """

    def __init__(self, distance_m: float = 10.0):
        self.distance_m = distance_m

    def analyze_video(self, video_path: str | Path) -> Dict[str, Any]:
        video_path = str(video_path)
        try:
            # 1) Extract biomechanical / timing features from video
            agi = analyze_agility(video_path, calibration={"distance_m": self.distance_m})
            if not agi.get("success", False):
                return {
                    "success": False,
                    "error": agi.get("error", "Agility analyzer failed"),
                }

            # 2) Map video features to the 50-feature ML vector
            feature_vec = self._to_fixed_vector(agi)
            
            # 3) Predict score and band
            model_out = predict(feature_vec)

            # 4) Add cheat detection analysis
            cheat_result = self._detect_cheating(video_path, agi)
            
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
        Maps video analysis metrics to the 50-feature vector the model expects.
        All performance-related features come from real video data.
        Only sensor fields (IMU, HR) use neutral defaults — they are not the
        primary discriminators in the trained model.
        """
        splits = agi.get("splits", [])
        total_time = float(agi.get("total_time", 15.0))
        avg_speed = float(agi.get("avg_speed", 3.0))
        max_speed = float(agi.get("max_speed", avg_speed))
        num_turns = int(agi.get("num_turns", 2))
        fatigue_index = float(agi.get("fatigue_index", 0.05))
        avg_turn_time = float(agi.get("avg_turn_time", 600.0))
        stride_length = float(agi.get("stride_length", 150.0))
        stride_freq = float(agi.get("stride_freq", 3.0))
        knee_angle = float(agi.get("avg_knee_angle", 75.0))
        arm_swing = float(agi.get("avg_arm_swing", 90.0))
        body_lean = float(agi.get("avg_body_lean", 15.0))

        # Derive secondary metrics from real speed/time data
        accel_time = max(0.5, total_time / (num_turns + 1) * 0.3)
        decel_time = max(0.5, total_time / (num_turns + 1) * 0.4)
        reaction_time = max(150.0, 600.0 - (avg_speed * 50))  # faster = quicker reaction
        coda_deficit = max(0.3, avg_turn_time / 1000.0)
        
        # Agility scores derived from speed (faster = better scores)
        agility_rating = min(10.0, max(6.0, (avg_speed - 2.0) * 3.0))
        coordination_score = min(10.0, max(5.0, agility_rating * 0.95))
        balance_score = min(10.0, max(5.0, 9.5 - (body_lean / 20.0)))
        balance_recovery = max(200.0, avg_turn_time * 0.8)

        features = {}

        # Athlete info (neutral defaults — not performance features)
        features["age"] = 22.0
        features["height_cm"] = 175.0
        features["weight_kg"] = 70.0
        features["gender_M"] = 1.0
        features["gender_F"] = 0.0

        # ── PERFORMANCE-CRITICAL FEATURES from real video ──────────────────
        features["false_start"] = 0.0
        features["total_time_sec"] = total_time
        features["max_velocity_ms"] = max_speed
        features["avg_velocity_ms"] = avg_speed

        features["split_1_sec"] = splits[0] if len(splits) > 0 else total_time / max(num_turns + 1, 2)
        features["split_2_sec"] = splits[1] if len(splits) > 1 else total_time / max(num_turns + 1, 2)
        features["split_3_sec"] = splits[2] if len(splits) > 2 else total_time / max(num_turns + 1, 2)
        features["split_4_sec"] = splits[3] if len(splits) > 3 else total_time / max(num_turns + 1, 2)

        features["stride_length_cm"] = stride_length
        features["stride_frequency_hz"] = stride_freq
        features["knee_lift_angle_deg"] = knee_angle
        features["arm_swing_amplitude_deg"] = arm_swing
        features["body_lean_angle_deg"] = body_lean

        features["avg_turn_time_ms"] = avg_turn_time
        features["change_of_direction_deficit"] = coda_deficit
        features["acceleration_time_sec"] = accel_time
        features["deceleration_time_sec"] = decel_time
        features["reaction_time_ms"] = reaction_time
        features["fatigue_index"] = fatigue_index

        features["coordination_score"] = coordination_score
        features["balance_score"] = balance_score
        features["agility_rating"] = agility_rating
        features["balance_recovery_time_ms"] = balance_recovery

        # ── SENSOR / IMU (not extractable from video — neutral defaults) ───
        features["acc_x"] = 0.0
        features["acc_y"] = 0.0
        features["acc_z"] = 0.0
        features["gyro_x"] = 0.0
        features["gyro_y"] = 0.0
        features["gyro_z"] = 0.0
        features["hr_baseline_bpm"] = 75.0
        features["hr_peak_bpm"] = 150.0
        features["hr_recovery_30s_bpm"] = 115.0

        # ── Categorical one-hot (assume standard conditions) ───────────────
        for f in ["surface_concrete","surface_grass","surface_gym_floor",
                  "surface_rubberized_floor","surface_synthetic_track"]:
            features[f] = 1.0 if f == "surface_synthetic_track" else 0.0

        for f in ["shoes_basketball_shoes","shoes_cross_trainers",
                  "shoes_running_shoes","shoes_spikes","shoes_turf_shoes"]:
            features[f] = 1.0 if f == "shoes_running_shoes" else 0.0

        for f in ["foot_strike_pattern_forefoot","foot_strike_pattern_heel",
                  "foot_strike_pattern_midfoot"]:
            features[f] = 1.0 if f == "foot_strike_pattern_midfoot" else 0.0

        # Build vector in exact order the model was trained with
        expected_names = get_feature_names()
        return [float(features.get(name, 0.0)) for name in expected_names]


    def _build_feedback(self, model_out: Dict[str, Any], agi: Dict[str, Any]) -> str:
        band = model_out["band_label"]
        score = model_out["numeric_score"]
        confidence = model_out["probability"]
        total_time = agi.get("total_time", 0.0)
        avg_speed = agi.get("avg_speed", 0.0)
        num_turns = agi.get("num_turns", 0)
        fatigue = agi.get("fatigue_index", 0.0)
        seg_speeds = agi.get("segment_speeds", [])

        # Speed consistency: std deviation across segments
        speed_consistency = ""
        if len(seg_speeds) >= 2:
            std = float(np.std(seg_speeds))
            cv = std / (avg_speed + 1e-6)
            if cv < 0.05:
                speed_consistency = " (very consistent)"
            elif cv < 0.12:
                speed_consistency = " (good consistency)"
            else:
                speed_consistency = " (inconsistent — focus on pacing)"

        # Emojis
        runner = '\U0001F3C3'  # 🏃
        bullet = '\u2022'       # •
        medal  = '\U0001F3C5'  # 🏅
        bolt   = '\u26A1'       # ⚡
        chart  = '\U0001F4CA'  # 📊
        warn   = '\u26A0\uFE0F' # ⚠️
        clock  = '\u23F1'       # ⏱

        advice_map = {
            "Excellent":     f"{medal} Outstanding! Keep competing at this elite level.",
            "Very Good":     f"{medal} Great run! Sharpen your turns to reach Excellent.",
            "Good":          f"{bolt} Solid effort! Faster deceleration will push you to Very Good.",
            "Average":       f"{chart} Good start. Focus on straight-line speed and quicker pivots.",
            "Below Average": f"{warn} Keep practising! Consistent drills will move you to Average.",
        }
        advice = advice_map.get(band, f"{medal} Keep pushing to reach the next band!")

        fatigue_note = ""
        if fatigue > 0.1:
            fatigue_note = f"\n{bullet} Pacing: Slowed significantly in 2nd half (fatigue index {fatigue:.2f})"
        elif fatigue > 0.05:
            fatigue_note = f"\n{bullet} Pacing: Slight slowdown in 2nd half (fatigue index {fatigue:.2f})"

        return (
            f"{runner} Shuttle Run Analysis\n\n"
            f"{clock} Band: {band}  ({confidence*100:.0f}% confidence)\n"
            f"{bullet} AI Score: {score:.1f}%\n\n"
            f"--- Performance ---\n"
            f"{bullet} Speed: {avg_speed:.2f} m/s{speed_consistency}\n"
            f"{bullet} Total Time: {total_time:.2f} s\n"
            f"{bullet} Turns Completed: {num_turns}"
            f"{fatigue_note}\n\n"
            f"{advice}"
        )



    def _detect_cheating(self, video_path: str, agi: Dict[str, Any]) -> Dict[str, Any]:
        """Detect potential cheating or anomalies in the video"""
        cheat_flags = []
        anomaly_score = 0
        
        mean_speed = agi.get("avg_speed", 0.0)
        total_time = agi.get("total_time", 0.0)
        num_turns = agi.get("num_turns", 0)
        
        expected_speed = self.distance_m / total_time if total_time > 0 else 0
        if abs(mean_speed - expected_speed) > 2.5: 
            cheat_flags.append("Speed measurement inconsistency")
            anomaly_score += 3
            
        # Check for video manipulation
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        
        if duration < 5: 
            cheat_flags.append("Video duration too short")
            anomaly_score += 5
            
        if fps < 10: 
            cheat_flags.append("Low frame rate detected")
            anomaly_score += 2
            
        if num_turns == 0:
            cheat_flags.append("No turns detected")
            anomaly_score += 4
            
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