#!/usr/bin/env python3
"""
Height Detection Testing Script
===============================

This script allows you to test height detection on images and videos
without needing a frontend. It provides visual results and saves output.

Usage:
    python test_height_detection.py
    
Requirements:
    pip install -r requirements_height_detection.txt
"""

import cv2
import mediapipe as mp
import numpy as np
import matplotlib.pyplot as plt
import os
from pathlib import Path
import json
from datetime import datetime
import argparse

class HeightDetectionTester:
    """
    Simple height detection tester with visual output
    """
    
    def __init__(self):
        # Initialize MediaPipe
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            enable_segmentation=True,
            min_detection_confidence=0.7
        )
        
        # Create output directories
        self.output_dir = Path("height_detection_results")
        self.output_dir.mkdir(exist_ok=True)
        
        print("🔍 Height Detection Tester Initialized")
        print(f"📁 Results will be saved to: {self.output_dir}")
    
    def detect_height_from_image(self, image_path: str, actual_height: float = None):
        """
        Detect height from a single image and show results
        """
        
        print(f"\n📸 Analyzing image: {image_path}")
        
        # Load image
        if not os.path.exists(image_path):
            print(f"❌ Image not found: {image_path}")
            return None
        
        image = cv2.imread(image_path)
        if image is None:
            print(f"❌ Could not load image: {image_path}")
            return None
        
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image.shape[:2]
        
        print(f"   Image dimensions: {w}x{h} pixels")
        
        # Detect pose
        results = self.pose.process(image_rgb)
        
        if not results.pose_landmarks:
            print("❌ No person detected in image")
            return None
        
        # Extract landmarks
        landmarks = results.pose_landmarks.landmark
        
        # Calculate height
        height_result = self._calculate_height_from_landmarks(landmarks, h, w)
        
        # Create visualization
        self._visualize_height_detection(image_rgb, results, height_result, image_path, actual_height)
        
        # Save results
        self._save_results(image_path, height_result, actual_height)
        
        return height_result
    
    def detect_height_from_video(self, video_path: str, actual_height: float = None):
        """
        Detect height from video and show results
        """
        
        print(f"\n🎬 Analyzing video: {video_path}")
        
        if not os.path.exists(video_path):
            print(f"❌ Video not found: {video_path}")
            return None
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"❌ Could not open video: {video_path}")
            return None
        
        # Video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        
        print(f"   Video: {frame_count} frames, {fps:.1f} FPS, {duration:.1f}s duration")
        
        measurements = []
        good_frames = 0
        processed_frames = 0
        
        # Process video frames
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            processed_frames += 1
            
            # Process every 10th frame to speed up analysis
            if processed_frames % 10 != 0:
                continue
            
            # Convert to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w = frame.shape[:2]
            
            # Detect pose
            results = self.pose.process(frame_rgb)
            
            if results.pose_landmarks:
                # Calculate height for this frame
                height_result = self._calculate_height_from_landmarks(
                    results.pose_landmarks.landmark, h, w
                )
                
                if height_result['confidence'] > 0.7:
                    measurements.append(height_result)
                    good_frames += 1
            
            # Progress update
            if processed_frames % 50 == 0:
                progress = (processed_frames / frame_count) * 100
                print(f"   Progress: {progress:.1f}% ({good_frames} good measurements)")
        
        cap.release()
        
        if not measurements:
            print("❌ No valid height measurements found in video")
            return None
        
        # Calculate average height
        heights = [m['height_cm'] for m in measurements]
        confidences = [m['confidence'] for m in measurements]
        
        # Weighted average
        weighted_height = sum(h * c for h, c in zip(heights, confidences)) / sum(confidences)
        avg_confidence = sum(confidences) / len(confidences)
        
        video_result = {
            'height_cm': weighted_height,
            'confidence': avg_confidence,
            'measurements_count': len(measurements),
            'video_frames_processed': processed_frames,
            'good_frames': good_frames
        }
        
        print(f"✅ Video analysis complete:")
        print(f"   Average height: {weighted_height:.1f} cm")
        print(f"   Confidence: {avg_confidence:.3f}")
        print(f"   Valid measurements: {len(measurements)}")
        
        if actual_height:
            error = abs(weighted_height - actual_height)
            error_percent = (error / actual_height) * 100
            print(f"   Actual height: {actual_height:.1f} cm")
            print(f"   Error: ±{error:.1f} cm ({error_percent:.1f}%)")
        
        # Save results
        self._save_results(video_path, video_result, actual_height)
        
        return video_result
    
    def _calculate_height_from_landmarks(self, landmarks, image_height, image_width):
        """
        Calculate height from MediaPipe landmarks
        """
        
        # Key landmarks for height calculation
        nose = landmarks[0]
        left_ear = landmarks[7]
        right_ear = landmarks[8]
        left_ankle = landmarks[27]
        right_ankle = landmarks[28]
        left_heel = landmarks[29]
        right_heel = landmarks[30]
        
        # Calculate head top (extrapolate above ears)
        head_center_y = (left_ear.y + right_ear.y) / 2
        head_height_ratio = 0.12  # Head extends about 12% above ear level
        head_top_y = head_center_y - head_height_ratio
        
        # Calculate feet bottom
        feet_bottom_y = max(left_ankle.y, right_ankle.y, left_heel.y, right_heel.y)
        
        # Convert to pixel coordinates
        head_top_pixel = head_top_y * image_height
        feet_bottom_pixel = feet_bottom_y * image_height
        
        # Calculate height in pixels
        height_pixels = abs(feet_bottom_pixel - head_top_pixel)
        
        # Estimate real height (this is approximate without calibration)
        # Use typical human proportions and image framing
        height_ratio = height_pixels / image_height
        
        if height_ratio > 0.8:
            estimated_height = 180.0  # Person fills most of frame
        elif height_ratio > 0.6:
            estimated_height = 175.0  # Person is prominent
        elif height_ratio > 0.4:
            estimated_height = 170.0  # Person is medium size
        else:
            estimated_height = 165.0  # Person is distant
        
        # Calculate confidence based on landmark visibility
        key_landmarks = [nose, left_ear, right_ear, left_ankle, right_ankle, left_heel, right_heel]
        visibility_scores = [lm.visibility for lm in key_landmarks]
        confidence = sum(visibility_scores) / len(visibility_scores)
        
        return {
            'height_cm': estimated_height,
            'height_pixels': height_pixels,
            'height_ratio': height_ratio,
            'confidence': confidence,
            'head_top_y': head_top_y,
            'feet_bottom_y': feet_bottom_y,
            'landmarks_visibility': {
                'nose': nose.visibility,
                'ears': (left_ear.visibility + right_ear.visibility) / 2,
                'ankles': (left_ankle.visibility + right_ankle.visibility) / 2,
                'heels': (left_heel.visibility + right_heel.visibility) / 2
            }
        }
    
    def _visualize_height_detection(self, image_rgb, pose_results, height_result, image_path, actual_height):
        """
        Create visualization of height detection
        """
        
        # Create figure with multiple subplots
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 8))
        
        # Plot 1: Original image with pose landmarks
        annotated_image = image_rgb.copy()
        
        # Draw pose landmarks
        self.mp_drawing.draw_landmarks(
            annotated_image,
            pose_results.pose_landmarks,
            self.mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=self.mp_drawing_styles.get_default_pose_landmarks_style()
        )
        
        # Draw height measurement lines
        h, w = image_rgb.shape[:2]
        head_top_pixel = int(height_result['head_top_y'] * h)
        feet_bottom_pixel = int(height_result['feet_bottom_y'] * h)
        
        # Draw horizontal lines for head and feet
        cv2.line(annotated_image, (0, head_top_pixel), (w, head_top_pixel), (0, 255, 0), 3)
        cv2.line(annotated_image, (0, feet_bottom_pixel), (w, feet_bottom_pixel), (255, 0, 0), 3)
        
        # Draw vertical measurement line
        center_x = w // 2
        cv2.line(annotated_image, (center_x, head_top_pixel), (center_x, feet_bottom_pixel), (255, 255, 0), 3)
        
        ax1.imshow(annotated_image)
        ax1.set_title(f"Height Detection: {height_result['height_cm']:.1f} cm", fontsize=14)
        ax1.axis('off')
        
        # Plot 2: Results summary
        ax2.axis('off')
        
        # Create results text
        results_text = [
            f"📏 HEIGHT DETECTION RESULTS",
            f"",
            f"🎯 Detected Height: {height_result['height_cm']:.1f} cm",
            f"📊 Confidence: {height_result['confidence']:.3f}",
            f"📐 Height Ratio: {height_result['height_ratio']:.3f}",
            f"🖼️  Height in Pixels: {height_result['height_pixels']:.0f}",
            f"",
            f"👁️  LANDMARK VISIBILITY:",
            f"   Nose: {height_result['landmarks_visibility']['nose']:.3f}",
            f"   Ears: {height_result['landmarks_visibility']['ears']:.3f}",
            f"   Ankles: {height_result['landmarks_visibility']['ankles']:.3f}",
            f"   Heels: {height_result['landmarks_visibility']['heels']:.3f}",
        ]
        
        if actual_height:
            error = abs(height_result['height_cm'] - actual_height)
            error_percent = (error / actual_height) * 100
            results_text.extend([
                f"",
                f"✅ ACCURACY CHECK:",
                f"   Actual Height: {actual_height:.1f} cm",
                f"   Error: ±{error:.1f} cm ({error_percent:.1f}%)",
                f"   Status: {'Good' if error < 5 else 'Needs Improvement'}"
            ])
        
        # Display results text
        y_pos = 0.95
        for line in results_text:
            ax2.text(0.05, y_pos, line, transform=ax2.transAxes, fontsize=11, 
                    verticalalignment='top', fontfamily='monospace')
            y_pos -= 0.05
        
        plt.tight_layout()
        
        # Save visualization
        output_filename = f"height_detection_{Path(image_path).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        output_path = self.output_dir / output_filename
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        
        print(f"📊 Visualization saved: {output_path}")
        
        # Show plot
        plt.show()
        
        plt.close()
    
    def _save_results(self, media_path, height_result, actual_height):
        """
        Save results to JSON file
        """
        
        results_data = {
            'timestamp': datetime.now().isoformat(),
            'input_file': str(media_path),
            'detected_height_cm': height_result['height_cm'],
            'confidence': height_result['confidence'],
            'method': 'mediapipe_pose_landmarks',
            'actual_height_cm': actual_height,
            'error_cm': abs(height_result['height_cm'] - actual_height) if actual_height else None,
            'error_percent': ((abs(height_result['height_cm'] - actual_height) / actual_height) * 100) if actual_height else None,
            'details': height_result
        }
        
        # Save to JSON
        results_filename = f"results_{Path(media_path).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        results_path = self.output_dir / results_filename
        
        with open(results_path, 'w') as f:
            json.dump(results_data, f, indent=2)
        
        print(f"💾 Results saved: {results_path}")

