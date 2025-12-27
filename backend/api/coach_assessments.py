# backend/api/coach_assessments.py
"""
Dedicated Coach Assessments API with optimized queries
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, desc, case
from typing import Optional, List
from datetime import datetime, timedelta
from database import get_db
from core.dependencies import get_current_user, get_image_url
import models

router = APIRouter(prefix="/api/coach", tags=["coach-assessments"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_connected_athlete_ids_subquery(coach_id: int, db: Session):
    """
    Returns a subquery of athlete IDs connected to the coach.
    Optimized to be used in other queries.
    """
    return db.query(models.User.id).join(
        models.connections,
        or_(
            and_(
                models.connections.c.user_id == coach_id,
                models.connections.c.connected_user_id == models.User.id
            ),
            and_(
                models.connections.c.connected_user_id == coach_id,
                models.connections.c.user_id == models.User.id
            )
        )
    ).filter(
        models.connections.c.status == 'accepted',
        models.User.role == 'athlete'
    ).subquery()


def calculate_personal_bests(athlete_ids: List[int], db: Session) -> dict:
    """
    Calculate personal best scores for each athlete per test type.
    Returns: {athlete_id: {test_type: best_score}}
    """
    best_scores = db.query(
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
    
    result = {}
    for row in best_scores:
        if row.user_id not in result:
            result[row.user_id] = {}
        result[row.user_id][row.test_type] = row.best_score
    
    return result


# ============================================================================
# MAIN ASSESSMENTS ENDPOINT
# ============================================================================

@router.get("/assessments")
async def get_coach_assessments(
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    
    # Filters
    search: Optional[str] = Query(None, description="Search athlete name, sport, or test type"),
    test_type: Optional[str] = Query(None, description="Filter by test type"),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    status: Optional[str] = Query(None, description="Assessment status"),
    date_from: Optional[datetime] = Query(None, description="Filter from date"),
    date_to: Optional[datetime] = Query(None, description="Filter to date"),
    
    # Sorting
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="asc or desc"),
    
    # Dependencies
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all assessments from connected athletes with comprehensive filtering.
    
    Returns assessments with:
    - Athlete details (name, photo, sport, location, age)
    - Assessment scores and feedback
    - Personal best indicators
    - Pagination info
    - Aggregate statistics
    """
    
    # Verify coach role
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    try:
        # Get connected athlete IDs
        connected_athlete_ids = get_connected_athlete_ids_subquery(current_user.id, db)
        
        # Build base query with JOINs (avoiding N+1)
        query = db.query(models.Assessment).join(
            models.User,
            models.Assessment.user_id == models.User.id
        ).filter(
            models.Assessment.user_id.in_(connected_athlete_ids)
        ).options(
            joinedload(models.Assessment.user)
        )
        
        # Apply filters
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    models.User.name.ilike(search_term),
                    models.User.sport.ilike(search_term),
                    models.Assessment.test_type.ilike(search_term),
                    models.User.location.ilike(search_term)
                )
            )
        
        if test_type and test_type != 'all':
            query = query.filter(models.Assessment.test_type == test_type)
        
        if min_score is not None:
            query = query.filter(models.Assessment.ai_score >= min_score)
        
        if max_score is not None:
            query = query.filter(models.Assessment.ai_score <= max_score)
        
        if status:
            query = query.filter(models.Assessment.status == status)
        
        if date_from:
            query = query.filter(models.Assessment.created_at >= date_from)
        
        if date_to:
            query = query.filter(models.Assessment.created_at <= date_to)
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply sorting
        sort_column = getattr(models.Assessment, sort_by, models.Assessment.created_at)
        if sort_order.lower() == 'asc':
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        # Apply pagination
        offset = (page - 1) * limit
        assessments = query.offset(offset).limit(limit).all()
        
        # Get unique athlete IDs for personal best calculation
        athlete_ids = list(set(a.user_id for a in assessments))
        personal_bests = calculate_personal_bests(athlete_ids, db)
        
        # Calculate statistics
        stats = calculate_assessment_stats(connected_athlete_ids, db)
        
        # Format response
        formatted_assessments = []
        for assessment in assessments:
            athlete = assessment.user
            
            # Check if this is a personal best
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
                    "profile_photo": get_image_url(athlete.profile_photo or athlete.profile_image),
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
        
        return {
            "data": formatted_assessments,
            "stats": stats,
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
                "pages": (total_count + limit - 1) // limit,
                "has_more": offset + limit < total_count
            }
        }
        
    except Exception as e:
        import traceback
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
# SINGLE ASSESSMENT DETAIL
# ============================================================================

