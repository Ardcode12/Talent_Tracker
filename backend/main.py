# backend/main.py
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text
from typing import List, Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import shutil
from pathlib import Path
import traceback
import random  # Add this import


# Import your modules
try:
    import models
    import schemas
    import crud
    from database import get_db, engine
    from models import User
except ImportError as e:
    print(f"Import error: {e}")
    raise

# Create tables
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Database initialization error: {e}")

# Create FastAPI app
app = FastAPI(title="TalentTracker API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = "your-secret-key-here"  # Change this to a secure secret key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "posts").mkdir(exist_ok=True)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from JWT token"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user from JWT token if provided, otherwise return None"""
    if not credentials:
        return None
    
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None

# Root endpoint
@app.get("/")
def root():
    return {
        "message": "Welcome to TalentTracker API",
        "endpoints": {
            "api_docs": "http://localhost:8000/docs",
            "admin_dashboard": "http://localhost:8000/admin/dashboard",
            "users_json": "http://localhost:8000/api/admin/users"
        }
    }

# Health check
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # Try to execute a simple query
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        return {"status": "unhealthy", "database": "error", "detail": str(e)}

# Auth endpoints
@app.post("/api/auth/signup", response_model=schemas.AuthResponse)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = crud.create_user(db=db, user=user)
    access_token = create_access_token(data={"sub": db_user.email})
    return {"token": access_token, "user": db_user}   # will return UserProfile


@app.post("/api/auth/login", response_model=schemas.AuthResponse)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token = create_access_token(data={"sub": user.email})
    return {"token": access_token, "user": user}      # will return UserProfile
@app.get("/api/users/me", response_model=schemas.UserProfile)   # ✅ full profile instead of schemas.User
def get_current_user_endpoint(current_user: User = Depends(get_current_user)):
    return current_user

# Admin endpoints
@app.get("/api/admin/users")
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
            "profile_image": user.profile_image
        }
        for user in users
    ]

# Assessment endpoints
@app.post("/api/assessments")
async def create_assessment(
    test_type: str = Form(...),
    video: Optional[UploadFile] = File(None),
    score: Optional[float] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        video_url = None
        if video and video.filename:
            # Save video
            video_filename = f"assessment_{current_user.id}_{datetime.now().timestamp()}_{video.filename}"
            video_path = UPLOAD_DIR / "assessments" / video_filename
            video_path.parent.mkdir(exist_ok=True)
            
            with open(video_path, "wb") as buffer:
                shutil.copyfileobj(video.file, buffer)
            
            video_url = f"/uploads/assessments/{video_filename}"
        
        # Simulate AI scoring (replace with actual ML model later)
        ai_score = 75 + (25 * random.random())  # Random score between 75-100
        
        # Generate feedback based on test type
        feedback_map = {
            "shuttle_run": f"Good agility! Your time suggests {'excellent' if ai_score > 90 else 'good'} directional change ability.",
            "vertical_jump": f"Jump height indicates {'outstanding' if ai_score > 85 else 'solid'} explosive power.",
            "squats": f"Form analysis shows {'excellent' if ai_score > 88 else 'good'} technique and depth.",
            "plank": f"Core strength is {'exceptional' if ai_score > 92 else 'strong'}. Keep it up!"
        }
        
        assessment = models.Assessment(
            user_id=current_user.id,
            test_type=test_type,
            video_url=video_url,
            score=score or ai_score,
            ai_score=ai_score,
            feedback=feedback_map.get(test_type, "Good performance! Keep training."),
            status="completed"
        )
        
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
        
        return {
            "id": assessment.id,
            "test_type": assessment.test_type,
            "score": assessment.score,
            "ai_score": assessment.ai_score,
            "feedback": assessment.feedback,
            "status": assessment.status,
            "created_at": assessment.created_at.isoformat()
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/assessments")
async def get_assessments(
    test_type: Optional[str] = None,
    limit: int = Query(20, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Assessment).filter(models.Assessment.user_id == current_user.id)
    
    if test_type:
        query = query.filter(models.Assessment.test_type == test_type)
    
    assessments = query.order_by(models.Assessment.created_at.desc()).limit(limit).all()
    
    return {
        "data": [
            {
                "id": a.id,
                "test_type": a.test_type,
                "score": a.score,
                "ai_score": a.ai_score,
                "feedback": a.feedback,
                "status": a.status,
                "video_url": a.video_url,
                "created_at": a.created_at.isoformat()
            }
            for a in assessments
        ]
    }

@app.get("/api/assessments/stats")
async def get_assessment_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stats = db.query(
        models.Assessment.test_type,
        func.count(models.Assessment.id).label('count'),
        func.avg(models.Assessment.ai_score).label('avg_score')
    ).filter(
        models.Assessment.user_id == current_user.id
    ).group_by(
        models.Assessment.test_type
    ).all()

    total_count = sum(s.count for s in stats)
    average_score = (
        sum((s.avg_score or 0) * s.count for s in stats) / total_count
        if total_count > 0 else 0
    )

    return {
        "total_assessments": total_count,
        "average_score": round(average_score, 1),
        "by_test_type": {
            s.test_type: {
                "count": s.count,
                "average_score": round(s.avg_score or 0, 1)
            }
            for s in stats
        }
    }


@app.get("/admin/dashboard", response_class=HTMLResponse)
def admin_dashboard(db: Session = Depends(get_db)):
    """View users in a nice HTML table"""
    users = db.query(models.User).all()
    
    # Count users by role
    athletes = sum(1 for user in users if user.role == 'athlete')
    coaches = sum(1 for user in users if user.role == 'coach')
    
    html_content = f"""
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
                    </tr>
    """
    
    for user in users:
        role_class = 'athlete' if user.role == 'athlete' else 'coach'
        sport_info = user.sport or user.specialization or '<span class="empty">Not specified</span>'
        experience_info = f"{user.experience} years" if user.experience else '<span class="empty">-</span>'
        phone_info = user.phone or '<span class="empty">Not provided</span>'
        age_info = f"{user.age} years" if user.age else '<span class="empty">-</span>'
        location_info = user.location or '<span class="empty">Not specified</span>'
        
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
                    </tr>
        """
    
    html_content += """
                </table>
            </div>
        </body>
    </html>
    """
    
    return html_content

# Profile update endpoint with better error handling and file type detection
@app.put("/api/users/profile")
async def update_profile(
    age: int = Form(...),
    location: str = Form(...),
    userId: int = Form(...),
    bio: str = Form(None),
    height: str = Form(None),
    weight: str = Form(None),
    achievements: str = Form(None),   # JSON string
    skills: str = Form(None),         # JSON string
    profileImage: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    try:
        user = db.query(models.User).filter(models.User.id == userId).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"User with id {userId} not found")

        # Basic fields
        user.age = age
        user.location = location.strip()
        if bio: user.bio = bio.strip()
        if height: user.height = height.strip()
        if weight: user.weight = weight.strip()

        # Achievements (stored as JSON string)
        if achievements:
            user.achievements = achievements

        # Skills (optional future table or JSON storage)
        if skills:
            user.skills = skills  # If you don’t have "skills" column, add Text column

        # Handle profile image upload (same as existing code)
        image_url = None
        if profileImage and profileImage.filename:
            extension = profileImage.filename.split(".")[-1].lower()
            if extension == "jpeg": extension = "jpg"
            file_name = f"profile_{userId}_{datetime.now().timestamp()}.{extension}"
            file_path = UPLOAD_DIR / file_name
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(profileImage.file, buffer)
            image_url = f"/uploads/{file_name}"
            user.profile_image = image_url
            user.profile_photo = image_url

        db.commit()
        db.refresh(user)

        return {
            "message": "Profile updated successfully",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "age": user.age,
                "location": user.location,
                "bio": user.bio,
                "height": user.height,
                "weight": user.weight,
                "achievements": user.achievements,
                "skills": user.skills,
                "profile_image": user.profile_image,
                "profile_photo": user.profile_photo,
                "role": user.role,
                "sport": user.sport,
                "phone": user.phone,
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
# Test endpoint to debug FormData
@app.post("/api/test/formdata")
async def test_formdata(
    request: Request,
    age: int = Form(None),
    location: str = Form(None),
    userId: int = Form(None)
):
    # Get raw form data
    form_data = await request.form()
    
    print("\n=== Test FormData Endpoint ===")
    print("Raw form data:")
    for key, value in form_data.items():
        print(f"  {key}: {value} (type: {type(value)})")
    
    print("\nParsed values:")
    print(f"  age: {age} (type: {type(age) if age else 'None'})")
    print(f"  location: {location} (type: {type(location) if location else 'None'})")
    print(f"  userId: {userId} (type: {type(userId) if userId else 'None'})")
    
    return {
        "raw_data": dict(form_data),
        "parsed": {
            "age": age,
            "location": location,
            "userId": userId
        }
    }

# Feed endpoints
@app.get("/api/posts/feed")
async def get_feed_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(10, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    offset = (page - 1) * limit
    
    # Check if Post model exists
    if not hasattr(models, 'Post'):
        return {
            "data": [],
            "total": 0,
            "page": page,
            "limit": limit
        }
    
    posts = db.query(models.Post)\
        .options(joinedload(models.Post.user))\
        .order_by(models.Post.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()
    
    formatted_posts = []
    for post in posts:
        is_liked = db.query(models.post_likes).filter(
            models.post_likes.c.user_id == current_user.id,
            models.post_likes.c.post_id == post.id
        ).first() is not None
        
        formatted_posts.append({
            "id": str(post.id),
            "user": {
                "id": str(post.user.id),
                "name": post.user.name,
                "profile_photo": post.user.profile_photo,
                "sport": post.user.sport,
                "location": post.user.location
            },
            "content": {
                "text": post.text,
                "media_url": post.media_url,
                "media_type": post.media_type
            },
            "is_ai_verified": post.is_ai_verified,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "shares_count": post.shares_count,
            "is_liked": is_liked,
            "created_at": post.created_at.isoformat()
        })
    
    total = db.query(models.Post).count()
    
    return {
        "data": formatted_posts,
        "total": total,
        "page": page,
        "limit": limit
    }

@app.post("/api/posts")
async def create_post(
    text: str = Form(...),
    media: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Add logging
    print(f"\n=== Create Post Request ===")
    print(f"User: {current_user.name} (ID: {current_user.id})")
    print(f"Text: '{text}'")
    print(f"Text length: {len(text)}")
    print(f"Text stripped length: {len(text.strip())}")
    print(f"Media: {media.filename if media else 'None'}")
    
    # Validate text
    if not text or len(text.strip()) == 0:
        raise HTTPException(
            status_code=422,
            detail="Post text is required and cannot be empty"
        )
    
    if not hasattr(models, 'Post'):
        raise HTTPException(status_code=501, detail="Posts feature not implemented yet")
    
    media_url = None
    media_type = None
    
    if media:
        # Save media file
        media_filename = f"{current_user.id}_{datetime.now().timestamp()}_{media.filename}"
        media_path = UPLOAD_DIR / "posts" / media_filename
        
        with open(media_path, "wb") as buffer:
            shutil.copyfileobj(media.file, buffer)
        
        media_url = f"/uploads/posts/{media_filename}"
        media_type = "image" if media.content_type.startswith("image") else "video"
    
    # Create post
    post = models.Post(
        user_id=current_user.id,
        text=text.strip(),  # Make sure to strip whitespace
        media_url=media_url,
        media_type=media_type,
        is_ai_verified=False  # TODO: Implement AI verification
    )
    
    db.add(post)
    db.commit()
    db.refresh(post)
    
    print(f"Post created successfully with ID: {post.id}")
    
    return {"message": "Post created successfully", "post_id": post.id}

@app.post("/api/posts/{post_id}/like")
async def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not hasattr(models, 'Post'):
        raise HTTPException(status_code=501, detail="Posts feature not implemented yet")
    
    # Check if post exists
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already liked
    existing_like = db.query(models.post_likes).filter(
        models.post_likes.c.user_id == current_user.id,
        models.post_likes.c.post_id == post_id
    ).first()
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked")
    
    # Add like
    stmt = models.post_likes.insert().values(user_id=current_user.id, post_id=post_id)
    db.execute(stmt)
    
    # Update likes count
    post.likes_count += 1
    
    db.commit()
    
    return {"message": "Post liked successfully"}

@app.delete("/api/posts/{post_id}/unlike")
async def unlike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not hasattr(models, 'Post'):
        raise HTTPException(status_code=501, detail="Posts feature not implemented yet")
    
    # Check if post exists
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Remove like
    stmt = models.post_likes.delete().where(
        models.post_likes.c.user_id == current_user.id,
        models.post_likes.c.post_id == post_id
    )
    result = db.execute(stmt)
    
    if result.rowcount == 0:
        raise HTTPException(status_code=400, detail="Not liked")
    
    # Update likes count
    post.likes_count = max(0, post.likes_count - 1)
    
    db.commit()
    
    return {"message": "Post unliked successfully"}

# User stats
@app.get("/api/users/stats")
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return {
        "data": {
            "name": current_user.name,
            "profilePhoto": getattr(current_user, 'profile_photo', None) or getattr(current_user, 'profile_image', None),
            "nationalRank": getattr(current_user, 'national_rank', None),
            "aiScore": getattr(current_user, 'ai_score', None),
            "weeklyProgress": getattr(current_user, 'weekly_progress', 0) or 0
        }
    }

# PUBLIC ENDPOINTS (No authentication required)

# Trending athletes - PUBLIC
@app.get("/api/athletes/trending")
async def get_trending_athletes(db: Session = Depends(get_db)):
    """Public endpoint - no authentication required"""
    athletes = db.query(models.User)\
        .filter(models.User.role == 'athlete')\
        .limit(10)\
        .all()
    
    formatted_athletes = []
    for athlete in athletes:
        ai_score = getattr(athlete, 'ai_score', None)
        national_rank = getattr(athlete, 'national_rank', None)
        
        highlight_stat = f"AI Score: {ai_score}%" if ai_score else "Rising Star"
        badge = "🏆 Top Athlete" if national_rank and national_rank <= 10 else "⭐ Trending"
        
        formatted_athletes.append({
            "id": str(athlete.id),
            "name": athlete.name,
            "profile_photo": getattr(athlete, 'profile_photo', None) or getattr(athlete, 'profile_image', None),
            "sport": athlete.sport,
            "highlight_stat": highlight_stat,
            "badge": badge
        })
    
    return {"data": formatted_athletes}

# Announcements - PUBLIC
@app.get("/api/announcements")
async def get_announcements(db: Session = Depends(get_db)):
    """Public endpoint - no authentication required"""
    try:
        if hasattr(models, 'Announcement'):
            announcements = db.query(models.Announcement)\
                .filter(models.Announcement.is_active == True)\
                .order_by(models.Announcement.priority.desc())\
                .limit(5)\
                .all()
            
            formatted_announcements = []
            for ann in announcements:
                formatted_announcements.append({
                    "id": str(ann.id),
                    "title": ann.title,
                    "description": ann.description,
                    "icon": ann.icon,
                    "link": ann.link
                })
            
            return {"data": formatted_announcements}
    except Exception as e:
        print(f"Error fetching announcements: {e}")
    
    # Return default announcements if table doesn't exist or error occurs
    return {
        "data": [
            {
                "id": "1",
                "title": "Upcoming National Selection Trials – Register Now!",
                "description": "National trials for athletics starting next month",
                "icon": "🏅",
                "link": None
            },
            {
                "id": "2",
                "title": "Scholarships open for rural athletes",
                "description": "Apply for sports scholarships before month end",
                "icon": "🎓",
                "link": None
            },
            {
                "id": "3",
                "title": "State Championship registrations closing soon!",
                "description": "Last date to register is next week",
                "icon": "🏆",
                "link": None
            },
            {
                "id": "4",
                "title": "New AI Assessment feature launched!",
                "description": "Try our latest AI-powered performance assessment",
                "icon": "📱",
                "link": None
            }
        ]
    }

# Connection suggestions
@app.get("/api/connections/suggestions")
async def get_connection_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if hasattr(models, 'connections'):
        # Get users not connected to current user
        connected_ids = db.query(models.connections.c.connected_user_id)\
            .filter(models.connections.c.user_id == current_user.id)\
            .subquery()
        
        suggestions = db.query(models.User)\
            .filter(
                models.User.id != current_user.id,
                ~models.User.id.in_(connected_ids),
                models.User.role == 'athlete'
            )\
            .order_by(func.random())\
            .limit(6)\
            .all()
    else:
        # If connections table doesn't exist, just get random users
        suggestions = db.query(models.User)\
            .filter(
                models.User.id != current_user.id,
                models.User.role == 'athlete'
            )\
            .order_by(func.random())\
            .limit(6)\
            .all()
    
    formatted_suggestions = []
    for user in suggestions:
        formatted_suggestions.append({
            "id": str(user.id),
            "name": user.name,
            "profile_photo": getattr(user, 'profile_photo', None) or getattr(user, 'profile_image', None),
            "sport": user.sport,
            "location": user.location,
            "is_online": getattr(user, 'is_online', False)
        })
    
    return {"data": formatted_suggestions}

@app.post("/api/connections/request/{user_id}")
async def send_connection_request(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")
    
    if hasattr(models, 'connections'):
        # Check if connection already exists
        existing = db.query(models.connections).filter(
            models.connections.c.user_id == current_user.id,
            models.connections.c.connected_user_id == user_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Connection already exists")
        
        # Create connection request
        stmt = models.connections.insert().values(
            user_id=current_user.id,
            connected_user_id=user_id,
            status='pending'
        )
        db.execute(stmt)
        db.commit()
    
    return {"message": "Connection request sent"}

# Performance data
@app.get("/api/users/performance")
async def get_performance_data(
    period: str = Query("week", regex="^(week|month|year)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if hasattr(models, 'PerformanceData'):
        # Calculate date range
        end_date = datetime.now()
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        else:
            start_date = end_date - timedelta(days=365)
        
        performance_data = db.query(models.PerformanceData)\
            .filter(
                models.PerformanceData.user_id == current_user.id,
                models.PerformanceData.recorded_at >= start_date
            )\
            .order_by(models.PerformanceData.recorded_at)\
            .all()
        
        formatted_data = []
        for data in performance_data:
            formatted_data.append({
                "metric_type": data.metric_type,
                "value": data.value,
                "unit": data.unit,
                "recorded_at": data.recorded_at.isoformat()
            })
        
        return {"data": formatted_data}
    
    return {"data": []}

# Comments
@app.get("/api/posts/{post_id}/comments")
async def get_comments(
    post_id: int,
    db: Session = Depends(get_db)
):
    if not hasattr(models, 'Comment'):
        return {"data": []}
    
    comments = db.query(models.Comment)\
        .filter(models.Comment.post_id == post_id)\
        .options(joinedload(models.Comment.user))\
        .order_by(models.Comment.created_at.desc())\
        .all()
    
    formatted_comments = []
    for comment in comments:
        formatted_comments.append({
            "id": str(comment.id),
            "user": {
                "id": str(comment.user.id),
                "name": comment.user.name,
                "profile_photo": getattr(comment.user, 'profile_photo', None) or getattr(comment.user, 'profile_image', None)
            },
            "text": comment.text,
            "created_at": comment.created_at.isoformat()
        })
    
    return {"data": formatted_comments}

@app.post("/api/posts/{post_id}/comments")
async def add_comment(
    post_id: int,
    text: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not hasattr(models, 'Comment') or not hasattr(models, 'Post'):
        raise HTTPException(status_code=501, detail="Comments feature not implemented yet")
    
    # Check if post exists
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Create comment
    comment = models.Comment(
        post_id=post_id,
        user_id=current_user.id,
        text=text
    )
    
    db.add(comment)
    
    # Update comment count
    post.comments_count += 1
    
    db.commit()
    db.refresh(comment)
    
    return {"message": "Comment added successfully", "comment_id": comment.id}

# Mount static files at the end
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Make sure the app is accessible
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