def interactive_tester():
    """
    Interactive testing interface
    """
    
    print("🏃‍♂️ SAI Sports Platform - Height Detection Tester")
    print("=" * 55)
    
    tester = HeightDetectionTester()
    
    while True:
        print("\n📋 TESTING OPTIONS:")
        print("1. Test single image")
        print("2. Test video")
        print("3. Test with webcam (take photo)")
        print("4. Batch test multiple files")
        print("5. Exit")
        
        choice = input("\nSelect option (1-5): ").strip()
        
        if choice == '1':
            test_single_image(tester)
        elif choice == '2':
            test_video(tester)
        elif choice == '3':
            test_webcam(tester)
        elif choice == '4':
            batch_test(tester)
        elif choice == '5':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid option. Please try again.")

def test_single_image(tester):
    """Test single image"""
    
    image_path = input("📸 Enter image path: ").strip()
    actual_height = input("📏 Enter actual height in cm (optional): ").strip()
    
    actual_height = float(actual_height) if actual_height else None
    
    result = tester.detect_height_from_image(image_path, actual_height)
    
    if result:
        print(f"\n✅ Detection completed successfully!")
        print(f"   Height: {result['height_cm']:.1f} cm")
        print(f"   Confidence: {result['confidence']:.3f}")

def test_video(tester):
    """Test video"""
    
    video_path = input("🎬 Enter video path: ").strip()
    actual_height = input("📏 Enter actual height in cm (optional): ").strip()
    
    actual_height = float(actual_height) if actual_height else None
    
    result = tester.detect_height_from_video(video_path, actual_height)
    
    if result:
        print(f"\n✅ Video analysis completed!")
        print(f"   Average height: {result['height_cm']:.1f} cm")
        print(f"   Confidence: {result['confidence']:.3f}")
        print(f"   Valid measurements: {result['measurements_count']}")

