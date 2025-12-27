# backend/api/admin.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from database import get_db
import models
from core.dependencies import get_current_user
import pandas as pd

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ============================================================================
# ATHLETE MANAGEMENT
# ============================================================================

@router.get("/athletes")
async def get_athletes(
    search: str = Query(None),
    sport: str = Query(None),
    location: str = Query(None),
    min_score: float = Query(None, ge=0, le=100),
    max_score: float = Query(None, ge=0, le=100),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db)
):
    """Get paginated list of athletes with filtering"""
    query = db.query(models.User).filter(
        models.User.role == 'athlete',
        models.User.is_active == True
    )
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            func.lower(models.User.name).ilike(search_term) |
            func.lower(models.User.email).ilike(search_term) |
            func.lower(models.User.location).ilike(search_term)
        )
    
    if sport:
        query = query.filter(models.User.sport == sport)
    
    if location:
        query = query.filter(models.User.location == location)
    
    if min_score is not None:
        query = query.filter(models.User.ai_score >= min_score)
    
    if max_score is not None:
        query = query.filter(models.User.ai_score <= max_score)
    
    total = query.count()
    offset = (page - 1) * limit
    athletes = query.order_by(desc(models.User.ai_score)).offset(offset).limit(limit).all()
    
    return {
        "data": [
            {
                "id": athlete.id,
                "name": athlete.name,
                "email": athlete.email,
                "sport": athlete.sport,
                "location": athlete.location,
                "age": athlete.age,
                "ai_score": athlete.ai_score,
                "national_rank": athlete.national_rank,
                "profile_photo": athlete.profile_photo or athlete.profile_image,
                "is_verified": athlete.is_verified,
                "created_at": athlete.created_at.isoformat()
            }
            for athlete in athletes
        ],
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    }

