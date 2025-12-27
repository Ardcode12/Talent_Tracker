# backend/api/coaches.py
from fastapi import APIRouter, Depends, HTTPException, Query, Form, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from database import get_db
from core.dependencies import get_current_user, get_image_url, get_image_url_with_fallback
from core.config import UPLOAD_DIR
import models
from sqlalchemy import or_ as db_or, and_ as db_and, func
import traceback
import shutil
from datetime import datetime
from pathlib import Path

router = APIRouter(prefix="/api/coach", tags=["coach"])


# ============================================================================
# GET COACH ATHLETES
# ============================================================================
@router.get("/athletes")
async def get_coach_athletes(
    search: Optional[str] = Query(None),
    sport: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all athletes with optional search and filtering"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    query = db.query(models.User).filter(
        models.User.role == 'athlete',
        models.User.is_active == True
    )
    
    if search:
        query = query.filter(
            db_or(
                models.User.name.ilike(f'%{search}%'),
                models.User.sport.ilike(f'%{search}%'),
                models.User.location.ilike(f'%{search}%')
            )
        )
    
    if sport:
        query = query.filter(models.User.sport == sport)
    
    total_count = query.count()
    
    offset = (page - 1) * limit
    athletes = query.offset(offset).limit(limit).all()
    
    formatted_athletes = []
    for athlete in athletes:
        # Check connection status
        connection = db.query(models.connections).filter(
            db_or(
                db_and(
                    models.connections.c.user_id == current_user.id,
                    models.connections.c.connected_user_id == athlete.id
                ),
                db_and(
                    models.connections.c.user_id == athlete.id,
                    models.connections.c.connected_user_id == current_user.id
                )
            )
        ).first()
        
        # Get latest assessment
        latest_assessment = db.query(models.Assessment).filter(
            models.Assessment.user_id == athlete.id
        ).order_by(models.Assessment.created_at.desc()).first()
        
        formatted_athletes.append({
            "id": athlete.id,
            "name": athlete.name,
            "email": athlete.email,
            "profile_photo": get_image_url_with_fallback(
                athlete.profile_photo or athlete.profile_image,
                athlete.name
            ),
            "profile_image": get_image_url_with_fallback(
                athlete.profile_image,
                athlete.name
            ),
            "sport": athlete.sport or "Not specified",
            "location": athlete.location or "Not specified",
            "age": athlete.age or 0,
            "ai_score": athlete.ai_score or 0,
            "national_rank": athlete.national_rank,
            "is_connected": connection is not None and connection.status == 'accepted',
            "connection_status": connection.status if connection else None,
            "latest_assessment": {
                "test_type": latest_assessment.test_type,
                "ai_score": latest_assessment.ai_score,
                "created_at": latest_assessment.created_at.isoformat()
            } if latest_assessment else None
        })
    
    return {
        "data": formatted_athletes,
        "pagination": {
            "total": total_count,
            "page": page,
            "limit": limit,
            "pages": (total_count + limit - 1) // limit
        }
    }


