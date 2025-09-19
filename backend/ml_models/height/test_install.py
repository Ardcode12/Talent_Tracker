# test_install.py
try:
    import cv2
    print("✅ OpenCV installed successfully")
    print(f"   OpenCV version: {cv2.__version__}")
except ImportError:
    print("❌ OpenCV not installed")

try:
    import mediapipe as mp
    print("✅ MediaPipe installed successfully")
    print(f"   MediaPipe version: {mp.__version__}")
except ImportError:
    print("❌ MediaPipe not installed")

try:
    import numpy as np
    print("✅ NumPy installed successfully")
    print(f"   NumPy version: {np.__version__}")
except ImportError:
    print("❌ NumPy not installed")

try:
    import tensorflow as tf
    print("✅ TensorFlow installed successfully")
    print(f"   TensorFlow version: {tf.__version__}")
except ImportError:
    print("❌ TensorFlow not installed")
    
print("\n🎉 Core dependencies check complete!")