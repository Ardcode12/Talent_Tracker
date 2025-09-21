import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import tensorflow as tf
from pathlib import Path
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SitReachAnalyzer:
    """Professional Sit & Reach Exercise Analyzer"""
    
    def __init__(self, model_path: Optional[str] = None):
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        
        # Model paths
        self.base_path = Path(__file__).parent
        self.model_path = model_path or self.base_path / "models" / "sit_reach_model.h5"
        self.scaler_path = self.base_path / "models" / "scaler.pkl"
        self.metadata_path = self.base_path / "models" / "model_metadata.json"
        
        # Initialize model and scaler
        self.model = None
        self.scaler = None
        self.feature_names = []
        self.load_model()
        
        # Key landmark indices
        self.LANDMARK_INDICES = {
            'nose': 0,
            'left_shoulder': 11,
            'right_shoulder': 12,
            'left_elbow': 13,
            'right_elbow': 14,
            'left_wrist': 15,
            'right_wrist': 16,
            'left_hip': 23,
            'right_hip': 24,
            'left_knee': 25,
            'right_knee': 26,
            'left_ankle': 27,
            'right_ankle': 28,
            'left_heel': 29,
            'right_heel': 30,
            'left_foot': 31,
            'right_foot': 32
        }
        
    def extract_features(self, image_path: str) -> Optional[np.ndarray]:
        """Extract comprehensive features from image"""
        try:
            # Read and process image
            image = cv2.imread(image_path)
            if image is None:
                logger.error(f"Could not read image: {image_path}")
                return None
                
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.pose.process(image_rgb)
            
            if not results.pose_landmarks:
                logger.warning("No pose landmarks detected")
                return None
            
            landmarks = results.pose_landmarks.landmark
            
            # Extract base features
            features = []
            
            # 1. Raw landmark positions (normalized)
            for idx in self.LANDMARK_INDICES.values():
                if idx < len(landmarks):
                    lm = landmarks[idx]
                    features.extend([lm.x, lm.y, lm.z, lm.visibility])
            
            # 2. Key angles
            angles = self._calculate_key_angles(landmarks)
            features.extend(angles)
            
            # 3. Distances and ratios
            distances = self._calculate_key_distances(landmarks)
            features.extend(distances)
            
            # 4. Body alignment features
            alignment = self._calculate_alignment_features(landmarks)
            features.extend(alignment)
            
            return np.array(features)
            
        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return None
    
    def _calculate_key_angles(self, landmarks) -> List[float]:
        """Calculate important angles for sit & reach assessment"""
        angles = []
        
        # 1. Hip flexion angle (both sides)
        for side in ['left', 'right']:
            shoulder_idx = self.LANDMARK_INDICES[f'{side}_shoulder']
            hip_idx = self.LANDMARK_INDICES[f'{side}_hip']
            knee_idx = self.LANDMARK_INDICES[f'{side}_knee']
            
            angle = self._calculate_angle(
                self._get_point(landmarks[shoulder_idx]),
                self._get_point(landmarks[hip_idx]),
                self._get_point(landmarks[knee_idx])
            )
            angles.append(angle)
        
        # 2. Knee flexion angle
        for side in ['left', 'right']:
            hip_idx = self.LANDMARK_INDICES[f'{side}_hip']
            knee_idx = self.LANDMARK_INDICES[f'{side}_knee']
            ankle_idx = self.LANDMARK_INDICES[f'{side}_ankle']
            
            angle = self._calculate_angle(
                self._get_point(landmarks[hip_idx]),
                self._get_point(landmarks[knee_idx]),
                self._get_point(landmarks[ankle_idx])
            )
            angles.append(angle)
        
        # 3. Back curvature (spine angle approximation)
        nose = self._get_point(landmarks[self.LANDMARK_INDICES['nose']])
        mid_shoulder = self._midpoint(
            landmarks[self.LANDMARK_INDICES['left_shoulder']],
            landmarks[self.LANDMARK_INDICES['right_shoulder']]
        )
        mid_hip = self._midpoint(
            landmarks[self.LANDMARK_INDICES['left_hip']],
            landmarks[self.LANDMARK_INDICES['right_hip']]
        )
        
        spine_angle = self._calculate_angle(nose, mid_shoulder, mid_hip)
        angles.append(spine_angle)
        
        # 4. Arm reach angle
        for side in ['left', 'right']:
            shoulder_idx = self.LANDMARK_INDICES[f'{side}_shoulder']
            elbow_idx = self.LANDMARK_INDICES[f'{side}_elbow']
            wrist_idx = self.LANDMARK_INDICES[f'{side}_wrist']
            
            angle = self._calculate_angle(
                self._get_point(landmarks[shoulder_idx]),
                self._get_point(landmarks[elbow_idx]),
                self._get_point(landmarks[wrist_idx])
            )
            angles.append(angle)
        
        return angles
    
    def _calculate_key_distances(self, landmarks) -> List[float]:
        """Calculate key distances and ratios"""
        distances = []
        
        # 1. Wrist to ankle distance (reach measurement)
        for side in ['left', 'right']:
            wrist = self._get_point(landmarks[self.LANDMARK_INDICES[f'{side}_wrist']])
            ankle = self._get_point(landmarks[self.LANDMARK_INDICES[f'{side}_ankle']])
            foot = self._get_point(landmarks[self.LANDMARK_INDICES[f'{side}_foot']])
            
            # Horizontal reach distance
            reach_ankle = wrist[0] - ankle[0]  # x-axis difference
            reach_foot = wrist[0] - foot[0]
            
            distances.extend([reach_ankle, reach_foot])
        
        # 2. Vertical distances
        mid_wrist = self._midpoint(
            landmarks[self.LANDMARK_INDICES['left_wrist']],
            landmarks[self.LANDMARK_INDICES['right_wrist']]
        )
        mid_hip = self._midpoint(
            landmarks[self.LANDMARK_INDICES['left_hip']],
            landmarks[self.LANDMARK_INDICES['right_hip']]
        )
        
        # Wrist height relative to hip
        wrist_hip_height = mid_hip[1] - mid_wrist[1]
        distances.append(wrist_hip_height)
        
        # 3. Body proportions
        # Torso length
        mid_shoulder = self._midpoint(
            landmarks[self.LANDMARK_INDICES['left_shoulder']],
            landmarks[self.LANDMARK_INDICES['right_shoulder']]
        )
        torso_length = self._euclidean_distance(mid_shoulder, mid_hip)
        
        # Leg length
        leg_length = self._euclidean_distance(
            self._get_point(landmarks[self.LANDMARK_INDICES['left_hip']]),
            self._get_point(landmarks[self.LANDMARK_INDICES['left_ankle']])
        )
        
        # Proportion ratio
        if leg_length > 0:
            torso_leg_ratio = torso_length / leg_length
        else:
            torso_leg_ratio = 0
            
        distances.extend([torso_length, leg_length, torso_leg_ratio])
        
        return distances
    
    def _calculate_alignment_features(self, landmarks) -> List[float]:
        """Calculate body alignment features"""
        alignment = []
        
        # 1. Shoulder alignment (should be level)
        left_shoulder = self._get_point(landmarks[self.LANDMARK_INDICES['left_shoulder']])
        right_shoulder = self._get_point(landmarks[self.LANDMARK_INDICES['right_shoulder']])
        shoulder_tilt = abs(left_shoulder[1] - right_shoulder[1])
        alignment.append(shoulder_tilt)
        
        # 2. Hip alignment
        left_hip = self._get_point(landmarks[self.LANDMARK_INDICES['left_hip']])
        right_hip = self._get_point(landmarks[self.LANDMARK_INDICES['right_hip']])
        hip_tilt = abs(left_hip[1] - right_hip[1])
        alignment.append(hip_tilt)
        
        # 3. Knee alignment (both should be at same level)
        left_knee = self._get_point(landmarks[self.LANDMARK_INDICES['left_knee']])
        right_knee = self._get_point(landmarks[self.LANDMARK_INDICES['right_knee']])
        knee_alignment = abs(left_knee[1] - right_knee[1])
        alignment.append(knee_alignment)
        
        # 4. Center of mass approximation
        com_x = np.mean([left_hip[0], right_hip[0], left_shoulder[0], right_shoulder[0]])
        com_y = np.mean([left_hip[1], right_hip[1], left_shoulder[1], right_shoulder[1]])
        
        # Distance from center line
        center_line = 0.5  # Normalized center
        com_deviation = abs(com_x - center_line)
        alignment.extend([com_deviation, com_y])
        
        return alignment
    
    def _get_point(self, landmark) -> np.ndarray:
        """Convert landmark to numpy array"""
        return np.array([landmark.x, landmark.y, landmark.z])
    
    def _midpoint(self, lm1, lm2) -> np.ndarray:
        """Calculate midpoint between two landmarks"""
        return (self._get_point(lm1) + self._get_point(lm2)) / 2
    
    def _calculate_angle(self, a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
        """Calculate angle ABC in degrees"""
        ba = a - b
        bc = c - b
        
        cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
        angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
        
        return np.degrees(angle)
    
    def _euclidean_distance(self, p1: np.ndarray, p2: np.ndarray) -> float:
        """Calculate Euclidean distance between two points"""
        return np.linalg.norm(p1 - p2)
    
    def predict(self, image_path: str) -> Dict:
        """Make prediction on image"""
        features = self.extract_features(image_path)
        
        if features is None:
            return {
                'success': False,
                'error': 'Could not extract pose features',
                'timestamp': datetime.now().isoformat()
            }
        
        if self.model is None:
            return {
                'success': False,
                'error': 'Model not loaded',
                'timestamp': datetime.now().isoformat()
            }
        
        try:
            # Preprocess features
            features_scaled = self.scaler.transform([features])
            
            # Make prediction
            prediction = self.model.predict(features_scaled, verbose=0)
            predicted_class = np.argmax(prediction[0])
            confidence = float(np.max(prediction[0]))
            
            # Get detailed scores
            form_score = self._calculate_form_score(features, predicted_class, confidence)
            flexibility_score = self._calculate_flexibility_score(features)
            
            # Generate comprehensive feedback
            feedback = self._generate_feedback(features, predicted_class, form_score, flexibility_score)
            
            # Visualize results
            visualization_path = self._visualize_analysis(image_path, features, feedback)
            
            return {
                'success': True,
                'prediction': {
                    'class': int(predicted_class),
                    'confidence': confidence,
                    'class_probabilities': prediction[0].tolist()
                },
                'scores': {
                    'overall': form_score['overall'],
                    'form': form_score['form'],
                    'flexibility': flexibility_score,
                    'reach_distance_cm': form_score['reach_distance_cm']
                },
                'feedback': feedback,
                'visualization': visualization_path,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def _calculate_form_score(self, features: np.ndarray, predicted_class: int, 
                              confidence: float) -> Dict:
        """Calculate detailed form score"""
        # Extract key measurements from features
        # Assuming feature order from extraction
        hip_angles = features[68:70]  # Left and right hip angles
        knee_angles = features[70:72]  # Left and right knee angles
        spine_angle = features[72]
        reach_distances = features[77:79]  # Reach to ankle distances
        
        # Calculate component scores
        hip_score = self._score_hip_flexion(np.mean(hip_angles))
        knee_score = self._score_knee_extension(np.mean(knee_angles))
        spine_score = self._score_spine_alignment(spine_angle)
        
        # Form score (0-100)
        form_score = (hip_score + knee_score + spine_score) / 3
        
        # Adjust based on prediction confidence
        form_score = form_score * (0.7 + 0.3 * confidence)
        
        # Reach distance in cm (approximate)
        reach_cm = np.mean(reach_distances) * 100  # Convert normalized to cm
        
        # Overall score combining form and reach
        overall_score = (form_score * 0.6) + (min(100, max(0, reach_cm + 50)) * 0.4)
        
        return {
            'overall': round(overall_score, 1),
            'form': round(form_score, 1),
            'hip_flexion': round(hip_score, 1),
            'knee_extension': round(knee_score, 1),
            'spine_alignment': round(spine_score, 1),
            'reach_distance_cm': round(reach_cm, 1)
        }
    
    def _score_hip_flexion(self, angle: float) -> float:
        """Score hip flexion angle (optimal around 90-110 degrees)"""
        if 90 <= angle <= 110:
            return 100
        elif 80 <= angle <= 120:
            return 80
        elif 70 <= angle <= 130:
            return 60
        else:
            return max(0, 40 - abs(angle - 100) * 0.5)
    
    def _score_knee_extension(self, angle: float) -> float:
        """Score knee extension (optimal close to 180 degrees)"""
        deviation = abs(180 - angle)
        if deviation <= 5:
            return 100
        elif deviation <= 15:
            return 85
        elif deviation <= 30:
            return 70
        else:
            return max(0, 50 - deviation * 0.5)
    
    def _score_spine_alignment(self, angle: float) -> float:
        """Score spine alignment (optimal around 160-180 degrees)"""
        if 160 <= angle <= 180:
            return 100
        elif 150 <= angle <= 190:
            return 80
        elif 140 <= angle <= 200:
            return 60
        else:
            return max(0, 40 - abs(angle - 170) * 0.3)
    
    def _calculate_flexibility_score(self, features: np.ndarray) -> float:
        """Calculate flexibility score based on reach distance"""
        reach_distances = features[77:79]
        avg_reach = np.mean(reach_distances)
        
        # Convert to flexibility score (0-100)
        # Positive reach (past toes) is good
        if avg_reach > 0.1:  # Well past toes
            return 95
        elif avg_reach > 0:  # Past toes
            return 85
        elif avg_reach > -0.1:  # At toes
            return 70
        elif avg_reach > -0.2:  # Near toes
            return 55
        else:  # Far from toes
            return max(20, 40 + avg_reach * 100)
    
    def _generate_feedback(self, features: np.ndarray, predicted_class: int,
                          form_score: Dict, flexibility_score: float) -> Dict:
        """Generate comprehensive feedback"""
        feedback = {
            'level': self._get_level_name(predicted_class),
            'strengths': [],
            'improvements': [],
            'tips': [],
            'warnings': []
        }
        
        # Analyze form components
        if form_score['hip_flexion'] >= 80:
            feedback['strengths'].append("Good hip flexion angle")
        else:
            feedback['improvements'].append("Work on hip flexibility for better forward bend")
            
        if form_score['knee_extension'] >= 80:
            feedback['strengths'].append("Excellent knee extension - legs are straight")
        else:
            feedback['improvements'].append("Try to keep knees straighter")
            feedback['tips'].append("Slight knee bend is okay if you have tight hamstrings")
        
        if form_score['spine_alignment'] >= 80:
            feedback['strengths'].append("Good spinal alignment maintained")
        else:
            feedback['improvements'].append("Avoid excessive rounding of the back")
            feedback['warnings'].append("Excessive spine flexion can lead to injury")
        
        # Flexibility feedback
        reach_cm = form_score['reach_distance_cm']
        if reach_cm > 5:
            feedback['strengths'].append(f"Excellent flexibility - reaching {reach_cm:.1f}cm past toes")
        elif reach_cm > 0:
            feedback['strengths'].append(f"Good flexibility - reaching {reach_cm:.1f}cm past toes")
        elif reach_cm > -10:
            feedback['tips'].append("Regular stretching will improve your reach distance")
        else:
            feedback['improvements'].append("Focus on gradual hamstring stretching exercises")
        
        # General tips based on level
        if predicted_class == 0:  # Good form
            feedback['tips'].extend([
                "Hold the stretch for 15-30 seconds",
                "Breathe deeply and relax into the stretch",
                "Try to improve reach distance gradually"
            ])
        elif predicted_class == 1:  # Needs improvement
            feedback['tips'].extend([
                "Warm up thoroughly before stretching",
                "Don't bounce - use smooth, controlled movements",
                "Practice daily for best results"
            ])
        else:  # Poor form
            feedback['tips'].extend([
                "Start with easier flexibility exercises",
                "Consider using a strap or towel around feet",
                "Focus on form over reach distance initially"
            ])
            feedback['warnings'].append("Poor form increases injury risk - prioritize technique")
        
        return feedback
    
    def _get_level_name(self, class_idx: int) -> str:
        """Get readable name for prediction class"""
        levels = {
            0: "Excellent Form",
            1: "Good Form - Minor Improvements Needed",
            2: "Needs Significant Improvement"
        }
        return levels.get(class_idx, "Unknown")
    
    def _visualize_analysis(self, image_path: str, features: np.ndarray, 
                           feedback: Dict) -> str:
        """Create visualization of analysis results"""
        try:
            image = cv2.imread(image_path)
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Process for drawing
            results = self.pose.process(image_rgb)
            
            if results.pose_landmarks:
                # Draw pose landmarks
                self.mp_drawing.draw_landmarks(
                    image, results.pose_landmarks, self.mp_pose.POSE_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2),
                    self.mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
                )
                
                # Add text overlay
                self._add_text_overlay(image, feedback)
            
            # Save visualization
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.base_path / "results" / f"analysis_{timestamp}.jpg"
            output_path.parent.mkdir(exist_ok=True)
            cv2.imwrite(str(output_path), image)
            
            return str(output_path)
            
        except Exception as e:
            logger.error(f"Visualization error: {e}")
            return ""
    
    def _add_text_overlay(self, image: np.ndarray, feedback: Dict):
        """Add feedback text to image"""
        h, w = image.shape[:2]
        font = cv2.FONT_HERSHEY_SIMPLEX
        
        # Add level at top
        cv2.putText(image, feedback['level'], (10, 30), font, 1, (0, 255, 0), 2)
        
        # Add key strengths
        y_pos = 60
        for strength in feedback['strengths'][:2]:
            cv2.putText(image, f"+ {strength}", (10, y_pos), font, 0.6, (0, 255, 0), 1)
            y_pos += 25
            
        # Add key improvements
        for improvement in feedback['improvements'][:2]:
            cv2.putText(image, f"- {improvement}", (10, y_pos), font, 0.6, (0, 0, 255), 1)
            y_pos += 25
    
    def load_model(self):
        """Load trained model and scaler"""
        try:
            if self.model_path.exists():
                self.model = tf.keras.models.load_model(str(self.model_path))
                logger.info(f"Model loaded from {self.model_path}")
            else:
                logger.warning(f"Model not found at {self.model_path}")
                
            if self.scaler_path.exists():
                import joblib
                self.scaler = joblib.load(str(self.scaler_path))
                logger.info("Scaler loaded successfully")
            else:
                logger.warning("Scaler not found")
                
            if self.metadata_path.exists():
                with open(self.metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.feature_names = metadata.get('feature_names', [])
                    logger.info("Model metadata loaded")
                    
        except Exception as e:
            logger.error(f"Error loading model: {e}")