# ============================================================================
# GET ATHLETE DETAILS
# ============================================================================
@router.get("/athlete/{athlete_id}")
async def get_athlete_details(
    athlete_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific athlete"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    athlete = db.query(models.User).filter(
        models.User.id == athlete_id,
        models.User.role == 'athlete'
    ).first()
    
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Get all assessments
    assessments = db.query(models.Assessment).filter(
        models.Assessment.user_id == athlete_id
    ).order_by(models.Assessment.created_at.desc()).all()
    
    # Get recent posts
    posts = db.query(models.Post).filter(
        models.Post.user_id == athlete_id
    ).order_by(models.Post.created_at.desc()).limit(5).all()
    
    # Get performance data
    performance_data = db.query(models.PerformanceData).filter(
        models.PerformanceData.user_id == athlete_id
    ).order_by(models.PerformanceData.recorded_at.desc()).limit(20).all()
    
    return {
        "athlete": {
            "id": athlete.id,
            "name": athlete.name,
            "email": athlete.email,
            "phone": athlete.phone,
            "profile_photo": get_image_url_with_fallback(
                athlete.profile_photo or athlete.profile_image,
                athlete.name
            ),
            "sport": athlete.sport,
            "location": athlete.location,
            "age": athlete.age,
            "bio": athlete.bio,
            "achievements": athlete.achievements,
            "height": athlete.height,
            "weight": athlete.weight,
            "skills": athlete.skills,
            "ai_score": athlete.ai_score,
            "national_rank": athlete.national_rank,
            "created_at": athlete.created_at.isoformat() if athlete.created_at else None
        },
        "assessments": [
            {
                "id": a.id,
                "test_type": a.test_type,
                "score": a.score,
                "ai_score": a.ai_score,
                "ai_feedback": a.ai_feedback,
                "status": a.status,
                "video_url": a.video_url,
                "created_at": a.created_at.isoformat()
            } for a in assessments
        ],
        "recent_posts": [
            {
                "id": p.id,
                "text": p.text,
                "media_url": get_image_url(p.media_url),
                "media_type": p.media_type,
                "likes_count": p.likes_count,
                "comments_count": p.comments_count,
                "created_at": p.created_at.isoformat()
            } for p in posts
        ],
        "performance_data": [
            {
                "metric_type": pd.metric_type,
                "value": pd.value,
                "unit": pd.unit,
                "recorded_at": pd.recorded_at.isoformat()
            } for pd in performance_data
        ]
    }


