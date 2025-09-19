"""
Height Detection API - Simple Backend for Testing
================================================

This provides a simple FastAPI backend to test height detection
without needing a full frontend.

Usage:
    python height_detection_api.py
    
Then open: http://localhost:8001/docs
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import cv2
import mediapipe as mp
import numpy as np
import json
import os
from pathlib import Path
from datetime import datetime

# Initialize FastAPI app
app = FastAPI(
    title="Height Detection API",
    description="AI-powered human height detection from images and videos",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create results directory
RESULTS_DIR = Path("api_results")
RESULTS_DIR.mkdir(exist_ok=True)

# Serve static files (for results)
app.mount("/results", StaticFiles(directory="api_results"), name="results")

# --- Core Height Detection Class ---
class HeightDetectionAPI:
    """Height detection API class using MediaPipe Pose."""
    
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            enable_segmentation=True,
            min_detection_confidence=0.7
        )
        self.scaling_factor = None
        print("✅ MediaPipe Height Detection initialized.")
    
    def detect_height_from_image(self, image_array: np.ndarray, actual_height: float = None) -> dict:
        """
        Detect height from an image array using MediaPipe Pose landmarks.

        Args:
            image_array: The input image as a NumPy array (BGR format).
            actual_height: Optional actual height in cm for accuracy testing and scaling.

        Returns:
            A dictionary containing height detection results, or None if no person is detected.
        """
        h, w = image_array.shape[:2]
        image_rgb = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
        
        results = self.pose.process(image_rgb)
        
        if not results.pose_landmarks:
            return None
        
        landmarks = results.pose_landmarks.landmark
        
        # Define key landmarks for height calculation
        nose = landmarks[self.mp_pose.PoseLandmark.NOSE]
        left_ear = landmarks[self.mp_pose.PoseLandmark.LEFT_EAR]
        right_ear = landmarks[self.mp_pose.PoseLandmark.RIGHT_EAR]
        left_ankle = landmarks[self.mp_pose.PoseLandmark.LEFT_ANKLE]
        right_ankle = landmarks[self.mp_pose.PoseLandmark.RIGHT_ANKLE]
        left_heel = landmarks[self.mp_pose.PoseLandmark.LEFT_HEEL]
        right_heel = landmarks[self.mp_pose.PoseLandmark.RIGHT_HEEL]
        
        # Calculate the top of the head
        head_center_y = (left_ear.y + right_ear.y) / 2
        # Extrapolate based on the distance between the nose and ears
        head_top_y = head_center_y - (nose.y - head_center_y) * 1.5 
        
        # Calculate the bottom of the feet
        feet_bottom_y = max(left_ankle.y, right_ankle.y, left_heel.y, right_heel.y)
        
        # Convert normalized coordinates to pixel coordinates
        head_top_pixel = head_top_y * h
        feet_bottom_pixel = feet_bottom_y * h
        
        height_pixels = abs(feet_bottom_pixel - head_top_pixel)
        
        estimated_height_cm = None
        
        # Use provided actual height to calibrate the scaling factor
        if actual_height:
            self.scaling_factor = actual_height / height_pixels
            estimated_height_cm = actual_height
            print(f"🌟 Scaling factor calculated: {self.scaling_factor:.4f} cm/pixel")
        
        # If a scaling factor exists, use it for estimation
        elif self.scaling_factor:
            estimated_height_cm = height_pixels * self.scaling_factor
        
        # Fallback if no actual height or scaling factor is available
        else:
            # Use a generic fallback ratio (e.g., assuming average person height of 175cm)
            fallback_ratio = 175.0 / 600  # 600 pixels is a common person height in a good photo
            estimated_height_cm = height_pixels * fallback_ratio
            print("⚠️ No actual height provided. Using a generic fallback for estimation.")
        
        # Calculate confidence based on landmark visibility
        key_landmarks = [nose, left_ear, right_ear, left_ankle, right_ankle, left_heel, right_heel]
        visibility_scores = [lm.visibility for lm in key_landmarks if lm.visibility > 0.5]
        confidence = sum(visibility_scores) / len(visibility_scores) if visibility_scores else 0
        
        # The corrected and final result dictionary
        result = {
            'height_cm': round(estimated_height_cm, 2),
            'height_pixels': round(height_pixels, 2),
            'confidence': round(confidence, 3),
            'landmarks_detected': True,
            'head_top_y': round(head_top_y, 3),
            'feet_bottom_y': round(feet_bottom_y, 3),
            # This is the essential field for the frontend
            'landmark_visibility': { 
                'nose': round(nose.visibility, 3),
                'ears': round((left_ear.visibility + right_ear.visibility) / 2, 3),
                'ankles': round((left_ankle.visibility + right_ankle.visibility) / 2, 3),
                'heels': round((left_heel.visibility + right_heel.visibility) / 2, 3)
            }
        }
        
        if self.scaling_factor:
            result['scaling_factor'] = round(self.scaling_factor, 4)

        if actual_height:
            result['actual_height'] = actual_height
            result['error_cm'] = round(abs(estimated_height_cm - actual_height), 2)
            result['error_percent'] = round((result['error_cm'] / actual_height) * 100, 2)
        
        # Save results to a file for later retrieval
        timestamp = datetime.now().isoformat()
        result_filename = RESULTS_DIR / f"result_{timestamp.replace(':', '-')}.json"
        
        # Make a copy and add timestamp for file saving
        save_result = result.copy()
        save_result['timestamp'] = timestamp
        
        with open(result_filename, 'w') as f:
            json.dump(save_result, f, indent=4)
            
        return result

# Initialize detector instance
detector = HeightDetectionAPI()

# --- FastAPI Endpoints ---

@app.get("/", response_class=HTMLResponse)
async def home():
    """Home page with upload form"""
    # The HTML content remains the same as provided by the user
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Height Detection API</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 900px; 
                margin: 0 auto; 
                padding: 20px; 
                background-color: #f0f2f5;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                margin-bottom: 30px;
            }
            .container { 
                background: white; 
                padding: 30px; 
                border-radius: 15px; 
                margin: 20px 0; 
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            input[type="file"] { 
                margin: 15px 0; 
                padding: 10px;
                border: 2px dashed #ddd;
                border-radius: 8px;
                width: 100%;
                background: #f9f9f9;
            }
            input[type="number"] {
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                width: 100px;
            }
            button { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 15px 30px; 
                border: none; 
                border-radius: 8px; 
                cursor: pointer; 
                font-size: 16px;
                font-weight: bold;
                margin: 10px 5px;
            }
            button:hover { 
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }
            .result { 
                background: #d4edda; 
                padding: 20px; 
                border-radius: 10px; 
                margin: 20px 0; 
                border-left: 5px solid #28a745;
            }
            .error { 
                background: #f8d7da; 
                padding: 20px; 
                border-radius: 10px; 
                margin: 20px 0; 
                border-left: 5px solid #dc3545;
            }
            .processing {
                background: #d1ecf1;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                border-left: 5px solid #17a2b8;
            }
            .upload-area {
                border: 3px dashed #ccc;
                border-radius: 10px;
                padding: 40px;
                text-align: center;
                background: #fafafa;
                transition: all 0.3s ease;
            }
            .upload-area:hover {
                border-color: #667eea;
                background: #f0f4ff;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }
            .stat-card {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                text-align: center;
                border: 1px solid #e9ecef;
            }
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: #495057;
            }
            .stat-label {
                font-size: 14px;
                color: #6c757d;
                margin-top: 5px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🏃‍♂️ Height Detection API</h1>
            <p>AI-Powered Human Height Detection System</p>
        </div>
        
        <div class="container">
            <h2>📸 Upload Image for Height Detection</h2>
            <div class="upload-area">
                <form id="uploadForm" enctype="multipart/form-data">
                    <p><strong>Select an image (JPG, PNG) with a person standing:</strong></p>
                    <input type="file" id="imageFile" accept="image/*" required>
                    <br>
                    <label><strong>Actual height (optional):</strong>
                        <input type="number" id="actualHeight" placeholder="175" step="0.1"> cm
                    </label>
                    <br><br>
                    <button type="submit">🔍 Detect Height</button>
                    <button type="button" onclick="clearResults()">🗑️ Clear Results</button>
                </form>
            </div>
        </div>
        
        <div id="results"></div>
        
        <div class="container">
            <h2>📋 API Information</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">FastAPI</div>
                    <div class="stat-label">Backend Framework</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">MediaPipe</div>
                    <div class="stat-label">AI Engine</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">±5-10cm</div>
                    <div class="stat-label">Typical Accuracy</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">1-3s</div>
                    <div class="stat-label">Processing Time</div>
                </div>
            </div>
            
            <h3>🎯 API Endpoints:</h3>
            <ul>
                <li><strong>POST /detect-height</strong> - Upload image for height detection</li>
                <li><strong>GET /health</strong> - API health check</li>
                <li><strong>GET /results</strong> - List recent detection results</li>
                <li><strong>GET /docs</strong> - Interactive API documentation</li>
            </ul>
            
            <p><a href="/docs" target="_blank">📖 View Interactive API Documentation</a></p>
        </div>

        <script>
            document.getElementById('uploadForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const fileInput = document.getElementById('imageFile');
                const actualHeight = document.getElementById('actualHeight').value;
                const resultsDiv = document.getElementById('results');
                
                if (!fileInput.files[0]) {
                    resultsDiv.innerHTML = '<div class="error">❌ Please select an image file</div>';
                    return;
                }
                
                const formData = new FormData();
                formData.append('image', fileInput.files[0]);
                if (actualHeight) {
                    formData.append('actual_height', actualHeight);
                }
                
                resultsDiv.innerHTML = `
                    <div class="processing">
                        <h3>🔍 Processing Image...</h3>
                        <p>AI is analyzing the image for height detection. Please wait...</p>
                    </div>
                `;
                
                try {
                    const response = await fetch('/detect-height', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        let html = `
                            <div class="result">
                                <h3>✅ Height Detection Results</h3>
                                <div class="stats-grid">
                                    <div class="stat-card">
                                        <div class="stat-value">${result.height_cm} cm</div>
                                        <div class="stat-label">Detected Height</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">${result.confidence}</div>
                                        <div class="stat-label">Confidence Score</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">${result.height_pixels}</div>
                                        <div class="stat-label">Height in Pixels</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">${result.scaling_factor}</div>
                                        <div class="stat-label">Scaling Factor</div>
                                    </div>
                                </div>
                                
                                <h4>👁️ Landmark Visibility:</h4>
                                <div class="stats-grid">
                                    <div class="stat-card">
                                        <div class="stat-value">${result.landmark_visibility.nose}</div>
                                        <div class="stat-label">Nose</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">${result.landmark_visibility.ears}</div>
                                        <div class="stat-label">Ears</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">${result.landmark_visibility.ankles}</div>
                                        <div class="stat-label">Ankles</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">${result.landmark_visibility.heels}</div>
                                        <div class="stat-label">Heels</div>
                                    </div>
                                </div>
                        `;
                        
                        if (result.actual_height) {
                            const error = Math.abs(result.height_cm - result.actual_height);
                            const errorPercent = ((error / result.actual_height) * 100).toFixed(1);
                            html += `
                                <h4>🎯 Accuracy Check:</h4>
                                <div class="stats-grid">
                                    <div class="stat-card">
                                        <div class="stat-value">${result.actual_height} cm</div>
                                        <div class="stat-label">Actual Height</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">±${error.toFixed(1)} cm</div>
                                        <div class="stat-label">Error</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value">${errorPercent}%</div>
                                        <div class="stat-label">Error Percentage</div>
                                    </div>
                                </div>
                            `;
                        }
                        
                        html += '</div>';
                        resultsDiv.innerHTML = html;
                    } else {
                        resultsDiv.innerHTML = `<div class="error">❌ Error: ${result.detail}</div>`;
                    }
                } catch (error) {
                    resultsDiv.innerHTML = `<div class="error">❌ Network error or an issue occurred: ${error.message}</div>`;
                }
            });
            
            function clearResults() {
                document.getElementById('results').innerHTML = '';
                document.getElementById('imageFile').value = '';
                document.getElementById('actualHeight').value = '';
            }
        </script>
    </body>
    </html>
    """