def test_webcam(tester):
    """Test with webcam"""
    
    print("📹 Opening webcam... Press SPACE to capture photo, ESC to cancel")
    
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ Could not open webcam")
        return
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Display frame
        cv2.imshow('Webcam - Press SPACE to capture, ESC to cancel', frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == 27:  # ESC
            break
        elif key == 32:  # SPACE
            # Save captured frame
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            image_path = f"captured_image_{timestamp}.jpg"
            cv2.imwrite(image_path, frame)
            
            print(f"📸 Image captured: {image_path}")
            
            # Test height detection
            actual_height = input("📏 Enter actual height in cm (optional): ").strip()
            actual_height = float(actual_height) if actual_height else None
            
            result = tester.detect_height_from_image(image_path, actual_height)
            break
    
    cap.release()
    cv2.destroyAllWindows()

def batch_test(tester):
    """Batch test multiple files"""
    
    folder_path = input("📁 Enter folder path with images/videos: ").strip()
    
    if not os.path.exists(folder_path):
        print(f"❌ Folder not found: {folder_path}")
        return
    
    # Find all image and video files
    extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.mp4', '.avi', '.mov', '.mkv']
    files = []
    
    for ext in extensions:
        files.extend(Path(folder_path).glob(f"*{ext}"))
        files.extend(Path(folder_path).glob(f"*{ext.upper()}"))
    
    if not files:
        print("❌ No image or video files found in folder")
        return
    
    print(f"📁 Found {len(files)} files to process")
    
    results = []
    for i, file_path in enumerate(files, 1):
        print(f"\n📄 Processing {i}/{len(files)}: {file_path.name}")
        
        try:
            if file_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']:
                result = tester.detect_height_from_image(str(file_path))
            else:
                result = tester.detect_height_from_video(str(file_path))
            
            if result:
                results.append({
                    'file': file_path.name,
                    'height': result['height_cm'],
                    'confidence': result['confidence']
                })
        except Exception as e:
            print(f"❌ Error processing {file_path.name}: {e}")
    
    # Summary
    if results:
        print(f"\n📊 BATCH TEST SUMMARY:")
        print(f"   Processed: {len(results)}/{len(files)} files")
        print(f"   Average height: {sum(r['height'] for r in results) / len(results):.1f} cm")
        print(f"   Average confidence: {sum(r['confidence'] for r in results) / len(results):.3f}")

def main():
    """Main function"""
    
    parser = argparse.ArgumentParser(description='Height Detection Tester')
    parser.add_argument('--image', type=str, help='Path to image file')
    parser.add_argument('--video', type=str, help='Path to video file')
    parser.add_argument('--height', type=float, help='Actual height in cm')
    parser.add_argument('--interactive', action='store_true', help='Run interactive mode')
    
    args = parser.parse_args()
    
    tester = HeightDetectionTester()
    
    if args.image:
        result = tester.detect_height_from_image(args.image, args.height)
    elif args.video:
        result = tester.detect_height_from_video(args.video, args.height)
    elif args.interactive:
        interactive_tester()
    else:
        # Default to interactive mode
        interactive_tester()

if __name__ == "__main__":
    main()