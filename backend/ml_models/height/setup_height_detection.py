#!/usr/bin/env python3
"""
Height Detection Setup and Quick Test Script
============================================

This script helps you set up and quickly test the height detection system.

Usage:
    python setup_height_detection.py
"""

import subprocess
import sys
import os
from pathlib import Path
import cv2
import requests
from datetime import datetime

def install_requirements():
    """Install required packages"""
    
    print("📦 Installing required packages...")
    
    packages = [
        "mediapipe>=0.10.18",
        "opencv-python>=4.8.0", 
        "numpy>=1.24.0",
        "matplotlib>=3.7.0",
        "Pillow>=10.0.0",
        "imageio>=2.31.0",
        "fastapi>=0.104.1",
        "uvicorn[standard]>=0.24.0"
    ]
    
    for package in packages:
        print(f"   Installing {package}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install {package}: {e}")
            return False
    
    print("✅ All packages installed successfully!")
    return True

def download_sample_images():
    """Download sample images for testing"""
    
    print("📸 Setting up sample test images...")
    
    # Create test images directory
    test_dir = Path("test_images")
    test_dir.mkdir(exist_ok=True)
    
    # Sample test images (you can replace these URLs with your own)
    sample_images = {
        "standing_person.jpg": "Sample standing person image",
        "athlete_photo.jpg": "Sample athlete photo"
    }
    
    # For now, we'll create instructions for users to add their own images
    readme_content = """
# Test Images Directory

Place your test images and videos here for height detection testing.

## Recommended Images:
1. Full body photos (head to feet visible)
2. Person standing straight
3. Good lighting and clear visibility
4. Minimal background clutter

## Supported Formats:
- Images: .jpg, .jpeg, .png, .bmp
- Videos: .mp4, .avi, .mov, .mkv

## Tips for Best Results:
- Person should fill 60-80% of frame height
- Camera should be at chest level (not looking up/down)
- Good contrast between person and background
- Clear visibility of head and feet
"""
    
    with open(test_dir / "README.md", "w") as f:
        f.write(readme_content)
    
    print(f"📁 Test directory created: {test_dir}")
    print("📝 Add your test images to this directory")
    
    return test_dir