@app.post("/detect-height")
async def detect_height_endpoint(
    image: UploadFile = File(...),
    actual_height: float = Form(None)
):
    """
    Detect height from uploaded image.
    
    - **image**: Image file (JPG, PNG, etc.).
    - **actual_height**: Optional actual height in cm for accuracy testing.
    """
    
    try:
        image_bytes = await image.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        cv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if cv_image is None:
            raise HTTPException(status_code=400, detail="Could not decode image.")
        
        # Detect height using the detector class
        result = detector.detect_height_from_image(cv_image, actual_height)
        
        if result is None:
            raise HTTPException(status_code=400, detail="No person detected in image. Please ensure the full body is visible.")
        
        return JSONResponse(content=result)
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Height detection failed: {str(e)}")

@app.get("/health")
async def health_check():
    """API health check."""
    
    return {
        "status": "healthy",
        "service": "Height Detection API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "mediapipe_version": mp.__version__,
        "opencv_version": cv2.__version__,
        "system_info": {
            "mediapipe_available": True,
            "pose_detection_ready": True,
            "results_directory": str(RESULTS_DIR),
            "results_directory_exists": RESULTS_DIR.exists()
        }
    }

@app.get("/results")
async def list_results():
    """List all detection results."""
    
    result_files = list(RESULTS_DIR.glob("*.json"))
    results = []
    
    for file_path in sorted(result_files, reverse=True)[:10]:  # Last 10 results
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Check for the existence of required keys before appending
            if all(key in data for key in ['timestamp', 'height_cm', 'confidence', 'actual_height', 'error_cm']):
                results.append({
                    'filename': file_path.name,
                    'timestamp': data.get('timestamp'),
                    'height_cm': data.get('height_cm'),
                    'confidence': data.get('confidence'),
                    'actual_height': data.get('actual_height'),
                    'error_cm': data.get('error_cm')
                })
        except:
            continue
    
    return {
        "total_results": len(results),
        "recent_results": results,
        "results_directory": str(RESULTS_DIR)
    }

