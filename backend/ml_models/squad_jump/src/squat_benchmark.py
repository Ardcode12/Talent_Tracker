import cv2
import mediapipe as mp
import numpy as np
import json
import os

# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(static_image_mode=False, model_complexity=1, enable_segmentation=False)

def calculate_angle(a, b, c):
    """Calculate angle between three points (e.g., hip-knee-ankle)."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    return 360 - angle if angle > 180.0 else angle

def extract_benchmark_video(video_path, benchmark_file='data/benchmark.json'):
    """Analyze squat video to set benchmark metrics."""
    if not os.path.exists(video_path):
        print(f"❌ File not found: {video_path}")
        return None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Could not open: {video_path}")
        return None

    fps = cap.get(cv2.CAP_PROP_FPS) or 1
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frames / fps

    knee_angles, hip_heights, squat_count = [], [], 0
    prev_hip_y, in_squat = 0, False

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if results.pose_landmarks:
            lm, h, w = results.pose_landmarks.landmark, *frame.shape[:2]
            hip   = [int(lm[mp_pose.PoseLandmark.LEFT_HIP].x*w),   int(lm[mp_pose.PoseLandmark.LEFT_HIP].y*h)]
            knee  = [int(lm[mp_pose.PoseLandmark.LEFT_KNEE].x*w),  int(lm[mp_pose.PoseLandmark.LEFT_KNEE].y*h)]
            ankle = [int(lm[mp_pose.PoseLandmark.LEFT_ANKLE].x*w), int(lm[mp_pose.PoseLandmark.LEFT_ANKLE].y*h)]
            angle = calculate_angle(hip, knee, ankle)
            hip_y = lm[mp_pose.PoseLandmark.LEFT_HIP].y

            if prev_hip_y > 0:
                if hip_y > prev_hip_y + 0.05 and not in_squat:
                    in_squat = True
                    knee_angles.append(angle)
                    hip_heights.append(hip_y * h)   # removed *0.026
                elif hip_y < prev_hip_y - 0.05 and in_squat:
                    squat_count += 1
                    in_squat = False
            prev_hip_y = hip_y

    cap.release(); cv2.destroyAllWindows()

    # 🚨 Reject invalid benchmark video
    if not knee_angles or not hip_heights:
        print("❌ No squats detected in video - please provide a clearer video.")
        return None

    ideal_knee   = np.mean(knee_angles)
    ideal_depth  = np.mean(hip_heights)
    ideal_speed  = squat_count/duration if duration > 0 else 0.0

    tolerance = 0.1  # ±10%
    benchmark = {
        'ideal_knee_angle': ideal_knee,
        'knee_tolerance': tolerance * ideal_knee,
        'ideal_hip_depth': ideal_depth,
        'hip_tolerance': tolerance * ideal_depth,
        'ideal_squats_per_sec': ideal_speed,
        'squats_tolerance': tolerance * ideal_speed
    }

    os.makedirs(os.path.dirname(benchmark_file), exist_ok=True)
    with open(benchmark_file, 'w') as f:
        json.dump(benchmark, f, indent=4)
    print(f"✅ Benchmark saved to {benchmark_file}")
    return benchmark


def compare_squat(video_path, benchmark_file='data/benchmark.json'):
    """Analyze new video, compare against benchmark, and return dict with scores + tips."""
    if not os.path.exists(video_path) or not os.path.exists(benchmark_file):
        return None
    
    with open(benchmark_file) as f:
        benchmark = json.load(f)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Cannot open {video_path}")
        return None
    
    fps = cap.get(cv2.CAP_PROP_FPS) or 1
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frames / fps

    knee_angles, hip_heights, squat_count = [], [], 0
    prev_hip_y, in_squat = 0, False

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if results.pose_landmarks:
            lm, h, w = results.pose_landmarks.landmark, *frame.shape[:2]
            hip   = [int(lm[mp_pose.PoseLandmark.LEFT_HIP].x*w), int(lm[mp_pose.PoseLandmark.LEFT_HIP].y*h)]
            knee  = [int(lm[mp_pose.PoseLandmark.LEFT_KNEE].x*w), int(lm[mp_pose.PoseLandmark.LEFT_KNEE].y*h)]
            ankle = [int(lm[mp_pose.PoseLandmark.LEFT_ANKLE].x*w), int(lm[mp_pose.PoseLandmark.LEFT_ANKLE].y*h)]
            angle = calculate_angle(hip, knee, ankle)
            hip_y = lm[mp_pose.PoseLandmark.LEFT_HIP].y

            if prev_hip_y > 0:
                if hip_y > prev_hip_y + 0.05 and not in_squat:
                    in_squat = True
                    knee_angles.append(angle)
                    hip_heights.append(hip_y * h)
                elif hip_y < prev_hip_y - 0.05 and in_squat:
                    squat_count += 1
                    in_squat = False
            prev_hip_y = hip_y

    cap.release()
    cv2.destroyAllWindows()

    if not knee_angles or not hip_heights:
        print("❌ No squat detected: invalid video")
        return None

    actual_knee = np.mean(knee_angles)
    actual_depth = np.mean(hip_heights)
    actual_speed = squat_count / duration if duration > 0 else 0.0

    results = {}

    # Knee
    if abs(actual_knee - benchmark['ideal_knee_angle']) <= benchmark['knee_tolerance']:
        results['knee'] = {"actual": actual_knee, "status": "Good"}
    elif actual_knee < benchmark['ideal_knee_angle']:
        results['knee'] = {"actual": actual_knee, "status": "Too low"}
    else:
        results['knee'] = {"actual": actual_knee, "status": "Too high"}

    # Hip
    if abs(actual_depth - benchmark['ideal_hip_depth']) <= benchmark['hip_tolerance']:
        results['hip'] = {"actual": actual_depth, "status": "Good"}
    elif actual_depth < benchmark['ideal_hip_depth']:
        results['hip'] = {"actual": actual_depth, "status": "Too shallow"}
    else:
        results['hip'] = {"actual": actual_depth, "status": "Too deep"}

    # Speed
    if abs(actual_speed - benchmark['ideal_squats_per_sec']) <= benchmark['squats_tolerance']:
        results['speed'] = {"actual": actual_speed, "status": "Good"}
    elif actual_speed < benchmark['ideal_squats_per_sec']:
        results['speed'] = {"actual": actual_speed, "status": "Too slow"}
    else:
        results['speed'] = {"actual": actual_speed, "status": "Too fast"}

    return results