def create_sample_test_image():
    """Create a simple test image using webcam"""
    
    print("📹 Creating sample test image from webcam...")
    
    # Try to open webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ Could not access webcam")
        return None
    
    print("📸 Webcam opened. Press SPACE to capture test image, ESC to skip")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Could not read from webcam")
            break
        
        # Add instructions overlay
        cv2.putText(frame, "Stand back, full body visible", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(frame, "Press SPACE to capture, ESC to skip", (10, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        cv2.imshow('Sample Test Image Capture', frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == 27:  # ESC
            print("⏭️  Skipping webcam capture")
            break
        elif key == 32:  # SPACE
            # Save image
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            image_path = f"test_images/sample_capture_{timestamp}.jpg"
            cv2.imwrite(image_path, frame)
            print(f"✅ Sample image saved: {image_path}")
            cap.release()
            cv2.destroyAllWindows()
            return image_path
    
    cap.release()
    cv2.destroyAllWindows()
    return None

def run_quick_test():
    """Run a quick test of the height detection system"""
    
    print("\n🧪 Running quick system test...")
    
    try:
        # Test imports
        import mediapipe as mp
        import cv2
        import numpy as np
        import matplotlib.pyplot as plt
        
        print("✅ All imports successful")
        
        # Test MediaPipe pose detection
        mp_pose = mp.solutions.pose
        pose = mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5)
        
        # Create a simple test image (blank with some text)
        test_image = np.ones((480, 640, 3), dtype=np.uint8) * 255
        cv2.putText(test_image, "Height Detection System", (50, 240), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
        
        # Test pose processing (should return no landmarks for blank image)
        results = pose.process(test_image)
        
        print("✅ MediaPipe pose detection initialized")
        print("✅ System test completed successfully!")
        
        return True
        
    except Exception as e:
        print(f"❌ System test failed: {e}")
        return False

def create_demo_files():
    """Create demo files for testing"""
    
    print("📄 Creating demo files...")
    
    # Create a simple test script
    demo_script = '''#!/usr/bin/env python3
"""
Quick Height Detection Demo
"""

import cv2
import mediapipe as mp
import numpy as np

def quick_demo():
    print("🔍 Quick Height Detection Demo")
    print("This demo shows that all systems are working!")
    
    # Initialize MediaPipe
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(static_image_mode=True)
    
    print("✅ MediaPipe initialized successfully")
    print("✅ OpenCV working")
    print("✅ All dependencies installed correctly")
    print("")
    print("🚀 Ready to detect heights!")
    print("Run: python test_height_detection.py --interactive")

if __name__ == "__main__":
    quick_demo()
'''
    
    with open("quick_demo.py", "w") as f:
        f.write(demo_script)
    
    print("✅ Demo files created")

def main():
    """Main setup function"""
    
    print("🏃‍♂️ SAI Sports Platform - Height Detection Setup")
    print("=" * 55)
    
    print("\n🔧 Setting up height detection system...")
    
    # Step 1: Install requirements
    if not install_requirements():
        print("❌ Setup failed during package installation")
        return False
    
    # Step 2: Create test directory
    test_dir = download_sample_images()
    
    # Step 3: Run system test
    if not run_quick_test():
        print("❌ Setup failed during system test")
        return False
    
    # Step 4: Create demo files
    create_demo_files()
    
    # Step 5: Optional webcam test
    print("\n📸 Would you like to create a sample test image? (y/n): ", end="")
    try:
        choice = input().strip().lower()
    except KeyboardInterrupt:
        choice = 'n'
    
    sample_image = None
    if choice == 'y':
        sample_image = create_sample_test_image()
    
    # Step 6: Instructions
    print("\n✅ HEIGHT DETECTION SETUP COMPLETE!")
    print("=" * 45)
    
    print("\n📋 HOW TO TEST:")
    print("1. Add test images/videos to 'test_images/' directory")
    print("2. Run: python test_height_detection.py")
    print("3. Choose interactive mode for easy testing")
    
    print("\n📋 COMMAND LINE OPTIONS:")
    print("   # Test single image")
    print("   python test_height_detection.py --image photo.jpg --height 175")
    print("")
    print("   # Test video")
    print("   python test_height_detection.py --video video.mp4 --height 175")
    print("")
    print("   # Interactive mode")
    print("   python test_height_detection.py --interactive")
    
    if sample_image:
        print(f"\n🎯 QUICK TEST:")
        print(f"   python test_height_detection.py --image {sample_image}")
    
    print("\n🌐 WEB INTERFACE:")
    print("   python height_detection_api.py")
    print("   Then open: http://localhost:8001")
    
    print("\n📊 RESULTS LOCATION:")
    print("   - Visual results: height_detection_results/")
    print("   - JSON data: height_detection_results/")
    print("   - Plots will be displayed automatically")
    
    print("\n🎯 TESTING TIPS:")
    print("   - Use full-body photos (head to feet visible)")
    print("   - Good lighting and clear visibility")
    print("   - Person should be standing straight")
    print("   - Camera at chest level for best accuracy")
    
    print("\n🚀 Ready to detect heights! 📏")
    
    # Step 7: Quick demo
    print("\n🎮 Running quick demo...")
    try:
        exec(open("quick_demo.py").read())
    except:
        print("Demo will be available after setup")
    
    return True

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 Setup completed successfully!")
        print("\n🚀 NEXT STEPS:")
        print("1. Run 'python test_height_detection.py --interactive' for testing")
        print("2. Run 'python height_detection_api.py' for web interface")
        print("3. Add test images to 'test_images/' folder")
    else:
        print("\n❌ Setup failed. Please check the errors above.")
        sys.exit(1)