# backend/api/coaches.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from database import get_db # Changed
from core.dependencies import get_current_user, get_image_url # Changed
import models # Changed
from sqlalchemy import or_ as db_or, and_ as db_and, func
import traceback

router = APIRouter(prefix="/api/coach", tags=["coach"])


@router.get("/athletes")
async def get_coach_athletes(
    search: Optional[str] = Query(None),
    sport: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
        
        latest_assessment = db.query(models.Assessment).filter(
            models.Assessment.user_id == athlete.id
        ).order_by(models.Assessment.created_at.desc()).first()
        
        formatted_athletes.append({
            "id": athlete.id,
            "name": athlete.name,
            "email": athlete.email,
            "profile_photo": get_image_url(athlete.profile_photo or athlete.profile_image),
            "profile_image": get_image_url(athlete.profile_image), # Keep both for frontend flexibility
            "sport": athlete.sport or "Not specified",
            "location": athlete.location or "Not specified",
            "age": athlete.age or 0,
            "ai_score": athlete.ai_score or 0,
            "is_connected": connection and connection.status == 'accepted',
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


@router.get("/athlete/{athlete_id}")
async def get_athlete_details(
    athlete_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    athlete = db.query(models.User).filter(
        models.User.id == athlete_id,
        models.User.role == 'athlete'
    ).first()
    
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    assessments = db.query(models.Assessment).filter(
        models.Assessment.user_id == athlete_id
    ).order_by(models.Assessment.created_at.desc()).all()
    
    posts = db.query(models.Post).filter(
        models.Post.user_id == athlete_id
    ).order_by(models.Post.created_at.desc()).limit(5).all()
    
    performance_data = db.query(models.PerformanceData).filter(
        models.PerformanceData.user_id == athlete_id
    ).order_by(models.PerformanceData.recorded_at.desc()).limit(20).all()
    
    return {
        "athlete": {
            "id": athlete.id,
            "name": athlete.name,
            "email": athlete.email,
            "phone": athlete.phone,
            "profile_photo": get_image_url(athlete.profile_photo or athlete.profile_image),
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
            "created_at": athlete.created_at.isoformat()
        },
        "assessments": [
            {
                "id": a.id,
                "test_type": a.test_type,
                "score": a.score,
                "ai_score": a.ai_score,
                "ai_feedback": a.ai_feedback,
                "created_at": a.created_at.isoformat()
            } for a in assessments
        ],
        "recent_posts": [
            {
                "id": p.id,
                "text": p.text,
                "media_url": get_image_url(p.media_url),
                "likes_count": p.likes_count,
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

@router.get("/dashboard/feed")
async def get_coach_dashboard_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
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
                "profile_photo": get_image_url(post.user.profile_photo or post.user.profile_image),
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
        "limit": limit
    }

@router.get("/assessments/statistics")
async def get_coach_assessment_statistics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    try:
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
        
        best_scores = db.query(
            models.Assessment.test_type,
            func.max(models.Assessment.ai_score).label('best_score'),
            func.avg(models.Assessment.ai_score).label('avg_score'),
            func.count(models.Assessment.id).label('count')
        ).filter(
            models.Assessment.user_id.in_(connected_athlete_ids)
        ).group_by(
            models.Assessment.test_type
        ).all()
        
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
            models.User.id.in_(connected_athlete_ids)
        ).group_by(
            models.User.id
        ).order_by(
            func.avg(models.Assessment.ai_score).desc()
        ).limit(5).all()
        
        recent_improvements = []
        for athlete_id in db.query(models.User.id).filter(models.User.id.in_(connected_athlete_ids)).all():
            recent = db.query(models.Assessment).filter(
                models.Assessment.user_id == athlete_id[0]
            ).order_by(models.Assessment.created_at.desc()).limit(5).all()
            
            if len(recent) >= 2:
                improvement = recent[0].ai_score - recent[-1].ai_score
                if improvement > 0:
                    athlete = db.query(models.User).filter(models.User.id == athlete_id[0]).first()
                    recent_improvements.append({
                        "athlete": {
                            "id": athlete.id,
                            "name": athlete.name,
                            "profile_photo": get_image_url(athlete.profile_photo or athlete.profile_image)
                        },
                        "improvement": round(improvement, 1),
                        "test_type": recent[0].test_type,
                        "current_score": recent[0].ai_score
                    })
        
        recent_improvements.sort(key=lambda x: x['improvement'], reverse=True)
        
        return {
            "best_scores_by_type": [
                {
                    "test_type": bs.test_type,
                    "best_score": round(bs.best_score, 1),
                    "average_score": round(bs.avg_score, 1),
                    "total_assessments": bs.count
                } for bs in best_scores
            ],
            "top_performers": [
                {
                    "id": tp.id,
                    "name": tp.name,
                    "profile_photo": get_image_url(tp.profile_photo or tp.profile_image),
                    "sport": tp.sport,
                    "average_score": round(tp.avg_score, 1),
                    "assessment_count": tp.assessment_count
                } for tp in top_performers
            ],
            "recent_improvements": recent_improvements[:5]
        }
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to compute coach statistics")


@router.get("/dashboard-stats")
async def get_coach_dashboard_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    connected_athletes = db.query(models.connections).filter(
        db_or(
            models.connections.c.user_id == current_user.id,
            models.connections.c.connected_user_id == current_user.id
        ),
        models.connections.c.status == 'accepted'
    ).count()
    
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
    
    total_assessments = db.query(models.Assessment).filter(
        models.Assessment.user_id.in_(connected_athlete_ids)
    ).count()
    
    pending_requests = db.query(models.connections).filter(
        models.connections.c.connected_user_id == current_user.id,
        models.connections.c.status == 'pending'
    ).count()
    
    return {
        "connected_athletes": connected_athletes,
        "total_assessments": total_assessments,
        "pending_requests": pending_requests,
        "coach_info": {
            "name": current_user.name,
            "specialization": current_user.specialization or current_user.sport,
            "experience": current_user.experience,
            "profile_photo": get_image_url(current_user.profile_photo or current_user.profile_image)
        }
    }