# ============================================================================
# GET COACH DASHBOARD FEED
# ============================================================================
@router.get("/dashboard/feed")
async def get_coach_dashboard_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get feed of posts from connected athletes"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    # Get connected athlete IDs
    connected_athlete_ids = db.query(models.User.id).join(
        models.connections,
        db_or(
            db_and(
                models.connections.c.user_id == current_user.id,
                models.connections.c.connected_user_id == models.User.id
            ),
            db_and(
                models.connections.c.connected_user_id == current_user.id,
                models.connections.c.user_id == models.User.id
            )
        )
    ).filter(
        models.connections.c.status == 'accepted',
        models.User.role == 'athlete'
    ).subquery()
    
    offset = (page - 1) * limit
    posts = db.query(models.Post).filter(
        models.Post.user_id.in_(connected_athlete_ids)
    ).options(
        joinedload(models.Post.user)
    ).order_by(
        models.Post.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    formatted_posts = []
    for post in posts:
        formatted_posts.append({
            "id": str(post.id),
            "user": {
                "id": str(post.user.id),
                "name": post.user.name,
                "profile_photo": get_image_url_with_fallback(
                    post.user.profile_photo or post.user.profile_image,
                    post.user.name
                ),
                "sport": post.user.sport,
                "location": post.user.location,
                "ai_score": post.user.ai_score
            },
            "content": {
                "text": post.text,
                "media_url": get_image_url(post.media_url),
                "media_type": post.media_type
            },
            "is_ai_verified": post.is_ai_verified,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "created_at": post.created_at.isoformat()
        })
    
    total = db.query(models.Post).filter(
        models.Post.user_id.in_(connected_athlete_ids)
    ).count()
    
    return {
        "data": formatted_posts,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0
    }


# ============================================================================
# GET COACH ASSESSMENTS
# ============================================================================
@router.get("/assessments")
async def get_coach_assessments(
    search: Optional[str] = Query(None),
    test_type: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all assessments from connected athletes with filtering"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    try:
        # Get connected athlete IDs
        connected_athlete_ids = db.query(models.User.id).join(
            models.connections,
            db_or(
                db_and(
                    models.connections.c.user_id == current_user.id,
                    models.connections.c.connected_user_id == models.User.id
                ),
                db_and(
                    models.connections.c.connected_user_id == current_user.id,
                    models.connections.c.user_id == models.User.id
                )
            )
        ).filter(
            models.connections.c.status == 'accepted',
            models.User.role == 'athlete'
        ).subquery()
        
        # Build query
        query = db.query(models.Assessment).join(
            models.User,
            models.Assessment.user_id == models.User.id
        ).filter(
            models.Assessment.user_id.in_(connected_athlete_ids)
        ).options(
            joinedload(models.Assessment.user)
        )
        
        # Apply search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db_or(
                    models.User.name.ilike(search_term),
                    models.User.sport.ilike(search_term),
                    models.Assessment.test_type.ilike(search_term),
                    models.User.location.ilike(search_term)
                )
            )
        
        # Apply test type filter
        if test_type and test_type != 'all':
            query = query.filter(models.Assessment.test_type == test_type)
        
        # Apply score filters
        if min_score is not None:
            query = query.filter(models.Assessment.ai_score >= min_score)
        
        if max_score is not None:
            query = query.filter(models.Assessment.ai_score <= max_score)
        
        # Get total count
        total_count = query.count()
        
        # Apply sorting
        if sort_by == 'ai_score':
            sort_column = models.Assessment.ai_score
        else:
            sort_column = models.Assessment.created_at
        
        if sort_order.lower() == 'asc':
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        # Apply pagination
        offset = (page - 1) * limit
        assessments = query.offset(offset).limit(limit).all()
        
        # Get personal bests for athletes
        athlete_ids = list(set(a.user_id for a in assessments))
        personal_bests = {}
        
        if athlete_ids:
            best_scores_query = db.query(
                models.Assessment.user_id,
                models.Assessment.test_type,
                func.max(models.Assessment.ai_score).label('best_score')
            ).filter(
                models.Assessment.user_id.in_(athlete_ids),
                models.Assessment.ai_score.isnot(None)
            ).group_by(
                models.Assessment.user_id,
                models.Assessment.test_type
            ).all()
            
            for row in best_scores_query:
                if row.user_id not in personal_bests:
                    personal_bests[row.user_id] = {}
                personal_bests[row.user_id][row.test_type] = row.best_score
        
        # Format response
        formatted_assessments = []
        for assessment in assessments:
            athlete = assessment.user
            
            # Check if personal best
            athlete_bests = personal_bests.get(athlete.id, {})
            test_best = athlete_bests.get(assessment.test_type, 0)
            is_personal_best = (
                assessment.ai_score is not None and 
                assessment.ai_score == test_best
            )
            
            formatted_assessments.append({
                "id": assessment.id,
                "athlete": {
                    "id": athlete.id,
                    "name": athlete.name,
                    "profile_photo": get_image_url_with_fallback(
                        athlete.profile_photo or athlete.profile_image,
                        athlete.name
                    ),
                    "sport": athlete.sport or "Not specified",
                    "location": athlete.location or "Not specified",
                    "age": athlete.age or 0,
                    "ai_score": athlete.ai_score or 0
                },
                "test_type": assessment.test_type,
                "score": assessment.score,
                "ai_score": assessment.ai_score or 0,
                "ai_feedback": assessment.ai_feedback,
                "status": assessment.status,
                "video_url": assessment.video_url,
                "created_at": assessment.created_at.isoformat(),
                "is_personal_best": is_personal_best,
                "athlete_best_score": test_best
            })
        
        # Calculate stats
        stats = calculate_assessment_stats(connected_athlete_ids, db)
        
        return {
            "data": formatted_assessments,
            "stats": stats,
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
                "pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
                "has_more": offset + limit < total_count
            }
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch assessments: {str(e)}")


def calculate_assessment_stats(connected_athlete_ids, db: Session) -> dict:
    """Calculate aggregate statistics for coach's athletes"""
    
    # Total assessments
    total_assessments = db.query(func.count(models.Assessment.id)).filter(
        models.Assessment.user_id.in_(connected_athlete_ids)
    ).scalar() or 0
    
    # Average score
    avg_score = db.query(func.avg(models.Assessment.ai_score)).filter(
        models.Assessment.user_id.in_(connected_athlete_ids),
        models.Assessment.ai_score.isnot(None)
    ).scalar() or 0
    
    # Test types with counts
    test_types = db.query(
        models.Assessment.test_type,
        func.count(models.Assessment.id).label('count')
    ).filter(
        models.Assessment.user_id.in_(connected_athlete_ids)
    ).group_by(
        models.Assessment.test_type
    ).all()
    
    return {
        "total_assessments": total_assessments,
        "average_score": round(float(avg_score), 1),
        "test_types": [
            {"test_type": t.test_type, "count": t.count}
            for t in test_types
        ]
    }