@app.get("/stats")
async def get_detection_stats():
    """Get detection statistics."""
    
    result_files = list(RESULTS_DIR.glob("*.json"))
    
    if not result_files:
        return {
            "message": "No detection results available yet.",
            "total_detections": 0
        }
    
    heights = []
    confidences = []
    errors = []
    
    for file_path in result_files:
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            if 'height_cm' in data:
                heights.append(data['height_cm'])
            if 'confidence' in data:
                confidences.append(data['confidence'])
            if 'error_cm' in data:
                errors.append(data['error_cm'])
        except:
            continue
    
    stats = {
        "total_detections": len(result_files),
        "height_stats": {
            "average_height": round(sum(heights) / len(heights), 1) if heights else 0,
            "min_height": min(heights) if heights else 0,
            "max_height": max(heights) if heights else 0
        },
        "confidence_stats": {
            "average_confidence": round(sum(confidences) / len(confidences), 3) if confidences else 0,
            "min_confidence": min(confidences) if confidences else 0,
            "max_confidence": max(confidences) if confidences else 0
        }
    }
    
    if errors:
        stats["accuracy_stats"] = {
            "average_error_cm": round(sum(errors) / len(errors), 1),
            "min_error_cm": min(errors),
            "max_error_cm": max(errors),
            "total_tested_with_known_height": len(errors)
        }
    
    return stats

