# backend/ml_models/situp/situp_analyzer.py
"""
Sit-Up Analyzer
===============
Uses a trained position classifier (sit_up / sit_down) to count
rep transitions from MediaPipe pose landmarks extracted per video frame.

Rep counting logic:
  DOWN → UP → DOWN = 1 complete rep

Model files required in this directory:
  - situp_classifier.tflite   (or situp_classifier.keras)
  - situp_scaler.pkl
  - situp_model_config.json
"""

import cv2
import json
import numpy as np
import traceback
from pathlib import Path
from typing import Dict, Any, Optional, List

import mediapipe as mp
import joblib

_DIR = Path(__file__).parent
_TFLITE_PATH = _DIR / "situp_classifier.tflite"
_KERAS_PATH  = _DIR / "situp_classifier.keras"
_SCALER_PATH = _DIR / "situp_scaler.pkl"
_CONFIG_PATH = _DIR / "situp_model_config.json"

_POSE_MODEL  = Path(__file__).parent.parent / "pose_landmarker_lite.task"

# All 33 MediaPipe landmark indices mapped to their names in the Kaggle CSV
_MP_NAME_TO_IDX = {
    "nose": 0, "left_eye_inner": 1, "left_eye": 2, "left_eye_outer": 3,
    "right_eye_inner": 4, "right_eye": 5, "right_eye_outer": 6,
    "left_ear": 7, "right_ear": 8, "mouth_left": 9, "mouth_right": 10,
    "left_shoulder": 11, "right_shoulder": 12, "left_elbow": 13,
    "right_elbow": 14, "left_wrist": 15, "right_wrist": 16,
    "left_pinky_1": 17, "right_pinky_1": 18, "left_index_1": 19,
    "right_index_1": 20, "left_thumb_2": 21, "right_thumb_2": 22,
    "left_hip": 23, "right_hip": 24, "left_knee": 25, "right_knee": 26,
    "left_ankle": 27, "right_ankle": 28, "left_heel": 29, "right_heel": 30,
    "left_foot_index": 31, "right_foot_index": 32,
    # Fallbacks for some common naming variations
    "left_pinky": 17, "right_pinky": 18, "left_index": 19, "right_index": 20,
    "left_thumb": 21, "right_thumb": 22
}

G = {
    "situp": "\U0001F9D8",  # 🧘
    "fire":  "\U0001F525",  # 🔥
    "check": "\u2705",      # ✅
    "warn":  "\u26A0\uFE0F",# ⚠️
    "medal": "\U0001F3C5",  # 🏅
    "chart": "\U0001F4CA",  # 📊
    "bullet":"\u2022",      # •
    "bolt":  "\u26A1",      # ⚡
    "muscle":"\U0001F4AA",  # 💪
    "star":  "\u2B50",      # ⭐
}

# Scoring standards — based on Army/police physical fitness test norms
# for a 2-minute sit-up test. Adapted for 1-minute (divide by ~1.5)
_SCORE_TABLE = [
    (50, 100),   # 50+ reps = 100 pts (elite)
    (45, 90),
    (40, 80),
    (35, 70),
    (30, 60),
    (25, 50),
    (20, 40),
    (15, 30),
    (10, 20),
    (5,  10),
    (0,   0),
]


def _score_from_reps(reps: int) -> float:
    for threshold, pts in _SCORE_TABLE:
        if reps >= threshold:
            return float(pts)
    return 0.0


def _band_from_reps(reps: int) -> tuple:
    if reps >= 50: return "Elite",         "\U0001F31F"
    if reps >= 40: return "Excellent",     "\U0001F3AF"
    if reps >= 30: return "Very Good",     "\U0001F3C5"
    if reps >= 20: return "Good",          "\U0001F44D"
    if reps >= 10: return "Average",       "\U0001F4CA"
    return             "Below Average",    "\U0001F4AA"


