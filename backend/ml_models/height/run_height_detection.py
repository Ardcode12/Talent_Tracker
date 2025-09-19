#!/usr/bin/env python3
"""
Height Detection System - Easy Startup Script
=============================================

This script provides an easy way to run the height detection system.

Usage:
    python run_height_detection.py
"""

import subprocess
import sys
import os
from pathlib import Path
import time

def check_dependencies():
    """Check if all dependencies are installed"""
    
    print("🔍 Checking dependencies...")
    
    required_packages = [
        'mediapipe',
        'opencv-python', 
        'numpy',
        'matplotlib',
        'fastapi',
        'uvicorn'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
            print(f"   ✅ {package}")
        except ImportError:
            print(f"   ❌ {package} - Missing!")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n📦 Missing packages: {', '.join(missing_packages)}")
        print("Run 'python setup_height_detection.py' to install them")
        return False
    
    print("✅ All dependencies are installed!")
    return True

def create_test_directories():
    """Create necessary directories"""
    
    directories = [
        "test_images",
        "height_detection_results", 
        "api_results"
    ]
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
    
    print("📁 Test directories ready")

def show_menu():
    """Show main menu"""
    
    print("\n🏃‍♂️ HEIGHT DETECTION SYSTEM")
    print("=" * 40)
    print("1. 🌐 Start Web API (Recommended)")
    print("2. 🧪 Interactive Testing")
    print("3. 📸 Test Single Image")
    print("4. 🎬 Test Video")
    print("5. 📊 View Results") 
    print("6. 🔧 Setup System")
    print("7. ❓ Help")
    print("8. 🚪 Exit")
    print("=" * 40)

def start_web_api():
    """Start the web API server"""
    
    print("🌐 Starting Height Detection Web API...")
    print("📍 URL: http://localhost:8001")
    print("📋 API Docs: http://localhost:8001/docs")
    print("⏹️  Press Ctrl+C to stop the server")
    
    try:
        subprocess.run([sys.executable, "height_detection_api.py"])
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
    except FileNotFoundError:
        print("❌ height_detection_api.py not found!")
        print("Make sure all files are in the same directory")

def interactive_testing():
    """Start interactive testing"""
    
    print("🧪 Starting Interactive Testing...")
    
    try:
        subprocess.run([sys.executable, "test_height_detection.py", "--interactive"])
    except FileNotFoundError:
        print("❌ test_height_detection.py not found!")
        print("Make sure all files are in the same directory")

def test_single_image():
    """Test single image"""
    
    print("📸 Test Single Image")
    
    image_path = input("Enter image path: ").strip()
    if not os.path.exists(image_path):
        print(f"❌ Image not found: {image_path}")
        return
    
    actual_height = input("Enter actual height in cm (optional): ").strip()
    
    cmd = [sys.executable, "test_height_detection.py", "--image", image_path]
    if actual_height:
        cmd.extend(["--height", actual_height])
    
    try:
        subprocess.run(cmd)
    except FileNotFoundError:
        print("❌ test_height_detection.py not found!")

def test_video():
    """Test video"""
    
    print("🎬 Test Video")
    
    video_path = input("Enter video path: ").strip()
    if not os.path.exists(video_path):
        print(f"❌ Video not found: {video_path}")
        return
    
    actual_height = input("Enter actual height in cm (optional): ").strip()
    
    cmd = [sys.executable, "test_height_detection.py", "--video", video_path]
    if actual_height:
        cmd.extend(["--height", actual_height])
    
    try:
        subprocess.run(cmd)
    except FileNotFoundError:
        print("❌ test_height_detection.py not found!")

def view_results():
    """View detection results"""
    
    print("📊 Viewing Results...")
    
    results_dirs = [
        Path("height_detection_results"),
        Path("api_results")
    ]
    
    total_results = 0
    
    for results_dir in results_dirs:
        if results_dir.exists():
            json_files = list(results_dir.glob("*.json"))
            image_files = list(results_dir.glob("*.png"))
            
            print(f"\n📁 {results_dir}:")
            print(f"   JSON results: {len(json_files)}")
            print(f"   Image results: {len(image_files)}")
            
            total_results += len(json_files)
            
            # Show recent results
            if json_files:
                print("   Recent results:")
                for json_file in sorted(json_files, reverse=True)[:3]:
                    try:
                        import json
                        with open(json_file, 'r') as f:
                            data = json.load(f)
                        height = data.get('height_cm', 'N/A')
                        confidence = data.get('confidence', 'N/A')
                        print(f"     - {json_file.name}: {height}cm (confidence: {confidence})")
                    except:
                        print(f"     - {json_file.name}: Error reading file")
    
    if total_results == 0:
        print("\n📭 No results found. Run some tests first!")
    else:
        print(f"\n📈 Total results found: {total_results}")

def setup_system():
    """Run system setup"""
    
    print("🔧 Running System Setup...")
    
    try:
        subprocess.run([sys.executable, "setup_height_detection.py"])
    except FileNotFoundError:
        print("❌ setup_height_detection.py not found!")
        print("Make sure all files are in the same directory")

def show_help():
    """Show help information"""
    
    help_text = """
🏃‍♂️ HEIGHT DETECTION SYSTEM - HELP
=====================================

📋 WHAT THIS SYSTEM DOES:
- Detects human height from photos and videos
- Uses AI (MediaPipe) for pose detection
- Provides accuracy within ±5-10cm typically
- Works with any smartphone camera

🎯 HOW TO USE:

1. WEB INTERFACE (Easiest):
   - Choose option 1 to start web server
   - Open http://localhost:8001 in browser
   - Upload image and get instant results

2. COMMAND LINE:
   - Choose option 2 for interactive testing
   - Follow prompts to test images/videos

📸 IMAGE REQUIREMENTS:
- Full body visible (head to feet)
- Person standing straight
- Good lighting
- Clear background
- Supported formats: JPG, PNG, MP4, AVI

🎯 TESTING TIPS:
- Camera at chest level for best accuracy
- Person should fill 60-80% of frame height
- Avoid shadows and poor lighting
- Provide actual height for accuracy testing

📊 RESULTS:
- Visual plots with detected landmarks
- JSON files with detailed measurements
- Accuracy metrics when actual height provided

🔧 TROUBLESHOOTING:
- If imports fail, run option 6 (Setup System)
- Make sure all files are in same directory
- Check that webcam works for live testing

📞 SUPPORT:
- Check file permissions if errors occur
- Ensure Python 3.8+ is installed
- Verify all dependencies are installed
"""
    
    print(help_text)

def main():
    """Main function"""
    
    print("🏃‍♂️ Height Detection System Launcher")
    print("=" * 45)
    
    # Check if dependencies are installed
    if not check_dependencies():
        print("\n🔧 Please install dependencies first:")
        print("   python setup_height_detection.py")
        return
    
    # Create directories
    create_test_directories()
    
    while True:
        show_menu()
        
        try:
            choice = input("\nSelect option (1-8): ").strip()
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        
        if choice == '1':
            start_web_api()
        elif choice == '2':
            interactive_testing()
        elif choice == '3':
            test_single_image()
        elif choice == '4':
            test_video()
        elif choice == '5':
            view_results()
        elif choice == '6':
            setup_system()
        elif choice == '7':
            show_help()
        elif choice == '8':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid option. Please choose 1-8.")
        
        input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()