import os
import cv2
import numpy as np
from deepface import DeepFace

def verify_face_in_video(video_path: str, profile_photo_path: str, seconds: int = 3) -> dict:
    """
    Extracts evenly spaced frames from the entire video, detects the clearest face,
    and verifies it against the provided profile photo.
    
    Returns:
        dict: {
            "verified": bool,           # True if match, False if mismatch, None if skipped
            "confidence": float,        # 1.0 - distance (higher is better)
            "face_found_in_video": bool,
            "reason": str               # Explanation of result
        }
    """
    if not profile_photo_path or not os.path.exists(profile_photo_path):
        return {
            "verified": None,
            "confidence": 0.0,
            "face_found_in_video": False,
            "reason": "No profile photo available for verification. Skipping."
        }

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {
            "verified": False,
            "confidence": 0.0,
            "face_found_in_video": False,
            "reason": "Could not open video file."
        }

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Sample up to 20 frames spread evenly across the ENTIRE video
    num_samples = 20
    step = max(1, total_frames // num_samples)
    
    frames = []
    for count in range(0, total_frames, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, count)
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
        if len(frames) >= num_samples:
            break
    cap.release()

    if not frames:
        return {
            "verified": False,
            "confidence": 0.0,
            "face_found_in_video": False,
            "reason": "Video is too short or empty."
        }

    # Find the best face across the sampled frames
    best_face_img = None
    best_face_confidence = 0.0

    print(f"[FaceVerify] Scanning {len(frames)} frames for a face...")
    for frame in frames:
        try:
            # Enforce face detection to ensure we actually crop a face
            faces = DeepFace.extract_faces(
                img_path=frame, 
                detector_backend="opencv", # Fast and lightweight
                enforce_detection=True
            )
            if faces:
                # We take the first detected face in the frame
                face_obj = faces[0]
                conf = face_obj.get("confidence", 0.0)
                if conf > best_face_confidence:
                    best_face_confidence = conf
                    # DeepFace returns face in RGB, normalized. 
                    # We can use the raw frame for verification later to be safe.
                    best_face_img = frame
        except ValueError:
            # DeepFace raises ValueError if no face is found when enforce_detection=True
            continue
        except Exception as e:
            print(f"[FaceVerify] Error extracting face: {e}")
            continue

    if best_face_img is None:
        return {
            "verified": False, # Treat as failed if we required them to show their face
            "confidence": 0.0,
            "face_found_in_video": False,
            "reason": "No face detected in the video. Please ensure your face is clearly visible during the recording."
        }

    # Now verify the best found face against the profile photo
    try:
        print("[FaceVerify] Face found in video. Verifying against profile photo...")
        # DeepFace.verify takes BGR numpy arrays or paths
        result = DeepFace.verify(
            img1_path=best_face_img,
            img2_path=profile_photo_path,
            model_name="Facenet512",  # Stricter & more accurate than VGG-Face
            detector_backend="opencv",
            enforce_detection=True
        )
        
        is_verified = result.get("verified", False)
        # Convert distance to a pseudo-confidence score (lower distance = higher confidence)
        distance = result.get("distance", 1.0)
        threshold = result.get("threshold", 0.4)
        
        # Simple confidence metric: 1.0 means identical, 0.0 means completely different
        confidence = max(0.0, 1.0 - (distance / (threshold * 2)))

        if is_verified:
            return {
                "verified": True,
                "confidence": confidence,
                "face_found_in_video": True,
                "reason": "Face matches profile photo."
            }
        else:
            return {
                "verified": False,
                "confidence": confidence,
                "face_found_in_video": True,
                "reason": "Face does not match the profile photo."
            }

    except Exception as e:
        print(f"[FaceVerify] Verification error: {e}")
        return {
            "verified": False,
            "confidence": 0.0,
            "face_found_in_video": True,
            "reason": "Error during face verification comparison."
        }