# ============================================================================
# GET COACH ASSESSMENT STATISTICS
# ============================================================================
@router.get("/assessments/statistics")
async def get_coach_assessment_statistics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed assessment statistics for coach dashboard"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    try:
        # Get connected athlete IDs
        connected_athlete_ids = db.query(models.User.id).join(
            models.connections,
            db_or(
                db_and(
                    models.connections.c.user_id == current_user.id,
                    models.connections.c.connected_user_id == models.User.id
                ),
                db_and(
                    models.connections.c.connected_user_id == current_user.id,
                    models.connections.c.user_id == models.User.id
                )
            )
        ).filter(
            models.connections.c.status == 'accepted',
            models.User.role == 'athlete'
        ).subquery()
        
        # Best scores by test type
        best_scores = db.query(
            models.Assessment.test_type,
            func.max(models.Assessment.ai_score).label('best_score'),
            func.avg(models.Assessment.ai_score).label('avg_score'),
            func.count(models.Assessment.id).label('count')
        ).filter(
            models.Assessment.user_id.in_(connected_athlete_ids),
            models.Assessment.ai_score.isnot(None)
        ).group_by(
            models.Assessment.test_type
        ).all()
        
        # Top performers
        top_performers = db.query(
            models.User.id,
            models.User.name,
            models.User.profile_photo,
            models.User.profile_image,
            models.User.sport,
            func.avg(models.Assessment.ai_score).label('avg_score'),
            func.count(models.Assessment.id).label('assessment_count')
        ).join(
            models.Assessment,
            models.Assessment.user_id == models.User.id
        ).filter(
            models.User.id.in_(connected_athlete_ids),
            models.Assessment.ai_score.isnot(None)
        ).group_by(
            models.User.id,
            models.User.name,
            models.User.profile_photo,
            models.User.profile_image,
            models.User.sport
        ).order_by(
            func.avg(models.Assessment.ai_score).desc()
        ).limit(10).all()
        
        # Recent improvements
        recent_improvements = []
        athlete_ids_list = [row[0] for row in db.query(models.User.id).filter(
            models.User.id.in_(connected_athlete_ids)
        ).limit(50).all()]
        
        for athlete_id in athlete_ids_list:
            recent = db.query(models.Assessment).filter(
                models.Assessment.user_id == athlete_id,
                models.Assessment.ai_score.isnot(None)
            ).order_by(models.Assessment.created_at.desc()).limit(5).all()
            
            if len(recent) >= 2 and recent[0].ai_score and recent[-1].ai_score:
                improvement = recent[0].ai_score - recent[-1].ai_score
                if improvement > 0:
                    athlete = db.query(models.User).filter(
                        models.User.id == athlete_id
                    ).first()
                    
                    if athlete:
                        recent_improvements.append({
                            "athlete": {
                                "id": athlete.id,
                                "name": athlete.name,
                                "profile_photo": get_image_url_with_fallback(
                                    athlete.profile_photo or athlete.profile_image,
                                    athlete.name
                                )
                            },
                            "improvement": round(improvement, 1),
                            "test_type": recent[0].test_type,
                            "current_score": recent[0].ai_score,
                            "previous_score": recent[-1].ai_score
                        })
        
        # Sort improvements by value
        recent_improvements.sort(key=lambda x: x['improvement'], reverse=True)
        
        return {
            "best_scores_by_type": [
                {
                    "test_type": bs.test_type,
                    "best_score": round(bs.best_score or 0, 1),
                    "average_score": round(bs.avg_score or 0, 1),
                    "total_assessments": bs.count
                } for bs in best_scores
            ],
            "top_performers": [
                {
                    "id": tp.id,
                    "name": tp.name,
                    "profile_photo": get_image_url_with_fallback(
                        tp.profile_photo or tp.profile_image,
                        tp.name
                    ),
                    "sport": tp.sport,
                    "average_score": round(tp.avg_score or 0, 1),
                    "assessment_count": tp.assessment_count
                } for tp in top_performers
            ],
            "recent_improvements": recent_improvements[:10]
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to compute coach statistics")


# ============================================================================
# GET COACH DASHBOARD STATS
# ============================================================================
@router.get("/dashboard-stats")
async def get_coach_dashboard_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get coach dashboard summary statistics"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    # Connected athletes count
    connected_athletes = db.query(models.connections).filter(
        db_or(
            models.connections.c.user_id == current_user.id,
            models.connections.c.connected_user_id == current_user.id
        ),
        models.connections.c.status == 'accepted'
    ).count()
    
    # Get connected athlete IDs for assessment count
    connected_athlete_ids = db.query(models.User.id).join(
        models.connections,
        db_or(
            db_and(
                models.connections.c.user_id == current_user.id,
                models.connections.c.connected_user_id == models.User.id
            ),
            db_and(
                models.connections.c.connected_user_id == current_user.id,
                models.connections.c.user_id == models.User.id
            )
        )
    ).filter(
        models.connections.c.status == 'accepted',
        models.User.role == 'athlete'
    ).subquery()
    
    # Total assessments from connected athletes
    total_assessments = db.query(models.Assessment).filter(
        models.Assessment.user_id.in_(connected_athlete_ids)
    ).count()
    
    # Pending connection requests
    pending_requests = db.query(models.connections).filter(
        models.connections.c.connected_user_id == current_user.id,
        models.connections.c.status == 'pending'
    ).count()
    
    return {
        "connected_athletes": connected_athletes,
        "total_assessments": total_assessments,
        "pending_requests": pending_requests,
        "coach_info": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "specialization": current_user.specialization or current_user.sport,
            "experience": current_user.experience,
            "profile_photo": get_image_url_with_fallback(
                current_user.profile_photo or current_user.profile_image,
                current_user.name
            )
        }
    }


