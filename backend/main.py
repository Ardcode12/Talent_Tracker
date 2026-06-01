# backend/main.py
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import traceback
import os

# Import modules from current directory (backend)
import models
import schemas
import crud
from database import get_db, engine

# Import core components
from core.config import UPLOAD_DIR

# Import API routers
from api import auth, users, assessments, connections, posts, coaches, messaging, admin, message_ws
from api import notifications, search, rankings 
from api import events

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Create database tables
print("Initializing database tables...")
models.Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(title="TalentTracker API", version="1.0.0")

# ============================================================================
# CORS MIDDLEWARE - ALLOW ALL FOR DEVELOPMENT
# ============================================================================
# This MUST be added BEFORE any routes

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow ALL origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
)

# ============================================================================
# STATIC FILES
# ============================================================================

# Mount static files for uploads
try:
    app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
except Exception as e:
    print(f"Warning: Could not mount uploads directory: {e}")

# ============================================================================
# INCLUDE API ROUTERS
# ============================================================================

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assessments.router)
app.include_router(connections.router)
app.include_router(posts.router)
app.include_router(coaches.router)
app.include_router(messaging.router)
app.include_router(admin.router)
app.include_router(message_ws.router)
app.include_router(notifications.router)
app.include_router(search.router)
app.include_router(rankings.router)
app.include_router(events.router)

# ============================================================================
# ROOT ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    return {
        "message": "Welcome to TalentTracker API",
        "version": "1.0.0",
        "status": "running",
        "cors": "enabled for all origins",
        "endpoints": {
            "api_docs": "/docs",
            "health_check": "/api/health",
            "admin_athletes": "/api/admin/athletes",
            "admin_coaches": "/api/admin/coaches",
            "admin_dashboard": "/api/admin/dashboard/stats"
        }
    }


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")


# ============================================================================
# ADMIN DASHBOARD HTML (Legacy endpoint)
# ============================================================================

@app.get("/api/test-assessment-flow")
def test_assessment_flow():
    """Test the exact feedback format that would be saved"""
    
    EMOJI = {
        'check': '\u2705',
        'medal': '\U0001F3C5',
        'bullet': '\u2022',
    }
    
    # This is exactly what assessments.py creates
    feedback = (
        f"{EMOJI['check']} Squat Analysis:\n\n"
        f"{EMOJI['bullet']} Valid Reps: 10\n"
        f"{EMOJI['bullet']} Partial Reps: 2\n"
        f"{EMOJI['bullet']} Consistency: 85.5%\n\n"
        f"{EMOJI['medal']} AI Score: 78%"
    )
    
    return {
        "feedback": feedback,
        "feedback_bytes": feedback.encode('utf-8').hex(),
        "length": len(feedback)
    }

@app.get("/admin/dashboard", response_class=HTMLResponse)
def old_admin_dashboard(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    athletes = sum(1 for user in users if user.role == 'athlete')
    coaches_count = sum(1 for user in users if user.role == 'coach')
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
        <head>
            <title>TalentTracker Admin Dashboard</title>
            <style>
                body {{ 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    background-color: #1a1a2e; 
                    color: white;
                }}
                .container {{
                    max-width: 1200px;
                    margin: 0 auto;
                }}
                h1 {{ 
                    color: #fff; 
                    text-align: center;
                    margin-bottom: 10px;
                }}
                .stats {{
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin-bottom: 20px;
                }}
                .stat-card {{
                    background: #16213e;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    border: 1px solid #0f3460;
                }}
                .stat-number {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #667eea;
                }}
                .info {{
                    text-align: center;
                    margin-top: 20px;
                    padding: 20px;
                    background: #16213e;
                    border-radius: 10px;
                }}
                a {{
                    color: #667eea;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🏆 TalentTracker Admin Dashboard</h1>
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number">{len(users)}</div>
                        <div>Total Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" style="color: #3b82f6;">{athletes}</div>
                        <div>Athletes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" style="color: #22c55e;">{coaches_count}</div>
                        <div>Coaches</div>
                    </div>
                </div>
                
                <div class="info">
                    <p>Use the React Admin Dashboard at <a href="http://localhost:3000">http://localhost:3000</a></p>
                    <p><a href="/docs">API Documentation</a> | <a href="/api/health">Health Check</a></p>
                </div>
            </div>
        </body>
    </html>
    """
    
    return html_content


# ============================================================================
# RUN APPLICATION
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("Starting TalentTracker API...")
    print("=" * 50)
    print("API Docs: http://localhost:8000/docs")
    print("Health:   http://localhost:8000/api/health")
    print("Athletes: http://localhost:8000/api/admin/athletes")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)