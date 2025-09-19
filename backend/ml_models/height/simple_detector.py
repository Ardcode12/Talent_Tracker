#!/usr/bin/env python3
"""Simple Height Detection Test"""

import cv2
import mediapipe as mp
import numpy as np
import os
from pathlib import Path

def detect_height(image_path):
    print(f"📸 Analyzing: {image_path}")
    
    # Initialize MediaPipe
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.7)
    
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        print("❌ Could not load image!")
        return
    
    h, w = image.shape[:2]
    print(f"   Image size: {w}x{h}")
    
    # Convert to RGB and detect pose
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = pose.process(image_rgb)
    
    if not results.pose_landmarks:
        print("❌ No person detected!")
        return
    
    # Simple height calculation
    landmarks = results.pose_landmarks.landmark
    head_y = (landmarks[7].y + landmarks[8].y) / 2 - 0.1  # Ears + head extension
    feet_y = max(landmarks[27].y, landmarks[28].y)  # Ankles
    
    height_pixels = abs(feet_y - head_y) * h
    height_ratio = height_pixels / h
    
    # Estimate height
    if height_ratio > 0.7:
        estimated_height = 180
    elif height_ratio > 0.5:
        estimated_height = 175
    else:
        estimated_height = 170
    
    print(f"✅ Height detected: {estimated_height} cm")
    print(f"   Confidence: {height_ratio:.3f}")
    
    return estimated_height

def main():
    print("🏃‍♂️ Simple Height Detection Test")
    print("=" * 40)
    
    # Check for test images
    test_dir = Path("test_images")
    if not test_dir.exists():
        test_dir.mkdir()
        print("📁 Created test_images directory")
        print("📝 Add some test images and run again")
        return
    
    # Find images
    images = list(test_dir.glob("*.jpg")) + list(test_dir.glob("*.png"))
    
    if not images:
        print("📭 No images found in test_images/")
        print("📝 Add JPG or PNG images to test_images/ folder")
        return
    
    print(f"📸 Found {len(images)} images:")
    for img in images:
        print(f"   - {img.name}")
    
    # Test each image
    for image_path in images:
        detect_height(str(image_path))
        print()

if __name__ == "__main__":
    main()