# ============================================================================
# GET COACH PROFILE
# ============================================================================
@router.get("/profile")
async def get_coach_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get coach profile with all statistics"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    # Get connected athletes count
    connected_athletes = db.query(models.connections).filter(
        db_or(
            models.connections.c.user_id == current_user.id,
            models.connections.c.connected_user_id == current_user.id
        ),
        models.connections.c.status == 'accepted'
    ).count()
    
    # Get connected athlete IDs
    connected_athlete_ids = db.query(models.User.id).join(
        models.connections,
        db_or(
            db_and(
                models.connections.c.user_id == current_user.id,
                models.connections.c.connected_user_id == models.User.id
            ),
            db_and(
                models.connections.c.connected_user_id == current_user.id,
                models.connections.c.user_id == models.User.id
            )
        )
    ).filter(
        models.connections.c.status == 'accepted',
        models.User.role == 'athlete'
    ).subquery()
    
    # Get total assessments reviewed
    total_assessments = db.query(models.Assessment).filter(
        models.Assessment.user_id.in_(connected_athlete_ids)
    ).count()
    
    # Get pending connection requests
    pending_requests = db.query(models.connections).filter(
        models.connections.c.connected_user_id == current_user.id,
        models.connections.c.status == 'pending'
    ).count()
    
    return {
        "profile": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "phone": current_user.phone,
            "role": current_user.role,
            "sport": current_user.sport,
            "specialization": current_user.specialization,
            "experience": current_user.experience,
            "location": current_user.location,
            "age": current_user.age,
            "bio": current_user.bio,
            "achievements": current_user.achievements,
            "profile_photo": get_image_url_with_fallback(
                current_user.profile_photo or current_user.profile_image,
                current_user.name
            ),
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None
        },
        "stats": {
            "connected_athletes": connected_athletes,
            "total_assessments": total_assessments,
            "pending_requests": pending_requests
        }
    }