@router.get("/assessments/{assessment_id}")
async def get_assessment_detail(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed view of a single assessment"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    # Get connected athlete IDs
    connected_athlete_ids = get_connected_athlete_ids_subquery(current_user.id, db)
    
    # Fetch assessment with athlete
    assessment = db.query(models.Assessment).options(
        joinedload(models.Assessment.user)
    ).filter(
        models.Assessment.id == assessment_id,
        models.Assessment.user_id.in_(connected_athlete_ids)
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found or access denied")
    
    athlete = assessment.user
    
    # Get athlete's assessment history for this test type
    history = db.query(models.Assessment).filter(
        models.Assessment.user_id == athlete.id,
        models.Assessment.test_type == assessment.test_type
    ).order_by(models.Assessment.created_at.desc()).limit(10).all()
    
    # Get personal best
    best_score = db.query(func.max(models.Assessment.ai_score)).filter(
        models.Assessment.user_id == athlete.id,
        models.Assessment.test_type == assessment.test_type
    ).scalar() or 0
    
    return {
        "assessment": {
            "id": assessment.id,
            "test_type": assessment.test_type,
            "score": assessment.score,
            "ai_score": assessment.ai_score,
            "ai_feedback": assessment.ai_feedback,
            "status": assessment.status,
            "video_url": assessment.video_url,
            "created_at": assessment.created_at.isoformat(),
            "is_personal_best": assessment.ai_score == best_score
        },
        "athlete": {
            "id": athlete.id,
            "name": athlete.name,
            "email": athlete.email,
            "profile_photo": get_image_url(athlete.profile_photo or athlete.profile_image),
            "sport": athlete.sport,
            "location": athlete.location,
            "age": athlete.age,
            "ai_score": athlete.ai_score,
            "national_rank": athlete.national_rank
        },
        "history": [
            {
                "id": h.id,
                "ai_score": h.ai_score,
                "created_at": h.created_at.isoformat()
            }
            for h in history
        ],
        "personal_best": best_score
    }


# ============================================================================
# ENHANCED STATISTICS ENDPOINT
# ============================================================================

@router.get("/assessments/statistics/detailed")
async def get_detailed_assessment_statistics(
    period: str = Query("all", description="all, week, month, year"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed statistics with trends and comparisons"""
    
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Access denied. Coaches only.")
    
    connected_athlete_ids = get_connected_athlete_ids_subquery(current_user.id, db)
    
    # Date filter based on period
    date_filter = None
    if period == 'week':
        date_filter = datetime.utcnow() - timedelta(days=7)
    elif period == 'month':
        date_filter = datetime.utcnow() - timedelta(days=30)
    elif period == 'year':
        date_filter = datetime.utcnow() - timedelta(days=365)
    
    # Base query
    base_query = db.query(models.Assessment).filter(
        models.Assessment.user_id.in_(connected_athlete_ids)
    )
    
    if date_filter:
        base_query = base_query.filter(models.Assessment.created_at >= date_filter)
    
    # Best scores by test type
    best_scores = base_query.with_entities(
        models.Assessment.test_type,
        func.max(models.Assessment.ai_score).label('best_score'),
        func.avg(models.Assessment.ai_score).label('avg_score'),
        func.count(models.Assessment.id).label('count')
    ).group_by(models.Assessment.test_type).all()
    
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
        models.User.id.in_(connected_athlete_ids)
    )
    
    if date_filter:
        top_performers = top_performers.filter(models.Assessment.created_at >= date_filter)
    
    top_performers = top_performers.group_by(models.User.id).order_by(
        func.avg(models.Assessment.ai_score).desc()
    ).limit(10).all()
    
    # Recent improvements (comparing last 2 assessments per athlete)
    recent_improvements = []
    athlete_ids = [a.id for a in db.query(models.User.id).filter(
        models.User.id.in_(connected_athlete_ids)
    ).all()]
    
    for athlete_id in athlete_ids[:20]:  # Limit to first 20 athletes for performance
        recent = db.query(models.Assessment).filter(
            models.Assessment.user_id == athlete_id,
            models.Assessment.ai_score.isnot(None)
        ).order_by(models.Assessment.created_at.desc()).limit(2).all()
        
        if len(recent) >= 2 and recent[0].ai_score and recent[1].ai_score:
            improvement = recent[0].ai_score - recent[1].ai_score
            if improvement > 0:
                athlete = db.query(models.User).filter(models.User.id == athlete_id).first()
                recent_improvements.append({
                    "athlete": {
                        "id": athlete.id,
                        "name": athlete.name,
                        "profile_photo": get_image_url(athlete.profile_photo or athlete.profile_image)
                    },
                    "improvement": round(improvement, 1),
                    "test_type": recent[0].test_type,
                    "current_score": recent[0].ai_score,
                    "previous_score": recent[1].ai_score
                })
    
    recent_improvements.sort(key=lambda x: x['improvement'], reverse=True)
    
    # Score distribution
    score_distribution = {
        "excellent": base_query.filter(models.Assessment.ai_score >= 80).count(),
        "good": base_query.filter(
            models.Assessment.ai_score >= 60,
            models.Assessment.ai_score < 80
        ).count(),
        "average": base_query.filter(
            models.Assessment.ai_score >= 40,
            models.Assessment.ai_score < 60
        ).count(),
        "needs_improvement": base_query.filter(models.Assessment.ai_score < 40).count()
    }
    
    return {
        "period": period,
        "best_scores_by_type": [
            {
                "test_type": bs.test_type,
                "best_score": round(bs.best_score or 0, 1),
                "average_score": round(bs.avg_score or 0, 1),
                "total_assessments": bs.count
            }
            for bs in best_scores
        ],
        "top_performers": [
            {
                "id": tp.id,
                "name": tp.name,
                "profile_photo": get_image_url(tp.profile_photo or tp.profile_image),
                "sport": tp.sport,
                "average_score": round(tp.avg_score or 0, 1),
                "assessment_count": tp.assessment_count
            }
            for tp in top_performers
        ],
        "recent_improvements": recent_improvements[:10],
        "score_distribution": score_distribution
    }