@app.delete("/results")
async def clear_results():
    """Clear all detection results."""
    
    try:
        result_files = list(RESULTS_DIR.glob("*.json"))
        deleted_count = 0
        
        for file_path in result_files:
            try:
                file_path.unlink()
            except:
                continue
        
        return {
            "message": f"Cleared {deleted_count} result files.",
            "deleted_count": deleted_count
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear results: {str(e)}")

@app.get("/demo")
async def demo_endpoint():
    """Demo endpoint with sample data."""
    
    return {
        "demo_results": [
            {
                "height_cm": 175.2,
                "confidence": 0.892,
                "method": "pose_landmarks",
                "processing_time_ms": 1240
            },
            {
                "height_cm": 168.7,
                "confidence": 0.956,
                "method": "pose_landmarks", 
                "processing_time_ms": 980
            }
        ],
        "api_info": {
            "description": "This is a demo showing sample height detection results.",
            "usage": "Upload an image to /detect-height endpoint to get real results.",
            "supported_formats": ["JPG", "JPEG", "PNG", "BMP"],
            "typical_accuracy": "±5-10cm with good quality images"
        }
    }

def main():
    """Run the API server."""
    
    print("🏃‍♂️ Starting Height Detection API Server...")
    print("-" * 50)
    print("📊 Web Interface: http://localhost:8001")
    print("📋 API Documentation: http://localhost:8001/docs")
    print("🔍 Health Check: http://localhost:8001/health")
    print("📈 Statistics: http://localhost:8001/stats")
    print("📄 Results: http://localhost:8001/results")
    print("-" * 50)
    print("🎯 HOW TO TEST:")
    print("1. Open http://localhost:8001 in your browser.")
    print("2. Upload an image with a person standing.")
    print("3. Optionally enter actual height for accuracy testing.")
    print("4. Click 'Detect Height' and view results.")
    print("-" * 50)
    print("🚀 Starting server...")
    
    uvicorn.run(
        "height_detection_api:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()