# ============================================================================
# UPDATE COACH PROFILE
# ============================================================================
@router.put("/profile")
async def update_coach_profile(
    specialization: Optional[str] = Form(None),
    experience: Optional[int] = Form(None),
    bio: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    age: Optional[int] = Form(None),
    achievements: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    profileImage: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update coach profile"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    try:
        # Update fields if provided
        if specialization is not None:
            current_user.specialization = specialization
            current_user.sport = specialization  # Keep in sync
        
        if experience is not None:
            current_user.experience = experience
        
        if bio is not None:
            current_user.bio = bio
        
        if location is not None:
            current_user.location = location
        
        if age is not None:
            current_user.age = age
        
        if achievements is not None:
            current_user.achievements = achievements
        
        if phone is not None:
            current_user.phone = phone
        
        # Handle profile image upload
        if profileImage and profileImage.filename:
            # Get file extension
            extension = profileImage.filename.split(".")[-1].lower()
            if extension == "jpeg":
                extension = "jpg"
            
            # Create filename
            file_name = f"coach_profile_{current_user.id}_{datetime.now().timestamp()}.{extension}"
            
            # Ensure profiles directory exists
            profiles_dir = Path(UPLOAD_DIR) / "profiles"
            profiles_dir.mkdir(parents=True, exist_ok=True)
            
            file_path = profiles_dir / file_name
            
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(profileImage.file, buffer)
            
            # Update user record
            image_url = f"/uploads/profiles/{file_name}"
            current_user.profile_image = image_url
            current_user.profile_photo = image_url
        
        db.commit()
        db.refresh(current_user)
        
        return {
            "message": "Coach profile updated successfully",
            "user": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "phone": current_user.phone,
                "role": current_user.role,
                "sport": current_user.sport,
                "specialization": current_user.specialization,
                "experience": current_user.experience,
                "location": current_user.location,
                "age": current_user.age,
                "bio": current_user.bio,
                "achievements": current_user.achievements,
                "profile_image": get_image_url_with_fallback(
                    current_user.profile_image,
                    current_user.name
                ),
                "profile_photo": get_image_url_with_fallback(
                    current_user.profile_photo,
                    current_user.name
                )
            }
        }
        
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GET CONNECTED ATHLETES LIST (Simple)
# ============================================================================
@router.get("/connected-athletes")
async def get_connected_athletes_simple(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get simple list of connected athletes for messaging, etc."""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    # Get connected athletes
    athletes = db.query(models.User).join(
        models.connections,
        db_or(
            db_and(
                models.connections.c.user_id == current_user.id,
                models.connections.c.connected_user_id == models.User.id
            ),
            db_and(
                models.connections.c.connected_user_id == current_user.id,
                models.connections.c.user_id == models.User.id
            )
        )
    ).filter(
        models.connections.c.status == 'accepted',
        models.User.role == 'athlete'
    ).all()
    
    return {
        "data": [
            {
                "id": athlete.id,
                "name": athlete.name,
                "profile_photo": get_image_url_with_fallback(
                    athlete.profile_photo or athlete.profile_image,
                    athlete.name
                ),
                "sport": athlete.sport,
                "ai_score": athlete.ai_score,
                "is_online": athlete.is_online
            }
            for athlete in athletes
        ],
        "total": len(athletes)
    }
# ============================================================================
# GET ALL ATHLETES (Not just connected ones)
# ============================================================================
@router.get("/all-athletes")
async def get_all_athletes(
    search: Optional[str] = Query(None),
    sport: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    sort_by: str = Query("ai_score", regex="^(ai_score|name|created_at|national_rank)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get ALL athletes in the system (not just connected ones).
    For coaches to discover and view athlete profiles.
    """
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    try:
        # Base query for athletes
        query = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True
        )
        
        # Apply search filter
        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(
                db_or(
                    func.lower(models.User.name).like(search_term),
                    func.lower(models.User.sport).like(search_term),
                    func.lower(models.User.location).like(search_term)
                )
            )
        
        # Apply sport filter
        if sport and sport != 'all':
            query = query.filter(models.User.sport == sport)
        
        # Apply minimum score filter
        if min_score is not None:
            query = query.filter(models.User.ai_score >= min_score)
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply sorting
        if sort_by == 'ai_score':
            sort_column = models.User.ai_score
        elif sort_by == 'name':
            sort_column = models.User.name
        elif sort_by == 'national_rank':
            sort_column = models.User.national_rank
        else:
            sort_column = models.User.created_at
        
        if sort_order == 'asc':
            query = query.order_by(sort_column.asc().nullslast())
        else:
            query = query.order_by(sort_column.desc().nullsfirst())
        
        # Apply pagination
        offset = (page - 1) * limit
        athletes = query.offset(offset).limit(limit).all()
        
        # Format response with connection status
        formatted_athletes = []
        for athlete in athletes:
            # Check if connected to this coach
            connection = db.query(models.connections).filter(
                db_or(
                    db_and(
                        models.connections.c.user_id == current_user.id,
                        models.connections.c.connected_user_id == athlete.id
                    ),
                    db_and(
                        models.connections.c.user_id == athlete.id,
                        models.connections.c.connected_user_id == current_user.id
                    )
                )
            ).first()
            
            connection_status = None
            if connection:
                connection_status = connection.status
            
            # Get latest assessment info
            latest_assessment = db.query(models.Assessment).filter(
                models.Assessment.user_id == athlete.id,
                models.Assessment.ai_score.isnot(None)
            ).order_by(models.Assessment.created_at.desc()).first()
            
            # Get assessment count
            assessment_count = db.query(models.Assessment).filter(
                models.Assessment.user_id == athlete.id,
                models.Assessment.ai_score.isnot(None)
            ).count()
            
            formatted_athletes.append({
                "id": athlete.id,
                "name": athlete.name,
                "email": athlete.email,
                "profile_photo": get_image_url_with_fallback(
                    athlete.profile_photo or athlete.profile_image,
                    athlete.name
                ),
                "sport": athlete.sport or "Not specified",
                "location": athlete.location or "Not specified",
                "age": athlete.age,
                "bio": athlete.bio,
                "ai_score": round(athlete.ai_score, 1) if athlete.ai_score else 0,
                "national_rank": athlete.national_rank,
                "is_online": athlete.is_online or False,
                "last_seen": athlete.last_seen.isoformat() if athlete.last_seen else None,
                "is_verified": athlete.is_verified or False,
                "connection_status": connection_status,  # null, 'pending', 'accepted', 'rejected'
                "is_connected": connection_status == 'accepted',
                "assessment_count": assessment_count,
                "latest_assessment": {
                    "test_type": latest_assessment.test_type,
                    "ai_score": latest_assessment.ai_score,
                    "created_at": latest_assessment.created_at.isoformat()
                } if latest_assessment else None,
                "created_at": athlete.created_at.isoformat() if athlete.created_at else None
            })
        
        # Get available sports for filter
        sports = db.query(models.User.sport).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.sport.isnot(None)
        ).distinct().all()
        
        return {
            "data": formatted_athletes,
            "filters": {
                "sports": [s[0] for s in sports if s[0]]
            },
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
                "pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
                "has_more": offset + limit < total_count
            }
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch athletes: {str(e)}")