class SitUpAnalyzer:

    def __init__(self):
        self._tflite   = None
        self._keras    = None
        self._scaler   = None
        self._config   = None
        self._n_feats  = None
        self._loaded   = False

    def _load_model(self) -> bool:
        """Lazy-load model files."""
        if self._loaded:
            return True

        if not _SCALER_PATH.exists():
            print(f"  [SitUp] Scaler not found: {_SCALER_PATH}")
            return False

        if not _CONFIG_PATH.exists():
            print(f"  [SitUp] Config not found: {_CONFIG_PATH}")
            return False

        try:
            self._scaler = joblib.load(_SCALER_PATH)
            with open(_CONFIG_PATH) as f:
                self._config = json.load(f)
            self._n_feats = self._config["num_features"]

            # Try TFLite first (faster), then Keras
            if _TFLITE_PATH.exists():
                import tensorflow as tf
                self._tflite = tf.lite.Interpreter(model_path=str(_TFLITE_PATH))
                self._tflite.allocate_tensors()
                self._in_idx  = self._tflite.get_input_details()[0]['index']
                self._out_idx = self._tflite.get_output_details()[0]['index']
                print("  [SitUp] Loaded TFLite model ✅")
            elif _KERAS_PATH.exists():
                import tensorflow as tf
                self._keras = tf.keras.models.load_model(str(_KERAS_PATH))
                print("  [SitUp] Loaded Keras model ✅")
            else:
                print(f"  [SitUp] No model file found.")
                return False

            self._loaded = True
            return True

        except Exception as e:
            print(f"  [SitUp] Model load error: {e}")
            return False

    def _predict(self, landmarks_flat: np.ndarray) -> int:
        """
        Predict position class.
        Returns: 0 = sit_down, 1 = sit_up
        """
        # Match expected feature count (pad or trim)
        if len(landmarks_flat) < self._n_feats:
            landmarks_flat = np.pad(landmarks_flat, (0, self._n_feats - len(landmarks_flat)))
        else:
            landmarks_flat = landmarks_flat[:self._n_feats]

        x = self._scaler.transform([landmarks_flat]).astype(np.float32)

        if self._tflite:
            self._tflite.set_tensor(self._in_idx, x)
            self._tflite.invoke()
            probs = self._tflite.get_tensor(self._out_idx)[0]
        else:
            probs = self._keras.predict(x, verbose=0)[0]

        return int(np.argmax(probs))

    def _extract_landmarks(self, lm_world) -> np.ndarray:
        """Extract exactly the features expected by the model config, converted to cm."""
        coords = []
        if self._config and "feature_names" in self._config:
            for feat in self._config["feature_names"]:
                parts = feat.split('_', 1)
                if len(parts) == 2:
                    coord, part = parts
                    idx = _MP_NAME_TO_IDX.get(part)
                    if idx is not None:
                        # Multiply by 100 to convert meters to centimeters (Kaggle dataset scale)
                        if coord == 'x': coords.append(lm_world[idx].x * 100.0)
                        elif coord == 'y': coords.append(lm_world[idx].y * 100.0)
                        elif coord == 'z': coords.append(lm_world[idx].z * 100.0)
                        elif coord in ('v', 'vis'): coords.append(lm_world[idx].visibility)
                        else: coords.append(0.0)
                    else:
                        coords.append(0.0)
                else:
                    coords.append(0.0)
        else:
            # Fallback if config is missing feature_names
            for i in range(33):
                coords.extend([lm_world[i].x * 100.0, lm_world[i].y * 100.0, lm_world[i].z * 100.0, lm_world[i].visibility])
                
        return np.array(coords, dtype=np.float32)

    def analyze_video(
        self,
        video_path: str,
        target_reps: int = 30,
    ) -> Dict[str, Any]:
        try:
            print(f"\n=== Sit-Up Analysis: {video_path} ===")

            if not self._load_model():
                return self._error(
                    "Sit-up model not loaded. Please train and upload the model files."
                )

            if not _POSE_MODEL.exists():
                return self._error("Pose model file not found.")

            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return self._error("Could not open video file.")

            fps         = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            print(f"    Video: {total_frames} frames @ {fps:.0f} FPS")

            if total_frames < 15:
                cap.release()
                return self._error("Video too short.")

            # ── Extract pose per frame ─────────────────────────────────────
            options = mp.tasks.vision.PoseLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(_POSE_MODEL)),
                running_mode=mp.tasks.vision.RunningMode.VIDEO,
                min_pose_detection_confidence=0.4,
                min_pose_presence_confidence=0.4,
                min_tracking_confidence=0.4,
            )

            frame_predictions: List[int] = []
            frame_idx = 0

            with mp.tasks.vision.PoseLandmarker.create_from_options(options) as lm_model:
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break

                    ts_ms = int(frame_idx * 1000 / fps)
                    frame_idx += 1

                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

                    try:
                        result = lm_model.detect_for_video(mp_img, ts_ms)
                    except Exception:
                        frame_predictions.append(-1)
                        continue

                    if not result or not result.pose_world_landmarks:
                        frame_predictions.append(-1)
                        continue

                    lm_flat = self._extract_landmarks(result.pose_world_landmarks[0])
                    pred    = self._predict(lm_flat)
                    frame_predictions.append(pred)

            cap.release()

            # ── Validate: enough pose frames ───────────────────────────────
            valid_preds = [p for p in frame_predictions if p != -1]
            print(f"    Valid frames: {len(valid_preds)}/{frame_idx}")

            if len(valid_preds) < 10:
                return self._error(
                    "Not enough pose detections. "
                    "Ensure full body is visible from the side."
                )

            # ── Validate: is it actually a sit-up video? ───────────────────
            up_frac   = valid_preds.count(1) / len(valid_preds)
            down_frac = valid_preds.count(0) / len(valid_preds)

            if up_frac < 0.05 or down_frac < 0.05:
                return self._error(
                    "This does not appear to be a sit-up video. "
                    "The video should show complete up and down positions."
                )

            # ── Count reps: smooth → detect transitions ────────────────────
            # Smooth predictions with a 5-frame majority window to remove noise
            smoothed = self._smooth_predictions(valid_preds, window=5)

            rep_count, rep_frames = self._count_reps(smoothed)
            print(f"    Reps detected: {rep_count}")

            if rep_count == 0:
                return self._error(
                    "No complete sit-up reps detected. "
                    "Ensure you perform full reps (all the way up and all the way down)."
                )

            # ── Quality: check full range of motion ───────────────────────
            quality = self._assess_quality(smoothed, rep_frames)

            # ── Score ──────────────────────────────────────────────────────
            base_score   = _score_from_reps(rep_count)
            quality_mult = 0.7 + 0.3 * quality  # quality between 0.7x and 1.0x
            ai_score     = float(min(100.0, base_score * quality_mult))

            band, band_icon = _band_from_reps(rep_count)

            feedback = self._build_feedback(
                rep_count, ai_score, band, band_icon,
                quality, quality_mult, up_frac, down_frac
            )

            print(f"    Score: {ai_score:.1f} | Band: {band}")

            return {
                "success":        True,
                "ai_score":       round(ai_score, 1),
                "reps":           rep_count,
                "quality":        round(quality * 100, 1),
                "performance_band": band,
                "feedback":       feedback,
            }

        except Exception as e:
            traceback.print_exc()
            return self._error(f"Analysis error: {e}")

    # ── Helpers ────────────────────────────────────────────────────────────
    def _smooth_predictions(self, preds: List[int], window: int = 5) -> List[int]:
        """Majority-vote smoothing to remove single-frame noise."""
        smoothed = []
        half = window // 2
        for i in range(len(preds)):
            lo = max(0, i - half)
            hi = min(len(preds), i + half + 1)
            segment = preds[lo:hi]
            vote = 1 if segment.count(1) > segment.count(0) else 0
            smoothed.append(vote)
        return smoothed

    def _count_reps(self, smoothed: List[int]):
        """
        Count complete reps: DOWN → UP → DOWN = 1 rep.
        Returns (rep_count, list of rep end frame indices).
        """
        reps       = 0
        rep_frames = []
        state      = smoothed[0]  # starting state
        phase      = "waiting"    # waiting, going_up, going_down

        for i, pred in enumerate(smoothed):
            if phase == "waiting":
                if pred == 0:     # in DOWN position
                    phase = "in_down"
            elif phase == "in_down":
                if pred == 1:     # moved to UP
                    phase = "in_up"
            elif phase == "in_up":
                if pred == 0:     # came back DOWN = completed rep
                    reps += 1
                    rep_frames.append(i)
                    phase = "in_down"

        return reps, rep_frames

    def _assess_quality(self, smoothed: List[int], rep_frames: List[int]) -> float:
        """
        Quality score 0–1 based on:
        - How long each UP phase was held (good = sustained up position)
        - Consistency of rep timing
        """
        if not rep_frames or len(rep_frames) < 2:
            return 0.8

        # Measure time in UP position per rep cycle
        up_ratios = []
        prev = 0
        for end in rep_frames:
            segment = smoothed[prev:end]
            if segment:
                up_ratios.append(segment.count(1) / len(segment))
            prev = end

        if not up_ratios:
            return 0.8

        avg_up_ratio = float(np.mean(up_ratios))
        # If spending 30–60% of time in UP position = good full range of motion
        # Too low = not fully sitting up; too high = not fully lying down
        ideal_ratio = 0.45
        ratio_score = 1.0 - min(1.0, abs(avg_up_ratio - ideal_ratio) / ideal_ratio)

        # Timing consistency
        if len(rep_frames) > 2:
            intervals   = [rep_frames[i+1] - rep_frames[i] for i in range(len(rep_frames)-1)]
            consistency = 1.0 - min(1.0, np.std(intervals) / (np.mean(intervals) + 1e-8))
        else:
            consistency = 1.0

        quality = 0.6 * ratio_score + 0.4 * consistency
        return float(np.clip(quality, 0.0, 1.0))

    def _build_feedback(self, reps, score, band, icon,
                        quality, quality_mult, up_frac, down_frac) -> str:
        quality_pct = quality * 100

        quality_line = ""
        if quality_pct >= 80:
            quality_line = f"\n{G['check']} Excellent form and full range of motion!"
        elif quality_pct >= 60:
            quality_line = f"\n{G['warn']} Good effort! Focus on fully lying down between reps."
        else:
            quality_line = f"\n{G['warn']} Work on full range of motion — go all the way up and all the way down."

        advice_map = {
            "Elite":         f"{G['fire']} Elite level! You are in peak physical condition.",
            "Excellent":     f"{G['medal']} Excellent! A few more reps will get you to Elite.",
            "Very Good":     f"{G['bolt']} Very Good! Build core strength with planks to improve.",
            "Good":          f"{G['chart']} Good! Add ab-specific training to boost your count.",
            "Average":       f"{G['muscle']} Keep going! Consistency will improve your strength.",
            "Below Average": f"{G['bullet']} Start slow and build up gradually. Daily practice helps.",
        }
        advice = advice_map.get(band, "Keep pushing!")

        return (
            f"{G['situp']} Sit-Up Analysis\n\n"
            f"{icon} Performance: {band}\n"
            f"{G['bullet']} AI Score: {score:.1f}%\n\n"
            f"--- Results ---\n"
            f"{G['bullet']} Reps Completed: {reps}\n"
            f"{G['bullet']} Form Quality: {quality_pct:.0f}%\n\n"
            f"{advice}"
            f"{quality_line}"
        )

    def _error(self, msg: str) -> Dict[str, Any]:
        print(f"  [SitUp] ERROR: {msg}")
        return {
            "success":  False,
            "error":    msg,
            "ai_score": 0,
            "feedback": f"{G['warn']} {msg}",
        }
