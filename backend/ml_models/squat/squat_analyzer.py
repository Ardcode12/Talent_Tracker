# backend/ml_models/squat/squat_analyzer.py
"""
Squat Form Analyzer using trained Keras model.
Extracts 12 biomechanical features per frame via MediaPipe,
runs them through the trained classifier to detect form errors,
counts reps, and generates scores + feedback.
"""

import cv2
import json
import numpy as np
import traceback
from pathlib import Path
from typing import Dict, Any, List, Optional

import mediapipe as mp
import hashlib

# Load model lazily to avoid import-time errors
_model = None
_scaler = None
_config = None

MODEL_DIR = Path(__file__).parent

LABEL_MAP = {
    0: "Correct",
    1: "Shallow Squat",
    2: "Forward Lean",
    3: "Knees Caving In",
    4: "Heels Off Ground",
    5: "Asymmetric Squat"
}

# Scoring table: (min_reps, score)
# Based on standard physical fitness test norms for squats
_SCORE_TABLE = [
    (50, 100),
    (45, 90),
    (40, 80),
    (35, 70),
    (30, 60),
    (25, 50),
    (20, 40),
    (15, 30),
    (10, 20),
    (5,  15),
    (1,  10),  # minimum score for any genuine attempt
    (0,   0),  # 0 only if zero valid reps detected
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


def _load_model():
    """Lazy-load the trained model, scaler, and config."""
    global _model, _scaler, _config

    if _model is not None:
        return

    import tensorflow as tf
    import joblib

    keras_path = MODEL_DIR / "squat_classifier.keras"
    scaler_path = MODEL_DIR / "squat_scaler.pkl"
    config_path = MODEL_DIR / "squat_model_config.json"

    if not keras_path.exists():
        raise FileNotFoundError(f"Squat model not found at {keras_path}")

    print(f"INFO: Loading squat classifier from {keras_path}")
    _model = tf.keras.models.load_model(str(keras_path))

    if scaler_path.exists():
        _scaler = joblib.load(str(scaler_path))
        print(f"INFO: Loaded squat scaler from {scaler_path}")
    else:
        print("WARNING: Squat scaler not found, using raw features")
        _scaler = None

    if config_path.exists():
        with open(config_path, 'r') as f:
            _config = json.load(f)
        print(f"INFO: Loaded squat config: {_config.get('input_features')} features")
    else:
        _config = {"input_features": 12}


def _calc_angle(a, b, c):
    """Calculate angle at point b between points a-b-c. Each is [x, y]."""
    ba = np.array(a) - np.array(b)
    bc = np.array(c) - np.array(b)
    cos_val = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    return float(np.degrees(np.arccos(np.clip(cos_val, -1.0, 1.0))))


def _extract_frame_features(landmarks) -> Optional[List[float]]:
    """
    Extract the 12 features matching the trained model from MediaPipe landmarks.
    
    Features (from squat_model_config.json):
      0: left_knee_angle
      1: right_knee_angle
      2: left_hip_angle
      3: right_hip_angle
      4: left_ankle_angle
      5: right_ankle_angle
      6: spine_angle
      7: torso_lean
      8: left_knee_lateral
      9: right_knee_lateral
      10: symmetry_score
      11: hip_depth
    """
    try:
        lm = landmarks

        # Joint positions as [x, y]
        l_shoulder = [lm[11].x, lm[11].y]
        r_shoulder = [lm[12].x, lm[12].y]
        l_hip = [lm[23].x, lm[23].y]
        r_hip = [lm[24].x, lm[24].y]
        l_knee = [lm[25].x, lm[25].y]
        r_knee = [lm[26].x, lm[26].y]
        l_ankle = [lm[27].x, lm[27].y]
        r_ankle = [lm[28].x, lm[28].y]
        l_foot = [lm[31].x, lm[31].y]
        r_foot = [lm[32].x, lm[32].y]
        nose = [lm[0].x, lm[0].y]

        # Mid points
        mid_shoulder = [(l_shoulder[0] + r_shoulder[0]) / 2,
                        (l_shoulder[1] + r_shoulder[1]) / 2]
        mid_hip = [(l_hip[0] + r_hip[0]) / 2,
                   (l_hip[1] + r_hip[1]) / 2]
        mid_knee = [(l_knee[0] + r_knee[0]) / 2,
                    (l_knee[1] + r_knee[1]) / 2]

        # 0-1: Knee angles (hip-knee-ankle)
        left_knee_angle = _calc_angle(l_hip, l_knee, l_ankle)
        right_knee_angle = _calc_angle(r_hip, r_knee, r_ankle)

        # 2-3: Hip angles (shoulder-hip-knee)
        left_hip_angle = _calc_angle(l_shoulder, l_hip, l_knee)
        right_hip_angle = _calc_angle(r_shoulder, r_hip, r_knee)

        # 4-5: Ankle angles (knee-ankle-foot)
        left_ankle_angle = _calc_angle(l_knee, l_ankle, l_foot)
        right_ankle_angle = _calc_angle(r_knee, r_ankle, r_foot)

        # 6: Spine angle (nose-mid_shoulder-mid_hip)
        spine_angle = _calc_angle(nose, mid_shoulder, mid_hip)

        # 7: Torso lean (angle of torso from vertical)
        # Vertical reference: point directly above mid_hip
        vertical_ref = [mid_hip[0], mid_hip[1] - 0.5]
        torso_lean = _calc_angle(mid_shoulder, mid_hip, vertical_ref)

        # 8-9: Knee lateral deviation (how far knees go inward/outward vs ankles)
        left_knee_lateral = l_knee[0] - l_ankle[0]
        right_knee_lateral = r_knee[0] - r_ankle[0]

        # 10: Symmetry score (1.0 = perfect symmetry)
        knee_diff = abs(left_knee_angle - right_knee_angle)
        hip_diff = abs(left_hip_angle - right_hip_angle)
        symmetry_score = max(0.0, 1.0 - (knee_diff + hip_diff) / 180.0)

        # 11: Hip depth (relative to knee height, higher = deeper squat)
        # Positive means hips are below knees (deep squat)
        hip_depth = mid_knee[1] - mid_hip[1]

        return [
            left_knee_angle, right_knee_angle,
            left_hip_angle, right_hip_angle,
            left_ankle_angle, right_ankle_angle,
            spine_angle, torso_lean,
            left_knee_lateral, right_knee_lateral,
            symmetry_score, hip_depth
        ]
    except Exception as e:
        print(f"Feature extraction error: {e}")
        return None


# ============================================================================
# ANTI-CHEAT CONSTANTS
# ============================================================================

# A single squat (down + up) physically takes at least this many seconds
MIN_SECONDS_PER_REP = 0.8
# A human cannot do more than this many reps per second even at max speed
MAX_REPS_PER_SECOND = 1.2
# How many sample frames to compare for loop detection (per third of video)
LOOP_DETECTION_SAMPLES = 10


def _frame_signature(frame) -> np.ndarray:
    """
    Return a 16x16 grayscale thumbnail as float32.
    Larger than 8x8 so we can distinguish different exercise positions.
    """
    small = cv2.resize(frame, (16, 16), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)


def _perceptual_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    Normalised similarity in [0, 1].
    1.0 = identical frames, 0.0 = completely different.
    Uses normalised cross-correlation — robust to slight brightness/contrast shifts.
    """
    a_f = a.flatten() - a.mean()
    b_f = b.flatten() - b.mean()
    denom = (np.linalg.norm(a_f) * np.linalg.norm(b_f))
    if denom < 1e-6:
        return 1.0  # both blank frames → treat as same
    return float(np.dot(a_f, b_f) / denom)


def _detect_video_loop(video_path: str) -> bool:
    """
    Layer 1 — Video Loop Detection.

    Splits the video into thirds and samples LOOP_DETECTION_SAMPLES frames
    from each third. Uses perceptual similarity (normalised cross-correlation)
    so the check survives video re-encoding/compression from editing apps.

    If segment-1 frames are >= 65% similar to segment-2 OR segment-3,
    the video is flagged as a loop/edited duplicate.

    Returns True if a loop is detected (fraud), False if genuine.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return False

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total < 600:   # skip for videos under ~20s — too short for reliable loop detection
        cap.release()
        return False

    third = total // 3
    n = LOOP_DETECTION_SAMPLES

    def sample_signatures(start: int, end: int) -> List[np.ndarray]:
        sigs = []
        indices = [start + (end - start) * i // n for i in range(n)]
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                sigs.append(_frame_signature(frame))
        return sigs

    s1 = sample_signatures(0, third)
    s2 = sample_signatures(third, 2 * third)
    s3 = sample_signatures(2 * third, total)
    cap.release()

    def avg_similarity(a: List[np.ndarray], b: List[np.ndarray]) -> float:
        if not a or not b:
            return 0.0
        scores = [_perceptual_similarity(x, y) for x, y in zip(a, b)]
        return float(np.mean(scores))

    sim_12 = avg_similarity(s1, s2)
    sim_13 = avg_similarity(s1, s3)
    print(f"[AntiCheat-Squat] Perceptual similarity — seg1↔seg2: {sim_12:.3f}, seg1↔seg3: {sim_13:.3f}")

    # >= 0.92: frames are near-identical = looped/repeated video
    # Genuine exercise videos score 0.75-0.89 (same room/person but different poses)
    return sim_12 >= 0.92 or sim_13 >= 0.92


def _count_reps(knee_angles: List[float], fps: float = 30.0) -> Dict[str, Any]:
    """
    Count squat reps from knee angle time-series.

    Layer 2 — Per-Rep Minimum Time:
      Each rep must take at least MIN_SECONDS_PER_REP seconds.
      Impossibly fast reps (from looped/sped-up video) are discarded
      and recorded in fraud_flags.
    """
    if len(knee_angles) < 10:
        return {"count": 0, "partial": 0, "rep_times": [], "fraud_flags": []}

    valid_reps = 0
    partial_reps = 0
    skipped_fast_reps = 0
    fraud_flags: List[str] = []

    DEEP_THRESHOLD    = 115   # below this = good deep squat
    PARTIAL_THRESHOLD = 140   # below this but above 115 = shallow/partial
    STAND_THRESHOLD   = 160   # above this = standing straight

    # Layer 2: minimum frames that one rep must span
    min_frames_per_rep = int(MIN_SECONDS_PER_REP * fps)

    # States: 0=standing, 1=partial squat, 2=deep squat
    state     = 0
    rep_start = None
    rep_times = []

    for i, angle in enumerate(knee_angles):
        if state == 0:
            if angle < DEEP_THRESHOLD:
                state = 2
                rep_start = i
            elif angle < PARTIAL_THRESHOLD:
                state = 1
                rep_start = i

        elif state == 1:
            if angle < DEEP_THRESHOLD:
                state = 2  # upgraded to deep squat
            elif angle > STAND_THRESHOLD:
                partial_reps += 1
                state = 0
                rep_start = None

        elif state == 2:
            if angle > STAND_THRESHOLD:
                rep_duration = (i - rep_start) if rep_start is not None else min_frames_per_rep
                if rep_duration >= min_frames_per_rep:
                    # Rep took a physically plausible amount of time — count it
                    valid_reps += 1
                    rep_times.append(rep_duration)
                else:
                    # Rep was impossibly fast — discard it
                    skipped_fast_reps += 1
                state = 0
                rep_start = None

    if skipped_fast_reps > 0:
        fraud_flags.append(
            f"{skipped_fast_reps} rep(s) completed in under {MIN_SECONDS_PER_REP}s "
            f"— physically impossible, possible video editing detected."
        )

    return {
        "count": valid_reps,
        "partial": partial_reps,
        "rep_times": rep_times,
        "fraud_flags": fraud_flags,
    }


def _generate_feedback(
    pred_class: int,
    score: float,
    confidence: float,
    rep_info: Dict,
    frame_features: List[List[float]],
    band: str = "Average",
    band_icon: str = "\U0001F4CA"
) -> str:
    """Generate human-readable feedback string with emojis."""

    E = {
        'check': '\u2705', 'medal': '\U0001F3C5', 'bullet': '\u2022',
        'muscle': '\U0001F4AA', 'target': '\U0001F3AF', 'fire': '\U0001F525',
        'warning': '\u26A0\uFE0F', 'star': '\u2B50', 'brain': '\U0001F9E0',
    }

    form_label = LABEL_MAP.get(pred_class, "Unknown")
    reps = rep_info.get("count", 0)
    partial = rep_info.get("partial", 0)

    lines = [f"{E['muscle']} Squat Analysis\n"]
    lines.append(f"{band_icon} Performance: {band}")
    lines.append(f"{E['bullet']} AI Score: {score:.1f}%")
    lines.append(f"\n--- Results ---")
    lines.append(f"{E['bullet']} Valid Reps: {reps}")
    if partial > 0:
        lines.append(f"{E['bullet']} Partial Reps (too shallow): {partial}")
    lines.append(f"{E['target']} Form: {form_label} ({confidence:.0f}% confidence)")

    # Band-based performance advice
    advice_map = {
        "Elite":         f"{E['fire']} Elite level! You are in peak physical condition.",
        "Excellent":     f"{E['star']} Excellent! Push for 50+ reps to reach Elite.",
        "Very Good":     f"{E['medal']} Very Good! Build leg strength with weighted squats.",
        "Good":          f"{E['target']} Good! Add squat-specific training to boost your count.",
        "Average":       f"{E['muscle']} Keep going! Consistency will improve your strength.",
        "Below Average": f"{E['bullet']} Start slow and build up gradually. Daily practice helps.",
    }
    lines.append(f"\n{advice_map.get(band, 'Keep pushing!')}")

    # Form-specific correction tips
    if pred_class != 0:
        lines.append(f"\n{E['brain']} Form Tips:")
    if pred_class == 1:
        lines.append(f"{E['warning']} Squat depth insufficient — aim for thighs parallel to ground")
        lines.append(f"{E['bullet']} Practice box squats for depth awareness")
    elif pred_class == 2:
        lines.append(f"{E['warning']} Excessive forward lean — keep chest up, eyes forward")
        lines.append(f"{E['bullet']} Strengthen upper back with rows")
    elif pred_class == 3:
        lines.append(f"{E['warning']} Knees caving inward — push knees out over toes")
        lines.append(f"{E['bullet']} Add hip abduction exercises")
    elif pred_class == 4:
        lines.append(f"{E['warning']} Heels lifting — work on ankle mobility")
        lines.append(f"{E['bullet']} Try elevating heels slightly with plates")
    elif pred_class == 5:
        lines.append(f"{E['warning']} Asymmetric movement — add single-leg exercises")
        lines.append(f"{E['bullet']} Check for muscle imbalances")



    return "\n".join(lines)


class SquatAnalyzer:
    """
    Analyzes squat videos using the trained Keras classifier.
    Extracts 12 biomechanical features per frame,
    classifies form, counts reps, and generates score + feedback.
    """

    def __init__(self):
        _load_model()
        
        # Use new Tasks API which is compatible with Python 3.13
        self.BaseOptions = mp.tasks.BaseOptions
        self.PoseLandmarker = mp.tasks.vision.PoseLandmarker
        self.PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
        self.VisionRunningMode = mp.tasks.vision.RunningMode
        
        model_path = Path(__file__).parent.parent / "pose_landmarker_lite.task"
        if not model_path.exists():
            print(f"WARNING: Pose landmarker model not found at {model_path}")
            
        self.model_path = str(model_path)

    def analyze_video(self, video_path: str) -> Dict[str, Any]:
        """Main entry point: analyze a squat video and return results."""
        try:
            print(f"\n=== Squat Analysis (Trained Model): {video_path} ===")

            # ── Layer 1: Video Loop Detection ─────────────────────────────────
            print("[AntiCheat-Squat] Checking for looped/edited video...")
            if _detect_video_loop(video_path):
                return self._error(
                    "Video manipulation detected: this video appears to be a looped "
                    "or edited duplicate. Please upload an original, unedited recording."
                )

            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return self._error("Could not open video file")

            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            video_duration_sec = total_frames / fps
            print(f"Video: {total_frames} frames @ {fps:.0f} FPS ({video_duration_sec:.1f}s)")

            if total_frames < 15:
                cap.release()
                return self._error("Video too short for analysis")

            # ---- Extract features from every frame ----
            all_features = []
            frames_processed = 0
            poses_detected = 0

            options = self.PoseLandmarkerOptions(
                base_options=self.BaseOptions(model_asset_path=self.model_path),
                running_mode=self.VisionRunningMode.VIDEO,
                min_pose_detection_confidence=0.5,
                min_pose_presence_confidence=0.5,
                min_tracking_confidence=0.5
            )

            with self.PoseLandmarker.create_from_options(options) as landmarker:
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break

                    # Calculate timestamp for VIDEO mode
                    timestamp_ms = int((frames_processed * 1000) / fps)
                    frames_processed += 1
                    
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                    
                    try:
                        results = landmarker.detect_for_video(mp_image, timestamp_ms)
                    except Exception as e:
                        print(f"Landmarker error at frame {frames_processed}: {e}")
                        continue

                    if results and results.pose_landmarks and len(results.pose_landmarks) > 0:
                        poses_detected += 1
                        feats = _extract_frame_features(results.pose_landmarks[0])
                        if feats is not None:
                            all_features.append(feats)

            cap.release()

            print(f"Frames: {frames_processed}, Poses: {poses_detected}, "
                  f"Features: {len(all_features)}")

            if len(all_features) < 10:
                return self._error(
                    "Not enough poses detected. Ensure full body is visible "
                    "with good lighting."
                )

            detection_rate = poses_detected / frames_processed * 100
            features_array = np.array(all_features, dtype=np.float32)

            # Compute avg knee angles early — used by both validation and rep counting
            avg_knee_angles = (features_array[:, 0] + features_array[:, 1]) / 2

            # ---- Validate: is this actually a squat video? ----
            # Feature col 11 = hip_depth (positive = hip below knee level)
            # Feature col 7  = torso_lean
            # For a valid squat:
            #   1. The knee angle range must show significant bending
            #   2. Body should not be moving significantly across the frame (not running/walking)
            hip_depth_series = features_array[:, 11]   # vertical hip oscillation
            torso_lean_series = features_array[:, 7]    # body lean angle
            
            knee_angle_range = float(np.max(avg_knee_angles) - np.min(avg_knee_angles))
            hip_depth_range = float(np.max(hip_depth_series) - np.min(hip_depth_series))
            torso_lean_std = float(np.std(torso_lean_series))

            print(f"Validation — knee_angle_range: {knee_angle_range:.1f}°, "
                  f"hip_depth_range: {hip_depth_range:.4f}, torso_lean_std: {torso_lean_std:.4f}")

            # Reject: body barely moved — likely a stationary video or wrong exercise
            if knee_angle_range < 20:
                return self._error(
                    "This is not a squat video. Please upload a valid squat video."
                )

            # Reject: body lean varies wildly — likely running/lateral movement, not squatting
            if torso_lean_std > 25:
                return self._error(
                    "This is not a squat video. Please upload a valid squat video."
                )

            # ---- Count reps from knee angles (with Layer 2 per-rep time check) ----
            rep_info = _count_reps(avg_knee_angles.tolist(), fps=fps)

            # ---- Classify each frame ----
            if _scaler is not None:
                features_scaled = _scaler.transform(features_array)
            else:
                features_scaled = features_array

            cls_preds, score_preds = _model.predict(features_scaled, verbose=0)

            # ---- Aggregate per-frame predictions ----
            frame_classes = np.argmax(cls_preds, axis=1)

            # Overall class = most frequent prediction (mode)
            unique, counts = np.unique(frame_classes, return_counts=True)
            overall_class = int(unique[np.argmax(counts)])
            class_confidence = float(counts[np.argmax(counts)] / len(frame_classes) * 100)

            # ── Layer 3 & 4: Rep Rate Limiter + Hard Cap ─────────────────────
            raw_reps    = rep_info["count"]
            fraud_flags = rep_info.get("fraud_flags", [])

            # Layer 4: Hard cap — max physically possible reps for this video length
            max_possible_reps = int(video_duration_sec * MAX_REPS_PER_SECOND)

            # Layer 3: Rate limiter — also triggers the fraud flag
            if raw_reps > max_possible_reps:
                fraud_flags.append(
                    f"Rep count ({raw_reps}) exceeds the physical maximum "
                    f"({max_possible_reps}) possible in {video_duration_sec:.0f}s. "
                    f"Possible video editing detected."
                )

            if fraud_flags:
                print(f"[AntiCheat-Squat] \u26a0\ufe0f Fraud flags detected: {fraud_flags}")
                return self._error(
                    "Anti-cheat check failed: " + " | ".join(fraud_flags)
                )

            # ---- Rep-count based scoring ----
            reps    = raw_reps
            partial = rep_info["partial"]

            base_score = _score_from_reps(reps)
            band, band_icon = _band_from_reps(reps)

            # Form quality multiplier 0.7x–1.0x based on per-frame classification
            CLASS_QUALITY = {
                0: 1.0,   # Correct = full marks
                1: 0.75,  # Shallow
                2: 0.70,  # Forward Lean
                3: 0.65,  # Knees Caving
                4: 0.65,  # Heels Off
                5: 0.75,  # Asymmetric
            }
            frame_quality = [CLASS_QUALITY.get(int(c), 0.7) for c in frame_classes]
            quality = float(np.mean(frame_quality))   # 0.65 – 1.0

            ai_score = float(min(100.0, base_score * quality))

            print(f"Score: {reps} reps → base={base_score:.0f} × quality={quality:.2f} = {ai_score:.1f}")

            # ---- Form breakdown ----
            form_breakdown = {}
            for cls_id in range(6):
                count = int(np.sum(frame_classes == cls_id))
                if count > 0:
                    form_breakdown[LABEL_MAP[cls_id]] = {
                        "frames": count,
                        "percentage": round(count / len(frame_classes) * 100, 1)
                    }

            # ---- Generate feedback ----
            feedback = _generate_feedback(
                overall_class, ai_score, class_confidence,
                rep_info, all_features, band, band_icon
            )

            # ---- Consistency score ----
            consistency = 0.0
            if len(rep_info["rep_times"]) > 1:
                rt = rep_info["rep_times"]
                consistency = (1 - np.std(rt) / (np.mean(rt) + 1e-8)) * 100
                consistency = max(0, min(100, consistency))

            print(f"Result: {reps} reps, score={ai_score:.1f}, "
                  f"form={LABEL_MAP[overall_class]}")

            return {
                "success": True,
                "count": reps,
                "partial_squats": rep_info["partial"],
                "ai_score": ai_score,
                "form_class": overall_class,
                "form_label": LABEL_MAP[overall_class],
                "form_confidence": round(class_confidence, 1),
                "form_breakdown": form_breakdown,
                "consistency_score": round(consistency, 1),
                "average_rep_time": (
                    round(float(np.mean(rep_info["rep_times"])), 2)
                    if rep_info["rep_times"] else 0.0
                ),
                "feedback": feedback,
                "debug_info": {
                    "frames_processed": frames_processed,
                    "poses_detected": poses_detected,
                    "detection_rate": f"{detection_rate:.1f}%",
                    "features_extracted": len(all_features),
                    "base_score": round(base_score, 1),
                    "quality_multiplier": round(quality, 2),
                }
            }

        except Exception as e:
            traceback.print_exc()
            return self._error(str(e))

    def _error(self, msg: str) -> Dict[str, Any]:
        """Return standardized error result."""
        print(f"ERROR: Squat analysis - {msg}")
        return {
            "success": False,
            "count": 0,
            "partial_squats": 0,
            "ai_score": 0,
            "form_class": -1,
            "form_label": "Error",
            "form_confidence": 0,
            "form_breakdown": {},
            "consistency_score": 0,
            "average_rep_time": 0,
            "feedback": f"\U0001F6AB Analysis failed: {msg}",
            "error": msg
        }