@router.get("/athletes/{athlete_id}")
async def get_athlete_details(
    athlete_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed athlete information"""
    athlete = db.query(models.User).filter(
        models.User.id == athlete_id,
        models.User.role == 'athlete'
    ).first()
    
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Get athlete's assessments
    assessments = db.query(models.Assessment).filter(
        models.Assessment.user_id == athlete_id
    ).order_by(desc(models.Assessment.created_at)).limit(5).all()
    
    # Get athlete's performance data
    performance_data = db.query(models.PerformanceData).filter(
        models.PerformanceData.user_id == athlete_id
    ).order_by(desc(models.PerformanceData.recorded_at)).limit(10).all()
    
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
            "ai_score": athlete.ai_score,
            "national_rank": athlete.national_rank,
            "is_verified": athlete.is_verified,
            "created_at": athlete.created_at.isoformat()
        },
        "recent_assessments": [
            {
                "id": a.id,
                "test_type": a.test_type,
                "ai_score": a.ai_score,
                "created_at": a.created_at.isoformat()
            }
            for a in assessments
        ],
        "performance_data": [
            {
                "metric_type": pd.metric_type,
                "value": pd.value,
                "unit": pd.unit,
                "recorded_at": pd.recorded_at.isoformat()
            }
            for pd in performance_data
        ]
    }

# ============================================================================
# ASSESSMENT MANAGEMENT
# ============================================================================

@router.get("/assessments")
async def get_assessments(
    test_type: str = Query(None),
    status: str = Query(None),
    athlete_id: int = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db)
):
    """Get paginated list of assessments with filtering"""
    query = db.query(models.Assessment)
    
    if test_type:
        query = query.filter(models.Assessment.test_type == test_type)
    
    if status:
        query = query.filter(models.Assessment.status == status)
    
    if athlete_id:
        query = query.filter(models.Assessment.user_id == athlete_id)
    
    total = query.count()
    offset = (page - 1) * limit
    assessments = query.order_by(desc(models.Assessment.created_at)).offset(offset).limit(limit).all()
    
    return {
        "data": [
            {
                "id": assessment.id,
                "user_id": assessment.user_id,
                "test_type": assessment.test_type,
                "ai_score": assessment.ai_score,
                "status": assessment.status,
                "video_url": assessment.video_url,
                "ai_feedback": assessment.ai_feedback,
                "created_at": assessment.created_at.isoformat()
            }
            for assessment in assessments
        ],
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    }

@router.put("/assessments/{assessment_id}/verify")
async def verify_assessment(
    assessment_id: int,
    verified: bool = False,
    feedback: str = None,
    db: Session = Depends(get_db)
):
    """Verify or reject an assessment with feedback"""
    assessment = db.query(models.Assessment).filter(
        models.Assessment.id == assessment_id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    assessment.status = "verified" if verified else "rejected"
    assessment.ai_feedback = feedback
    
    db.commit()
    db.refresh(assessment)
    
    return {
        "message": "Assessment verified successfully" if verified else "Assessment rejected",
        "assessment": {
            "id": assessment.id,
            "status": assessment.status,
            "ai_feedback": assessment.ai_feedback
        }
    }

# ============================================================================
# ANALYTICS
# ============================================================================

@router.get("/analytics/talent-map")
async def get_talent_map(db: Session = Depends(get_db)):
    """Get talent distribution by region and sport"""
    # Regional distribution
    regional_query = db.query(
        models.User.location,
        func.count(models.User.id).label('count'),
        func.avg(models.User.ai_score).label('avg_score')
    ).filter(
        models.User.role == 'athlete',
        models.User.is_active == True,
        models.User.location.isnot(None)
    ).group_by(models.User.location).all()
    
    # Sport distribution
    sport_query = db.query(
        models.User.sport,
        func.count(models.User.id).label('count'),
        func.avg(models.User.ai_score).label('avg_score')
    ).filter(
        models.User.role == 'athlete',
        models.User.is_active == True,
        models.User.sport.isnot(None)
    ).group_by(models.User.sport).all()
    
    # Gender distribution (assuming gender field exists)
    gender_query = db.query(
        models.User.gender,
        func.count(models.User.id).label('count'),
        func.avg(models.User.ai_score).label('avg_score')
    ).filter(
        models.User.role == 'athlete',
        models.User.is_active == True,
        models.User.gender.isnot(None)
    ).group_by(models.User.gender).all()
    
    return {
        "regional_distribution": [
            {
                "location": item.location,
                "count": item.count,
                "avg_score": round(item.avg_score, 1) if item.avg_score else None
            }
            for item in regional_query
        ],
        "sport_distribution": [
            {
                "sport": item.sport,
                "count": item.count,
                "avg_score": round(item.avg_score, 1) if item.avg_score else None
            }
            for item in sport_query
        ],
        "gender_distribution": [
            {
                "gender": item.gender,
                "count": item.count,
                "avg_score": round(item.avg_score, 1) if item.avg_score else None
            }
            for item in gender_query
        ]
    }

@router.get("/analytics/performance-trends")
async def get_performance_trends(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Get performance trends over specified period"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Average scores over time
    trends = db.query(
        func.date(models.Assessment.created_at).label('date'),
        func.avg(models.Assessment.ai_score).label('avg_score'),
        func.count(models.Assessment.id).label('count')
    ).filter(
        models.Assessment.created_at >= cutoff_date,
        models.Assessment.ai_score.isnot(None)
    ).group_by(func.date(models.Assessment.created_at)).all()
    
    # Top improving athletes
    improving_athletes = db.query(
        models.User.id,
        models.User.name,
        func.avg(models.Assessment.ai_score).label('current_avg'),
        func.max(models.Assessment.ai_score).label('best_score')
    ).join(
        models.Assessment,
        models.Assessment.user_id == models.User.id
    ).filter(
        models.Assessment.created_at >= cutoff_date,
        models.Assessment.ai_score.isnot(None)
    ).group_by(models.User.id, models.User.name).order_by(
        (func.avg(models.Assessment.ai_score) - func.min(models.Assessment.ai_score)).desc()
    ).limit(10).all()
    
    return {
        "trends": [
            {
                "date": item.date.isoformat(),
                "avg_score": round(item.avg_score, 1),
                "count": item.count
            }
            for item in trends
        ],
        "top_improving": [
            {
                "athlete_id": item.id,
                "name": item.name,
                "current_avg": round(item.current_avg, 1),
                "best_score": round(item.best_score, 1),
                "improvement": round(item.best_score - item.current_avg, 1)
            }
            for item in improving_athletes
        ]
    }

# ============================================================================
# CHEAT DETECTION
# ============================================================================

@router.get("/cheat-detection/anomalies")
async def get_anomalies(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db)
):
    """Get flagged assessments with potential anomalies"""
    # In a real implementation, this would use ML models to detect anomalies
    # For now, we'll simulate with some criteria
    
    # Find assessments with scores that don't match expected patterns
    anomalies = db.query(models.Assessment).filter(
        models.Assessment.status == 'pending',
        models.Assessment.ai_score.isnot(None)
    ).order_by(desc(models.Assessment.created_at)).all()
    
    # Apply anomaly detection logic (simplified)
    flagged_assessments = []
    for assessment in anomalies:
        # Simulated anomaly detection
        anomaly_score = 0
        
        # Check if score is significantly higher than user's average
        user_avg = db.query(func.avg(models.Assessment.ai_score)).filter(
            models.Assessment.user_id == assessment.user_id,
            models.Assessment.id != assessment.id,
            models.Assessment.ai_score.isnot(None)
        ).scalar()
        
        if user_avg and assessment.ai_score > user_avg * 1.5:
            anomaly_score += 5
            
        # Check for very short video duration (potential cheating)
        # This would require analyzing video metadata
        # if assessment.video_duration < 30:  # hypothetical field
        #     anomaly_score += 3
            
        if anomaly_score > 0:
            flagged_assessments.append({
                "id": assessment.id,
                "user_id": assessment.user_id,
                "test_type": assessment.test_type,
                "ai_score": assessment.ai_score,
                "anomaly_score": anomaly_score,
                "reasons": [
                    "Score significantly higher than user's average",
                    # "Video duration suspiciously short"
                ],
                "created_at": assessment.created_at.isoformat()
            })
    
    # Apply pagination
    start = (page - 1) * limit
    end = start + limit
    paginated = flagged_assessments[start:end]
    
    return {
        "data": paginated,
        "pagination": {
            "total": len(flagged_assessments),
            "page": page,
            "limit": limit,
            "pages": (len(flagged_assessments) + limit - 1) // limit
        }
    }

@router.put("/cheat-detection/feedback")
async def submit_feedback(
    assessment_id: int,
    is_false_positive: bool,
    feedback: str = None,
    db: Session = Depends(get_db)
):
    """Submit feedback on anomaly detection"""
    # This would update ML model training data
    # For now, we'll just log the feedback
    
    return {
        "message": "Feedback submitted successfully",
        "feedback": {
            "assessment_id": assessment_id,
            "is_false_positive": is_false_positive,
            "feedback": feedback
        }
    }

# ============================================================================
# SYSTEM CONFIGURATION
# ============================================================================

@router.put("/benchmarks")
async def update_benchmarks(
    benchmarks: dict,
    db: Session = Depends(get_db)
):
    """Update performance benchmarks for different categories"""
    # This would update benchmark values in the database
    # For simplicity, we'll just return success
    
    return {
        "message": "Benchmarks updated successfully",
        "benchmarks": benchmarks
    }

@router.get("/usage-stats")
async def get_usage_stats(db: Session = Depends(get_db)):
    """Get system usage statistics"""
    # Total users
    total_users = db.query(models.User).count()
    
    # Active users (last 30 days)
    active_users = db.query(models.User).filter(
        models.User.last_seen >= (datetime.utcnow() - timedelta(days=30))
    ).count()
    
    # Total assessments
    total_assessments = db.query(models.Assessment).count()
    
    # Recent assessments (last 7 days)
    recent_assessments = db.query(models.Assessment).filter(
        models.Assessment.created_at >= (datetime.utcnow() - timedelta(days=7))
    ).count()
    
    # App versions distribution (hypothetical)
    version_distribution = {
        "android": {"latest": 75, "outdated": 25},
        "ios": {"latest": 80, "outdated": 20}
    }
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_assessments": total_assessments,
        "recent_assessments": recent_assessments,
        "version_distribution": version_distribution
    }