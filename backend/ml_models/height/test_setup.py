#!/usr/bin/env python3
"""Quick setup test"""

print("🧪 Testing Height Detection Setup...")

try:
    import mediapipe as mp
    import cv2
    import numpy as np
    import matplotlib.pyplot as plt
    
    print(f"✅ MediaPipe: {mp.__version__}")
    print(f"✅ OpenCV: {cv2.__version__}")
    print(f"✅ NumPy: {np.__version__}")
    print(f"✅ Matplotlib: {plt.matplotlib.__version__}")
    
    # Test MediaPipe initialization
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(static_image_mode=True)
    print("✅ MediaPipe pose detection initialized!")
    
    print("\n🎉 All systems ready for height detection!")
    
except Exception as e:
    print(f"❌ Error: {e}")