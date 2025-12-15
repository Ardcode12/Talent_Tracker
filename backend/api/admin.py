# backend/api/admin.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import traceback

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "sport": user.sport,
            "phone": user.phone,
            "experience": user.experience,
            "specialization": user.specialization,
            "age": user.age,
            "location": user.location,
            "profile_image": user.profile_image,
            "ai_score": getattr(user, 'ai_score', None),
            "is_verified": getattr(user, 'is_verified', False),
            "created_at": user.created_at.isoformat() if hasattr(user, 'created_at') else None
        }
        for user in users
    ]

# Note: The HTML dashboard logic is duplicated in main.py for backward compatibility with 
# a direct /admin/dashboard route. If you want this router to be the sole source
# for the admin dashboard, ensure your frontend calls /api/admin/dashboard.
# If you remove the 'old_admin_dashboard' from main.py, you can use this route.
@router.get("/dashboard", response_class=HTMLResponse)
def admin_dashboard_api_route(db: Session = Depends(get_db)):
    """Admin dashboard HTML view (accessible via /api/admin/dashboard)"""
    try:
        users = db.query(models.User).all()
        athletes = sum(1 for user in users if user.role == 'athlete')
        coaches = sum(1 for user in users if user.role == 'coach')

        html_content = f"""
        <!DOCTYPE html>
        <html>
            <head><title>TalentTracker Admin Dashboard</title></head>
            <body>
                <h1>🏆 TalentTracker Admin Dashboard</h1> 
                <div>Total Users: {len(users)}</div>
                <div>Athletes: {athletes}</div>
                <div>Coaches: {coaches}</div>
                <table border="1" cellpadding="6" cellspacing="0">
                    <tr>
                        <th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Sport</th><th>Age</th><th>Location</th><th>AI Score</th>
                    </tr>
        """
        for user in users:
            html_content += f"<tr><td>{user.id}</td><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.sport}</td><td>{user.age or '-'}</td><td>{user.location or '-'}</td><td>{getattr(user, 'ai_score', '-') or '-'}</td></tr>"
        html_content += "</table></body></html>"
        return html_content
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to render admin dashboard")
