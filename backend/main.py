# backend/main.py
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
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

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Database initialization (commented out drop_all)
# print("Attempting database schema creation/update...")
# try:
#     # Ensure models.Base.metadata.drop_all is COMMENTED OUT or REMOVED
#     # The database has been manually wiped. Now just create.
#     # models.Base.metadata.drop_all(bind=engine) # <--- THIS LINE MUST BE COMMENTED OUT or REMOVED
#     models.Base.metadata.create_all(bind=engine) # <--- THIS LINE MUST BE UNCOMMENTED
#     print("Database tables created/updated successfully.")
# except Exception as e:
#     print(f"Database initialization error: {e}")
#     print(traceback.format_exc()) # Print full traceback to console
#     raise e # Re-raise the exception to clearly show it in Uvicorn logs

# Create FastAPI app
app = FastAPI(title="TalentTracker API", version="1.0.0")

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000",
        "http://127.0.0.1:8081",
        "*"  # Allow all origins during development
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include API routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assessments.router)
app.include_router(connections.router)
app.include_router(posts.router)
app.include_router(coaches.router)
app.include_router(messaging.router)
app.include_router(admin.router)
app.include_router(message_ws.router)
app.include_router(notifications.router)  # ADD
app.include_router(search.router)         # ADD
app.include_router(rankings.router)       # ADD

# ===========================
# General / Root Endpoints
# ===========================

@app.get("/")
def root():
    return {
        "message": "Welcome to TalentTracker API",
        "endpoints": {
            "api_docs": "/docs",
            "admin_dashboard": "/api/admin/dashboard",
            "health_check": "/api/health"
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

# The /admin/dashboard HTML endpoint (from your old main.py)
# Keep this if you want a separate HTML route, otherwise remove it and rely on /api/admin/dashboard
@app.get("/admin/dashboard", response_class=HTMLResponse)
def old_admin_dashboard(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    athletes = sum(1 for user in users if user.role == 'athlete')
    coaches = sum(1 for user in users if user.role == 'coach')
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
        <head>
            <title>TalentTracker Admin Dashboard</title>
            <style>
                body {{ 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    background-color: #f5f5f5; 
                }}
                .container {{
                    max-width: 1200px;
                    margin: 0 auto;
                }}
                h1 {{ 
                    color: #333; 
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
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    text-align: center;
                }}
                .stat-number {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #4CAF50;
                }}
                table {{ 
                    border-collapse: collapse; 
                    width: 100%; 
                    background-color: white; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    border-radius: 10px;
                    overflow: hidden;
                }}
                th, td {{ 
                    border: 1px solid #ddd; 
                    padding: 12px; 
                    text-align: left; 
                }}
                th {{ 
                    background-color: #4CAF50; 
                    color: white; 
                    font-weight: bold;
                }}
                tr:nth-child(even) {{ 
                    background-color: #f2f2f2; 
                }}
                tr:hover {{
                    background-color: #e8f5e9;
                }}
                .athlete {{ 
                    color: #2196F3; 
                    font-weight: bold; 
                }}
                .coach {{ 
                    color: #FF9800; 
                    font-weight: bold; 
                }}
                .empty {{
                    color: #999;
                }}
                .profile-img {{
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    object-fit: cover;
                }}
                .verified {{
                    color: #4CAF50;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>ðŸ† TalentTracker Admin Dashboard</h1> 
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number">{len(users)}</div>
                        <div>Total Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" style="color: #2196F3;">{athletes}</div>
                        <div>Athletes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" style="color: #FF9800;">{coaches}</div>
                        <div>Coaches</div>
                    </div>
                </div>
                
                <table>
                    <tr>
                        <th>ID</th>
                        <th>Profile</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Sport/Specialization</th>
                        <th>Age</th>
                        <th>Location</th>
                        <th>Phone</th>
                        <th>Experience</th>
                        <th>AI Score</th>
                        <th>Verified</th>
                    </tr>
    """
    
    for user in users:
        role_class = 'athlete' if user.role == 'athlete' else 'coach'
        sport_info = user.sport or user.specialization or '<span class="empty">Not specified</span>'
        experience_info = f"{user.experience} years" if user.experience else '<span class="empty">-</span>'
        phone_info = user.phone or '<span class="empty">Not provided</span>'
        age_info = f"{user.age} years" if user.age else '<span class="empty">-</span>'
        location_info = user.location or '<span class="empty">Not specified</span>'
        ai_score = getattr(user, 'ai_score', None)
        ai_score_info = f"{ai_score}%" if ai_score else '<span class="empty">-</span>'
        is_verified = getattr(user, 'is_verified', False)
        verified_info = '<span class="verified">âœ“</span>' if is_verified else '<span class="empty">âœ—</span>'
        
        profile_img_html = '<span class="empty">No photo</span>'
        if user.profile_image:
            profile_img_html = f'<img src="{user.profile_image}" class="profile-img" alt="Profile" onerror="this.style.display=\'none\'">'
        
        html_content += f"""
                    <tr>
                        <td>{user.id}</td>
                        <td>{profile_img_html}</td>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td class="{role_class}">{user.role.upper() if user.role else 'USER'}</td>
                        <td>{sport_info}</td>
                        <td>{age_info}</td>
                        <td>{location_info}</td>
                        <td>{phone_info}</td>
                        <td>{experience_info}</td>
                        <td>{ai_score_info}</td>
                        <td>{verified_info}</td>
                    </tr>
        """
    
    html_content += """
                </table>
            </div>
        </body>
    </html>
    """
    
    return html_content


# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)