# ============================================================================
# GET TOP PERFORMING ATHLETES
# ============================================================================
@router.get("/top-athletes")
async def get_top_athletes(
    limit: int = Query(10, le=50),
    sport: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get top performing athletes by AI score"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    try:
        query = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.ai_score.isnot(None),
            models.User.ai_score > 0
        )
        
        if sport and sport != 'all':
            query = query.filter(models.User.sport == sport)
        
        athletes = query.order_by(
            models.User.ai_score.desc()
        ).limit(limit).all()
        
        return {
            "data": [
                {
                    "id": athlete.id,
                    "name": athlete.name,
                    "profile_photo": get_image_url_with_fallback(
                        athlete.profile_photo or athlete.profile_image,
                        athlete.name
                    ),
                    "sport": athlete.sport,
                    "location": athlete.location,
                    "ai_score": round(athlete.ai_score, 1) if athlete.ai_score else 0,
                    "national_rank": athlete.national_rank,
                    "is_online": athlete.is_online or False,
                    "is_verified": athlete.is_verified or False
                }
                for athlete in athletes
            ]
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch top athletes")


# ============================================================================
# GET RECENTLY ACTIVE ATHLETES
# ============================================================================
@router.get("/active-athletes")
async def get_active_athletes(
    hours: int = Query(24, ge=1, le=168),  # Default last 24 hours, max 1 week
    limit: int = Query(10, le=50),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recently active athletes (online or recently seen)"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Get athletes who are online or were recently active
        athletes = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            db_or(
                models.User.is_online == True,
                models.User.last_seen >= cutoff_time
            )
        ).order_by(
            models.User.is_online.desc(),
            models.User.last_seen.desc().nullslast(),
            models.User.ai_score.desc().nullslast()
        ).limit(limit).all()
        
        return {
            "data": [
                {
                    "id": athlete.id,
                    "name": athlete.name,
                    "profile_photo": get_image_url_with_fallback(
                        athlete.profile_photo or athlete.profile_image,
                        athlete.name
                    ),
                    "sport": athlete.sport,
                    "location": athlete.location,
                    "ai_score": round(athlete.ai_score, 1) if athlete.ai_score else 0,
                    "national_rank": athlete.national_rank,
                    "is_online": athlete.is_online or False,
                    "last_seen": athlete.last_seen.isoformat() if athlete.last_seen else None
                }
                for athlete in athletes
            ],
            "time_range_hours": hours
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch active athletes")


# ============================================================================
# GET RISING STARS (Athletes with biggest improvements)
# ============================================================================
@router.get("/rising-stars")
async def get_rising_stars(
    days: int = Query(30, ge=7, le=90),
    limit: int = Query(10, le=50),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get athletes with the biggest score improvements in the given period"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all athletes with assessments
        athletes = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True
        ).all()
        
        improvements = []
        
        for athlete in athletes:
            # Get oldest and newest assessments in period
            oldest = db.query(models.Assessment).filter(
                models.Assessment.user_id == athlete.id,
                models.Assessment.created_at >= cutoff_date,
                models.Assessment.ai_score.isnot(None)
            ).order_by(models.Assessment.created_at.asc()).first()
            
            newest = db.query(models.Assessment).filter(
                models.Assessment.user_id == athlete.id,
                models.Assessment.created_at >= cutoff_date,
                models.Assessment.ai_score.isnot(None)
            ).order_by(models.Assessment.created_at.desc()).first()
            
            if oldest and newest and oldest.id != newest.id:
                improvement = newest.ai_score - oldest.ai_score
                if improvement > 0:
                    improvements.append({
                        "athlete": {
                            "id": athlete.id,
                            "name": athlete.name,
                            "profile_photo": get_image_url_with_fallback(
                                athlete.profile_photo or athlete.profile_image,
                                athlete.name
                            ),
                            "sport": athlete.sport,
                            "location": athlete.location,
                            "ai_score": round(athlete.ai_score, 1) if athlete.ai_score else 0,
                            "national_rank": athlete.national_rank,
                            "is_online": athlete.is_online or False
                        },
                        "improvement": round(improvement, 1),
                        "old_score": round(oldest.ai_score, 1),
                        "new_score": round(newest.ai_score, 1),
                        "days_between": (newest.created_at - oldest.created_at).days
                    })
        
        # Sort by improvement
        improvements.sort(key=lambda x: x['improvement'], reverse=True)
        
        return {
            "data": improvements[:limit],
            "period_days": days
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch rising stars")