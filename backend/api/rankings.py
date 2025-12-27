# backend/api/rankings.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional
import traceback

from database import get_db
from core.dependencies import get_current_user, get_current_user_optional, get_image_url
import models

router = APIRouter(prefix="/api/rankings", tags=["rankings"])


@router.get("/national")
async def get_national_rankings(
    sport: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    """Get national rankings based on existing AI scores from assessments"""
    try:
        query = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.ai_score.isnot(None),
            models.User.ai_score > 0
        )
        
        if sport:
            query = query.filter(func.lower(models.User.sport) == sport.lower())
        
        # Order by AI score descending
        athletes = query.order_by(
            models.User.ai_score.desc()
        ).all()
        
        # Assign rankings
        rankings = []
        for rank, athlete in enumerate(athletes, 1):
            # Update rank in database
            athlete.national_rank = rank
            
            rankings.append({
                "rank": rank,
                "id": str(athlete.id),
                "name": athlete.name,
                "profile_photo": get_image_url(athlete.profile_photo or athlete.profile_image),
                "sport": athlete.sport,
                "location": athlete.location,
                "ai_score": athlete.ai_score,
                "is_verified": getattr(athlete, 'is_verified', False)
            })
        
        db.commit()
        
        # Paginate
        start = (page - 1) * limit
        end = start + limit
        paginated = rankings[start:end]
        
        return {
            "data": paginated,
            "total": len(rankings),
            "page": page,
            "has_more": end < len(rankings)
        }
        
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch rankings")


@router.get("/user/{user_id}")
async def get_user_rank(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific user's national rank based on their AI score"""
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # If user has no AI score, return null rank
        if not user.ai_score or user.ai_score <= 0:
            return {
                "user_id": user_id,
                "national_rank": None,
                "total_athletes": 0,
                "percentile": None,
                "ai_score": None,
                "message": "Complete assessments to get ranked"
            }
        
        # Count athletes with higher AI score
        higher_count = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.id != user_id,
            models.User.ai_score.isnot(None),
            models.User.ai_score > user.ai_score
        ).count()
        
        rank = higher_count + 1
        
        # Total athletes with AI scores
        total = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.ai_score.isnot(None),
            models.User.ai_score > 0
        ).count()
        
        # Calculate percentile
        percentile = round(((total - rank) / total) * 100, 1) if total > 0 else 0
        
        # Update user's national_rank
        user.national_rank = rank
        db.commit()
        
        return {
            "user_id": user_id,
            "national_rank": rank,
            "total_athletes": total,
            "percentile": percentile,
            "ai_score": user.ai_score
        }
        
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to calculate rank")


@router.get("/me")
async def get_my_rank(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's national rank"""
    try:
        # If no AI score, return null
        if not current_user.ai_score or current_user.ai_score <= 0:
            return {
                "user_id": current_user.id,
                "name": current_user.name,
                "profile_photo": get_image_url(current_user.profile_photo or current_user.profile_image),
                "sport": current_user.sport,
                "national_rank": None,
                "total_athletes": 0,
                "percentile": None,
                "ai_score": None,
                "message": "Complete assessments to get ranked"
            }
        
        # Count athletes with higher score
        higher_count = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.id != current_user.id,
            models.User.ai_score.isnot(None),
            models.User.ai_score > current_user.ai_score
        ).count()
        
        rank = higher_count + 1
        
        # Total athletes
        total = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.ai_score.isnot(None),
            models.User.ai_score > 0
        ).count()
        
        percentile = round(((total - rank) / total) * 100, 1) if total > 0 else 0
        
        # Update rank
        current_user.national_rank = rank
        db.commit()
        
        return {
            "user_id": current_user.id,
            "name": current_user.name,
            "profile_photo": get_image_url(current_user.profile_photo or current_user.profile_image),
            "sport": current_user.sport,
            "national_rank": rank,
            "total_athletes": total,
            "percentile": percentile,
            "ai_score": current_user.ai_score
        }
        
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to calculate rank")