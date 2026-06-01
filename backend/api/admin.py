# backend/api/admin.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel
from database import get_db
import models
from core.security import get_password_hash, verify_password, create_access_token
from core.dependencies import get_image_url_with_fallback
import traceback

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ============================================================================
# PYDANTIC SCHEMAS FOR ADMIN
# ============================================================================

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class EventApprovalRequest(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None

class BenchmarkUpdate(BaseModel):
    benchmarks: dict

# ============================================================================
# ADMIN AUTHENTICATION
# ============================================================================

@router.post("/auth/login")
async def admin_login(
    credentials: AdminLoginRequest,
    db: Session = Depends(get_db)
):
    """Admin login endpoint"""
    try:
        admin = db.query(models.AdminUser).filter(
            models.AdminUser.email == credentials.email,
            models.AdminUser.is_active == True
        ).first()
        
        if not admin or not verify_password(credentials.password, admin.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Update last login
        admin.last_login = datetime.utcnow()
        db.commit()
        
        # Create token
        token = create_access_token(data={"sub": admin.email, "role": "admin"})
        
        return {
            "token": token,
            "admin": {
                "id": admin.id,
                "email": admin.email,
                "name": admin.name,
                "role": admin.role
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/create-admin")
async def create_admin(
    email: str = Body(...),
    password: str = Body(...),
    name: str = Body(...),
    secret_key: str = Body(...),
    db: Session = Depends(get_db)
):
    """Create admin user (requires secret key)"""
    if secret_key != "TALENT_TRACKER_ADMIN_SECRET_2024":
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    existing = db.query(models.AdminUser).filter(
        models.AdminUser.email == email
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    admin = models.AdminUser(
        email=email,
        password=get_password_hash(password),
        name=name,
        role="admin"
    )
    db.add(admin)
    db.commit()
    
    return {"message": "Admin created successfully"}

# ============================================================================
# DASHBOARD STATS
# ============================================================================

@router.get("/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get comprehensive dashboard statistics"""
    try:
        # User counts
        total_users = db.query(models.User).filter(models.User.is_active == True).count()
        total_athletes = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True
        ).count()
        total_coaches = db.query(models.User).filter(
            models.User.role == 'coach',
            models.User.is_active == True
        ).count()
        
        # Assessment counts
        total_assessments = db.query(models.Assessment).count()
        pending_assessments = db.query(models.Assessment).filter(
            models.Assessment.status == 'pending'
        ).count()
        
        # Average score
        avg_score = db.query(func.avg(models.Assessment.ai_score)).filter(
            models.Assessment.ai_score.isnot(None)
        ).scalar() or 0
        
        # Event counts
        try:
            pending_events = db.query(models.Event).filter(
                models.Event.approval_status == 'pending'
            ).count()
            total_events = db.query(models.Event).count()
        except:
            pending_events = 0
            total_events = 0
        
        # Recent activity (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        new_users_week = db.query(models.User).filter(
            models.User.created_at >= week_ago
        ).count()
        new_assessments_week = db.query(models.Assessment).filter(
            models.Assessment.created_at >= week_ago
        ).count()
        
        # Flagged assessments
        flagged_assessments = db.query(models.Assessment).filter(
            models.Assessment.ai_score > 95,
            models.Assessment.status == 'pending'
        ).count()
        
        return {
            "total_users": total_users,
            "total_athletes": total_athletes,
            "total_coaches": total_coaches,
            "total_assessments": total_assessments,
            "pending_assessments": pending_assessments,
            "average_score": round(avg_score, 1) if avg_score else 0,
            "pending_events": pending_events,
            "total_events": total_events,
            "flagged_assessments": flagged_assessments,
            "new_users_week": new_users_week,
            "new_assessments_week": new_assessments_week,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        print(f"Dashboard stats error: {e}")
        traceback.print_exc()
        return {
            "total_users": 0,
            "total_athletes": 0,
            "total_coaches": 0,
            "total_assessments": 0,
            "pending_assessments": 0,
            "average_score": 0,
            "pending_events": 0,
            "total_events": 0,
            "flagged_assessments": 0,
            "new_users_week": 0,
            "new_assessments_week": 0,
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }

# ============================================================================
# ATHLETE MANAGEMENT - FIXED VERSION
# ============================================================================

@router.get("/athletes")
async def get_athletes(
    search: str = Query(None),
    sport: str = Query(None),
    location: str = Query(None),
    min_score: float = Query(None, ge=0, le=100),
    max_score: float = Query(None, ge=0, le=100),
    verified_only: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db)
):
    """Get paginated list of athletes with filtering"""
    try:
        print(f"[Athletes] Fetching athletes - page={page}, limit={limit}, search={search}")
        
        # Base query
        query = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True
        )
        
        # Apply search filter
        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(
                or_(
                    func.lower(models.User.name).ilike(search_term),
                    func.lower(models.User.email).ilike(search_term),
                    func.lower(func.coalesce(models.User.location, '')).ilike(search_term)
                )
            )
        
        # Apply sport filter
        if sport:
            query = query.filter(models.User.sport == sport)
        
        # Apply location filter
        if location:
            query = query.filter(
                func.lower(func.coalesce(models.User.location, '')).ilike(f"%{location.lower()}%")
            )
        
        # Apply score filters
        if min_score is not None:
            query = query.filter(models.User.ai_score >= min_score)
        
        if max_score is not None:
            query = query.filter(models.User.ai_score <= max_score)
        
        # Apply verified filter
        if verified_only:
            query = query.filter(models.User.is_verified == True)
        
        # Get total count
        total = query.count()
        print(f"[Athletes] Total count: {total}")
        
        # Apply pagination and ordering - FIXED: proper nullslast syntax
        offset = (page - 1) * limit
        
        # Use COALESCE to handle NULL values in ordering instead of nullslast
        athletes = query.order_by(
            desc(func.coalesce(models.User.ai_score, 0))
        ).offset(offset).limit(limit).all()
        
        print(f"[Athletes] Fetched {len(athletes)} athletes")
        
        # Build response
        athletes_data = []
        for athlete in athletes:
            try:
                # Safely get profile photo URL
                photo_url = None
                if athlete.profile_photo:
                    if athlete.profile_photo.startswith('http'):
                        photo_url = athlete.profile_photo
                    elif athlete.profile_photo.startswith('/'):
                        photo_url = f"http://localhost:8000{athlete.profile_photo}"
                    else:
                        photo_url = f"http://localhost:8000/uploads/{athlete.profile_photo}"
                elif athlete.profile_image:
                    if athlete.profile_image.startswith('http'):
                        photo_url = athlete.profile_image
                    elif athlete.profile_image.startswith('/'):
                        photo_url = f"http://localhost:8000{athlete.profile_image}"
                    else:
                        photo_url = f"http://localhost:8000/uploads/{athlete.profile_image}"
                
                # Fallback to UI Avatars
                if not photo_url:
                    name = athlete.name or "Athlete"
                    photo_url = f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&background=6366f1&color=fff&size=128"
                
                athlete_dict = {
                    "id": athlete.id,
                    "name": athlete.name or "Unknown",
                    "email": athlete.email or "",
                    "sport": athlete.sport,
                    "location": athlete.location,
                    "age": athlete.age,
                    "ai_score": round(athlete.ai_score, 1) if athlete.ai_score else None,
                    "national_rank": athlete.national_rank,
                    "profile_photo": photo_url,
                    "is_verified": athlete.is_verified or False,
                    "is_online": athlete.is_online or False,
                    "created_at": athlete.created_at.isoformat() if athlete.created_at else None
                }
                athletes_data.append(athlete_dict)
            except Exception as e:
                print(f"[Athletes] Error processing athlete {athlete.id}: {e}")
                # Still add the athlete with minimal data
                athletes_data.append({
                    "id": athlete.id,
                    "name": athlete.name or "Unknown",
                    "email": athlete.email or "",
                    "sport": None,
                    "location": None,
                    "age": None,
                    "ai_score": None,
                    "national_rank": None,
                    "profile_photo": f"https://ui-avatars.com/api/?name={(athlete.name or 'A').replace(' ', '+')}&background=6366f1&color=fff",
                    "is_verified": False,
                    "is_online": False,
                    "created_at": None
                })
        
        response = {
            "data": athletes_data,
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit if total > 0 else 0
            }
        }
        
        print(f"[Athletes] Returning {len(athletes_data)} athletes")
        return response
        
    except Exception as e:
        print(f"[Athletes] ERROR: {e}")
        traceback.print_exc()
        # Return empty data instead of raising an error
        return {
            "data": [],
            "pagination": {
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0
            },
            "error": str(e)
        }

@router.get("/athletes/{athlete_id}")
async def get_athlete_detail(
    athlete_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed athlete information"""
    try:
        athlete = db.query(models.User).filter(
            models.User.id == athlete_id,
            models.User.role == 'athlete'
        ).first()
        
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Get assessments
        assessments = db.query(models.Assessment).filter(
            models.Assessment.user_id == athlete_id
        ).order_by(desc(models.Assessment.created_at)).limit(10).all()
        
        # Get posts count
        posts_count = db.query(models.Post).filter(
            models.Post.user_id == athlete_id
        ).count()
        
        # Get connections count - handle safely
        try:
            connections_count = db.query(models.connections).filter(
                or_(
                    models.connections.c.user_id == athlete_id,
                    models.connections.c.connected_user_id == athlete_id
                ),
                models.connections.c.status == 'accepted'
            ).count()
        except:
            connections_count = 0
        
        return {
            "athlete": {
                "id": athlete.id,
                "name": athlete.name,
                "email": athlete.email,
                "phone": athlete.phone,
                "sport": athlete.sport,
                "location": athlete.location,
                "age": athlete.age,
                "bio": athlete.bio,
                "height": athlete.height,
                "weight": athlete.weight,
                "achievements": athlete.achievements,
                "ai_score": round(athlete.ai_score, 1) if athlete.ai_score else None,
                "national_rank": athlete.national_rank,
                "profile_photo": get_image_url_with_fallback(
                    athlete.profile_photo or athlete.profile_image,
                    athlete.name
                ),
                "is_verified": athlete.is_verified,
                "is_online": athlete.is_online,
                "created_at": athlete.created_at.isoformat() if athlete.created_at else None
            },
            "stats": {
                "total_assessments": len(assessments),
                "posts_count": posts_count,
                "connections_count": connections_count
            },
            "recent_assessments": [
                {
                    "id": a.id,
                    "test_type": a.test_type,
                    "ai_score": a.ai_score,
                    "status": a.status,
                    "created_at": a.created_at.isoformat() if a.created_at else None
                }
                for a in assessments
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Athlete detail error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/athletes/{athlete_id}/verify")
async def verify_athlete(
    athlete_id: int,
    verified: bool = Body(...),
    db: Session = Depends(get_db)
):
    """Verify or unverify an athlete"""
    try:
        athlete = db.query(models.User).filter(
            models.User.id == athlete_id,
            models.User.role == 'athlete'
        ).first()
        
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        athlete.is_verified = verified
        db.commit()
        
        return {
            "message": f"Athlete {'verified' if verified else 'unverified'} successfully",
            "athlete_id": athlete_id,
            "is_verified": verified
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Verify athlete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/athletes/{athlete_id}")
async def deactivate_athlete(
    athlete_id: int,
    db: Session = Depends(get_db)
):
    """Deactivate an athlete account"""
    try:
        athlete = db.query(models.User).filter(
            models.User.id == athlete_id
        ).first()
        
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        athlete.is_active = False
        db.commit()
        
        return {"message": "Athlete deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Deactivate athlete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ASSESSMENT MANAGEMENT
# ============================================================================

@router.get("/assessments")
async def get_assessments(
    test_type: str = Query(None),
    status: str = Query(None),
    athlete_id: int = Query(None),
    min_score: float = Query(None),
    max_score: float = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db)
):
    """Get paginated list of assessments"""
    try:
        query = db.query(models.Assessment).join(
            models.User,
            models.Assessment.user_id == models.User.id
        )
        
        if test_type:
            query = query.filter(models.Assessment.test_type == test_type)
        
        if status:
            query = query.filter(models.Assessment.status == status)
        
        if athlete_id:
            query = query.filter(models.Assessment.user_id == athlete_id)
        
        if min_score is not None:
            query = query.filter(models.Assessment.ai_score >= min_score)
        
        if max_score is not None:
            query = query.filter(models.Assessment.ai_score <= max_score)
        
        total = query.count()
        offset = (page - 1) * limit
        assessments = query.order_by(desc(models.Assessment.created_at)).offset(offset).limit(limit).all()
        
        return {
            "data": [
                {
                    "id": a.id,
                    "user_id": a.user_id,
                    "athlete_name": a.user.name if a.user else "Unknown",
                    "athlete_photo": get_image_url_with_fallback(
                        a.user.profile_photo if a.user else None,
                        a.user.name if a.user else "User"
                    ),
                    "test_type": a.test_type,
                    "score": a.score,
                    "ai_score": round(a.ai_score, 1) if a.ai_score else None,
                    "ai_feedback": a.ai_feedback,
                    "status": a.status,
                    "video_url": a.video_url,
                    "created_at": a.created_at.isoformat() if a.created_at else None
                }
                for a in assessments
            ],
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit if total > 0 else 0
            }
        }
    except Exception as e:
        print(f"Assessments error: {e}")
        traceback.print_exc()
        return {
            "data": [],
            "pagination": {"total": 0, "page": page, "limit": limit, "pages": 0},
            "error": str(e)
        }

@router.get("/assessments/{assessment_id}")
async def get_assessment_detail(
    assessment_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed assessment information"""
    try:
        assessment = db.query(models.Assessment).filter(
            models.Assessment.id == assessment_id
        ).first()
        
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        athlete = assessment.user
        
        return {
            "assessment": {
                "id": assessment.id,
                "test_type": assessment.test_type,
                "score": assessment.score,
                "ai_score": assessment.ai_score,
                "ai_feedback": assessment.ai_feedback,
                "status": assessment.status,
                "video_url": assessment.video_url,
                "created_at": assessment.created_at.isoformat() if assessment.created_at else None
            },
            "athlete": {
                "id": athlete.id,
                "name": athlete.name,
                "email": athlete.email,
                "sport": athlete.sport,
                "profile_photo": get_image_url_with_fallback(
                    athlete.profile_photo,
                    athlete.name
                )
            } if athlete else None
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Assessment detail error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/assessments/{assessment_id}/verify")
async def verify_assessment(
    assessment_id: int,
    verified: bool = Body(...),
    feedback: str = Body(None),
    db: Session = Depends(get_db)
):
    """Verify or reject an assessment"""
    try:
        assessment = db.query(models.Assessment).filter(
            models.Assessment.id == assessment_id
        ).first()
        
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        assessment.status = "verified" if verified else "rejected"
        if feedback:
            assessment.ai_feedback = (assessment.ai_feedback or "") + f"\n\n[Admin Review]: {feedback}"
        
        db.commit()
        
        return {
            "message": f"Assessment {'verified' if verified else 'rejected'} successfully",
            "assessment": {
                "id": assessment.id,
                "status": assessment.status
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Verify assessment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# EVENT MANAGEMENT
# ============================================================================

@router.get("/events")
async def get_events(
    status: str = Query(None),
    event_type: str = Query(None),
    created_by: int = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db)
):
    """Get all events for admin review"""
    try:
        query = db.query(models.Event)
        
        if status:
            query = query.filter(models.Event.approval_status == status)
        
        if event_type:
            query = query.filter(models.Event.event_type == event_type)
        
        if created_by:
            query = query.filter(models.Event.created_by == created_by)
        
        total = query.count()
        offset = (page - 1) * limit
        events = query.order_by(desc(models.Event.created_at)).offset(offset).limit(limit).all()
        
        return {
            "data": [
                {
                    "id": event.id,
                    "title": event.title,
                    "description": event.description,
                    "event_type": event.event_type,
                    "sport": event.sport,
                    "location": event.location,
                    "venue": event.venue,
                    "is_online": event.is_online,
                    "start_date": event.start_date.isoformat() if event.start_date else None,
                    "end_date": event.end_date.isoformat() if event.end_date else None,
                    "max_participants": event.max_participants,
                    "current_participants": event.current_participants,
                    "approval_status": event.approval_status,
                    "status": event.status,
                    "is_featured": event.is_featured,
                    "creator": {
                        "id": event.creator.id,
                        "name": event.creator.name,
                        "email": event.creator.email,
                        "profile_photo": get_image_url_with_fallback(
                            event.creator.profile_photo,
                            event.creator.name
                        )
                    } if event.creator else None,
                    "created_at": event.created_at.isoformat() if event.created_at else None
                }
                for event in events
            ],
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit if total > 0 else 0
            },
            "stats": {
                "pending": db.query(models.Event).filter(models.Event.approval_status == 'pending').count(),
                "approved": db.query(models.Event).filter(models.Event.approval_status == 'approved').count(),
                "rejected": db.query(models.Event).filter(models.Event.approval_status == 'rejected').count()
            }
        }
    except Exception as e:
        print(f"Events error: {e}")
        return {
            "data": [],
            "pagination": {"total": 0, "page": 1, "limit": limit, "pages": 0},
            "stats": {"pending": 0, "approved": 0, "rejected": 0},
            "error": str(e)
        }

@router.put("/events/{event_id}/approve")
async def approve_event(
    event_id: int,
    approval: EventApprovalRequest,
    db: Session = Depends(get_db)
):
    """Approve or reject an event"""
    try:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        if approval.approved:
            event.approval_status = "approved"
            event.status = "approved"
            event.approved_at = datetime.utcnow()
            event.rejection_reason = None
            message = "Event approved successfully"
        else:
            event.approval_status = "rejected"
            event.status = "rejected"
            event.rejection_reason = approval.rejection_reason
            message = "Event rejected"
        
        db.commit()
        
        return {
            "message": message,
            "event": {
                "id": event.id,
                "title": event.title,
                "approval_status": event.approval_status
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Approve event error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/events/{event_id}/feature")
async def toggle_event_feature(
    event_id: int,
    featured: bool = Body(...),
    db: Session = Depends(get_db)
):
    """Toggle featured status of an event"""
    try:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event.is_featured = featured
        db.commit()
        
        return {
            "message": f"Event {'featured' if featured else 'unfeatured'} successfully",
            "event_id": event_id,
            "is_featured": featured
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Feature event error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ANALYTICS
# ============================================================================

@router.get("/analytics/talent-map")
async def get_talent_map(db: Session = Depends(get_db)):
    """Get talent distribution data"""
    try:
        # By location
        location_data = db.query(
            models.User.location,
            func.count(models.User.id).label('count'),
            func.avg(models.User.ai_score).label('avg_score')
        ).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.location.isnot(None),
            models.User.location != ''
        ).group_by(models.User.location).order_by(desc('count')).limit(20).all()
        
        # By sport
        sport_data = db.query(
            models.User.sport,
            func.count(models.User.id).label('count'),
            func.avg(models.User.ai_score).label('avg_score')
        ).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.sport.isnot(None),
            models.User.sport != ''
        ).group_by(models.User.sport).order_by(desc('count')).limit(15).all()
        
        # By age groups
        age_groups = []
        for min_age, max_age, label in [(0, 18, 'Under 18'), (18, 25, '18-25'), (25, 35, '25-35'), (35, 100, '35+')]:
            count = db.query(models.User).filter(
                models.User.role == 'athlete',
                models.User.is_active == True,
                models.User.age >= min_age,
                models.User.age < max_age
            ).count()
            age_groups.append({"label": label, "count": count})
        
        return {
            "regional_distribution": [
                {
                    "location": item.location,
                    "count": item.count,
                    "avg_score": round(item.avg_score, 1) if item.avg_score else 0
                }
                for item in location_data
            ],
            "sport_distribution": [
                {
                    "sport": item.sport,
                    "count": item.count,
                    "avg_score": round(item.avg_score, 1) if item.avg_score else 0
                }
                for item in sport_data
            ],
            "age_distribution": age_groups
        }
    except Exception as e:
        print(f"Talent map error: {e}")
        return {
            "regional_distribution": [],
            "sport_distribution": [],
            "age_distribution": []
        }

@router.get("/analytics/performance-trends")
async def get_performance_trends(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Get performance trends over time"""
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Daily trends
        daily_trends = db.query(
            func.date(models.Assessment.created_at).label('date'),
            func.avg(models.Assessment.ai_score).label('avg_score'),
            func.count(models.Assessment.id).label('count')
        ).filter(
            models.Assessment.created_at >= cutoff,
            models.Assessment.ai_score.isnot(None)
        ).group_by(func.date(models.Assessment.created_at)).order_by('date').all()
        
        return {
            "trends": [
                {
                    "date": str(item.date),
                    "avg_score": round(item.avg_score, 1) if item.avg_score else 0,
                    "count": item.count
                }
                for item in daily_trends
            ],
            "top_improving": []
        }
    except Exception as e:
        print(f"Performance trends error: {e}")
        return {"trends": [], "top_improving": []}

# ============================================================================
# SETTINGS
# ============================================================================

@router.get("/settings/benchmarks")
async def get_benchmarks(db: Session = Depends(get_db)):
    """Get current benchmark settings"""
    return {
        "benchmarks": {
            "shuttle_run": {"beginner": 50, "intermediate": 70, "advanced": 85, "elite": 95},
            "vertical_jump": {"beginner": 40, "intermediate": 60, "advanced": 80, "elite": 90},
            "squats": {"beginner": 30, "intermediate": 50, "advanced": 70, "elite": 85}
        }
    }

@router.put("/settings/benchmarks")
async def update_benchmarks(
    data: BenchmarkUpdate,
    db: Session = Depends(get_db)
):
    """Update benchmark settings"""
    return {
        "message": "Benchmarks updated successfully",
        "benchmarks": data.benchmarks
    }

@router.get("/settings/usage-stats")
async def get_usage_stats(db: Session = Depends(get_db)):
    """Get system usage statistics"""
    try:
        total_users = db.query(models.User).count()
        
        month_ago = datetime.utcnow() - timedelta(days=30)
        active_users = db.query(models.User).filter(
            or_(
                models.User.last_seen >= month_ago,
                models.User.updated_at >= month_ago
            )
        ).count()
        
        total_assessments = db.query(models.Assessment).count()
        
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_assessments = db.query(models.Assessment).filter(
            models.Assessment.created_at >= week_ago
        ).count()
        
        total_posts = db.query(models.Post).count()
        total_messages = db.query(models.Message).count()
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "total_assessments": total_assessments,
            "recent_assessments": recent_assessments,
            "total_posts": total_posts,
            "total_messages": total_messages,
            "version_distribution": {
                "android": {"latest": 75, "outdated": 25},
                "ios": {"latest": 80, "outdated": 20}
            }
        }
    except Exception as e:
        print(f"Usage stats error: {e}")
        return {
            "total_users": 0,
            "active_users": 0,
            "total_assessments": 0,
            "recent_assessments": 0,
            "total_posts": 0,
            "total_messages": 0
        }

# ============================================================================
# COACHES MANAGEMENT
# ============================================================================

# ============================================================================
# COACHES MANAGEMENT - FIXED VERSION
# ============================================================================

@router.get("/coaches")
async def get_coaches(
    search: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db)
):
    """Get list of coaches"""
    try:
        query = db.query(models.User).filter(
            models.User.role == 'coach',
            models.User.is_active == True
        )
        
        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(
                or_(
                    func.lower(models.User.name).ilike(search_term),
                    func.lower(models.User.email).ilike(search_term),
                    func.lower(func.coalesce(models.User.specialization, '')).ilike(search_term)
                )
            )
        
        total = query.count()
        offset = (page - 1) * limit
        coaches = query.order_by(desc(models.User.created_at)).offset(offset).limit(limit).all()
        
        result = []
        for coach in coaches:
            try:
                # Safely get profile photo URL
                photo_url = None
                if coach.profile_photo:
                    if coach.profile_photo.startswith('http'):
                        photo_url = coach.profile_photo
                    elif coach.profile_photo.startswith('/'):
                        photo_url = f"http://localhost:8000{coach.profile_photo}"
                    else:
                        photo_url = f"http://localhost:8000/uploads/{coach.profile_photo}"
                
                if not photo_url:
                    name = coach.name or "Coach"
                    photo_url = f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&background=6366f1&color=fff&size=128"
                
                # Count connected athletes - safely
                connections_count = 0
                try:
                    connections_count = db.query(models.connections).filter(
                        or_(
                            models.connections.c.user_id == coach.id,
                            models.connections.c.connected_user_id == coach.id
                        ),
                        models.connections.c.status == 'accepted'
                    ).count()
                except Exception as conn_error:
                    print(f"Connection count error for coach {coach.id}: {conn_error}")
                
                # Count events created - safely
                events_count = 0
                try:
                    events_count = db.query(models.Event).filter(
                        models.Event.created_by == coach.id
                    ).count()
                except Exception as event_error:
                    print(f"Event count error for coach {coach.id}: {event_error}")
                
                result.append({
                    "id": coach.id,
                    "name": coach.name,
                    "email": coach.email,
                    "phone": coach.phone,
                    "specialization": coach.specialization or coach.sport,
                    "experience": coach.experience,
                    "location": coach.location,
                    "profile_photo": photo_url,
                    "is_verified": coach.is_verified or False,
                    "connected_athletes": connections_count,
                    "events_created": events_count,
                    "created_at": coach.created_at.isoformat() if coach.created_at else None
                })
            except Exception as e:
                print(f"Error processing coach {coach.id}: {e}")
                continue
        
        return {
            "data": result,
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit if total > 0 else 0
            }
        }
    except Exception as e:
        print(f"Coaches error: {e}")
        traceback.print_exc()
        return {
            "data": [],
            "pagination": {"total": 0, "page": page, "limit": limit, "pages": 0},
            "error": str(e)
        }