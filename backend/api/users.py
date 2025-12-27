# backend/api/users.py
# backend/api/users.py - Line with error
from sqlalchemy import or_ as db_or, and_ as db_and  # ADD THIS IMPORT AT TOP
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, Dict, Tuple
from core.dependencies import get_current_user, get_current_user_optional, get_image_url
from core.config import UPLOAD_DIR
from database import get_db
import crud, models, schemas
from datetime import datetime, timedelta
import shutil
import traceback

router = APIRouter(prefix="/api/users", tags=["users"])


# ============================================================================
# SCORE CALCULATION FUNCTIONS
# ============================================================================

def calculate_average_of_all_scores(user_id: int, db: Session) -> Optional[float]:
    """
    Calculate average AI score from ALL assessments for a user.
    Used for Assessment page statistics.
    """
    result = db.query(
        func.avg(models.Assessment.ai_score).label('avg_score')
    ).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.ai_score.isnot(None),
        models.Assessment.ai_score > 0
    ).first()
    
    if result and result.avg_score:
        return round(float(result.avg_score), 1)
    return None


def calculate_average_of_best_scores(user_id: int, db: Session) -> Tuple[Optional[float], Dict[str, float]]:
    """
    Calculate AI score as average of BEST scores per assessment type.
    Used for Home page display and National Ranking.
    
    Returns:
        tuple: (overall_best_average, dict of best scores by type)
    """
    # Get best score for each test type
    best_scores_query = db.query(
        models.Assessment.test_type,
        func.max(models.Assessment.ai_score).label('best_score')
    ).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.ai_score.isnot(None),
        models.Assessment.ai_score > 0
    ).group_by(models.Assessment.test_type).all()
    
    if not best_scores_query:
        return None, {}
    
    # Create dict of best scores by type
    best_scores_by_type = {
        row.test_type: round(float(row.best_score), 1) 
        for row in best_scores_query
    }
    
    # Calculate average of best scores
    best_scores = [row.best_score for row in best_scores_query if row.best_score]
    
    if best_scores:
        overall_best_average = round(sum(best_scores) / len(best_scores), 1)
        return overall_best_average, best_scores_by_type
    
    return None, best_scores_by_type


def calculate_user_rank(user_id: int, ai_score: float, db: Session) -> Optional[int]:
    """Calculate user's national rank based on AI score (best average)"""
    if not ai_score or ai_score <= 0:
        return None
    
    higher_count = db.query(models.User).filter(
        models.User.role == 'athlete',
        models.User.is_active == True,
        models.User.id != user_id,
        models.User.ai_score.isnot(None),
        models.User.ai_score > ai_score
    ).count()
    
    return higher_count + 1


def calculate_weekly_progress(user_id: int, db: Session) -> float:
    """Calculate weekly progress based on recent assessments"""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    
    # This week's average
    this_week = db.query(func.avg(models.Assessment.ai_score)).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.created_at >= week_ago,
        models.Assessment.ai_score.isnot(None),
        models.Assessment.ai_score > 0
    ).scalar()
    
    # Last week's average
    last_week = db.query(func.avg(models.Assessment.ai_score)).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.created_at >= two_weeks_ago,
        models.Assessment.created_at < week_ago,
        models.Assessment.ai_score.isnot(None),
        models.Assessment.ai_score > 0
    ).scalar()
    
    if this_week and last_week and last_week > 0:
        progress = ((this_week - last_week) / last_week) * 100
        return round(progress, 1)
    elif this_week:
        return 0.0  # First week, no progress to compare
    
    return 0.0


def update_user_scores_and_rank(user_id: int, db: Session) -> Tuple[Optional[float], Optional[int]]:
    """
    Recalculate and update user's AI score (best average) and national rank.
    Returns: (new_ai_score, new_rank)
    """
    # Calculate average of best scores
    ai_score, _ = calculate_average_of_best_scores(user_id, db)
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None, None
    
    # Update AI score
    user.ai_score = ai_score
    db.commit()
    
    # Calculate and update rank
    rank = None
    if ai_score and ai_score > 0:
        rank = calculate_user_rank(user_id, ai_score, db)
        user.national_rank = rank
        db.commit()
    
    return ai_score, rank


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/me", response_model=schemas.UserProfile)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/stats")
async def get_user_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user stats with AI score calculated as average of BEST scores per assessment type.
    This is used by Home page for display and ranking.
    """
    try:
        # Calculate AI score as average of BEST scores per type
        ai_score, best_scores_by_type = calculate_average_of_best_scores(current_user.id, db)
        
        # Update user's AI score in database
        if ai_score:
            current_user.ai_score = ai_score
            db.commit()
        
        # Calculate national rank based on best average
        national_rank = calculate_user_rank(current_user.id, ai_score or 0, db)
        
        # Update national rank in database
        if national_rank:
            current_user.national_rank = national_rank
            db.commit()
        
        # Calculate weekly progress
        weekly_progress = calculate_weekly_progress(current_user.id, db)
        current_user.weekly_progress = weekly_progress
        db.commit()
        
        # Get total athletes for context
        total_athletes = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.ai_score.isnot(None),
            models.User.ai_score > 0
        ).count()
        
        # Calculate percentile
        percentile = None
        if national_rank and total_athletes > 0:
            percentile = round(((total_athletes - national_rank) / total_athletes) * 100, 1)
        
        # Get assessment breakdown with both average and best scores
        assessment_stats = db.query(
            models.Assessment.test_type,
            func.avg(models.Assessment.ai_score).label('avg_score'),
            func.max(models.Assessment.ai_score).label('best_score'),
            func.count(models.Assessment.id).label('count')
        ).filter(
            models.Assessment.user_id == current_user.id,
            models.Assessment.ai_score.isnot(None),
            models.Assessment.ai_score > 0
        ).group_by(models.Assessment.test_type).all()
        
        assessment_breakdown = {
            stat.test_type: {
                "average": round(stat.avg_score, 1) if stat.avg_score else 0,
                "best": round(stat.best_score, 1) if stat.best_score else 0,
                "count": stat.count
            }
            for stat in assessment_stats
        }
        
        return {
            "data": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "profilePhoto": get_image_url(current_user.profile_photo or current_user.profile_image),
                "sport": current_user.sport,
                "location": current_user.location,
                "role": current_user.role,
                "nationalRank": national_rank,
                "totalAthletes": total_athletes,
                "aiScore": ai_score,  # Average of BEST scores per type
                "weeklyProgress": weekly_progress,
                "percentile": percentile,
                "bestScoresByType": best_scores_by_type,
                "assessmentBreakdown": assessment_breakdown,
                "isVerified": getattr(current_user, 'is_verified', False),
                "scoreCalculation": "Average of best scores per assessment type"
            }
        }
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch user stats")


@router.get("/stats/detailed")
async def get_detailed_user_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed stats including all assessment scores with explanation"""
    try:
        # Get all assessments
        assessments = db.query(models.Assessment).filter(
            models.Assessment.user_id == current_user.id,
            models.Assessment.ai_score.isnot(None)
        ).order_by(models.Assessment.created_at.desc()).all()
        
        # Calculate both score types
        average_all_score = calculate_average_of_all_scores(current_user.id, db)
        best_average_score, best_scores_by_type = calculate_average_of_best_scores(current_user.id, db)
        national_rank = calculate_user_rank(current_user.id, best_average_score or 0, db)
        
        # Group assessments by type
        by_type = {}
        for assessment in assessments:
            if assessment.test_type not in by_type:
                by_type[assessment.test_type] = []
            by_type[assessment.test_type].append({
                "id": assessment.id,
                "score": assessment.ai_score,
                "date": assessment.created_at.isoformat(),
                "feedback": assessment.ai_feedback
            })
        
        # Calculate stats for each type
        type_stats = {}
        for test_type, scores in by_type.items():
            all_scores = [s["score"] for s in scores if s["score"]]
            if all_scores:
                type_stats[test_type] = {
                    "average": round(sum(all_scores) / len(all_scores), 1),
                    "best": round(max(all_scores), 1),
                    "count": len(all_scores),
                    "allScores": scores
                }
        
        return {
            "user": {
                "id": current_user.id,
                "name": current_user.name,
                "profilePhoto": get_image_url(current_user.profile_photo or current_user.profile_image),
                "sport": current_user.sport
            },
            "scores": {
                "averageOfAll": average_all_score,  # For Assessment page
                "averageOfBest": best_average_score,  # For Home page / Ranking
                "bestByType": best_scores_by_type
            },
            "nationalRank": national_rank,
            "totalAssessments": len(assessments),
            "byTestType": type_stats,
            "explanation": {
                "homePageScore": "Average of best scores per assessment type",
                "assessmentPageScore": "Average of all assessment scores",
                "rankingBasis": "Average of best scores per assessment type"
            }
        }
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch detailed stats")


@router.put("/profile")
async def update_profile(
    age: int = Form(...),
    location: str = Form(...),
    userId: int = Form(...),
    bio: str = Form(None),
    height: str = Form(None),
    weight: str = Form(None),
    achievements: str = Form(None),
    skills: str = Form(None),
    profileImage: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    try:
        user = db.query(models.User).filter(models.User.id == userId).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"User with id {userId} not found")

        user.age = age
        user.location = location.strip()
        if bio:
            user.bio = bio.strip()
        if height:
            user.height = height.strip()
        if weight:
            user.weight = weight.strip()
        if achievements:
            user.achievements = achievements
        if skills:
            user.skills = skills

        if profileImage and profileImage.filename:
            extension = profileImage.filename.split(".")[-1].lower()
            if extension == "jpeg":
                extension = "jpg"
            file_name = f"profile_{userId}_{datetime.now().timestamp()}.{extension}"
            file_path = UPLOAD_DIR / file_name

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(profileImage.file, buffer)

            image_url = f"/uploads/{file_name}"
            user.profile_image = image_url
            user.profile_photo = image_url

        # Recalculate AI score and rank using BEST average
        ai_score, national_rank = update_user_scores_and_rank(userId, db)

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
                "profile_image": get_image_url(user.profile_image),
                "profile_photo": get_image_url(user.profile_photo),
                "role": user.role,
                "sport": user.sport,
                "phone": user.phone,
                "ai_score": user.ai_score,
                "national_rank": user.national_rank
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Add this endpoint to backend/api/users.py

# backend/api/users.py - Add these imports at the top


# Replace the get_user_by_id endpoint with this complete version:
@router.get("/{user_id}")
async def get_user_by_id(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific user's public profile by ID"""
    try:
        user = db.query(models.User).filter(
            models.User.id == user_id,
            models.User.is_active == True
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check connection status
        connection = db.query(models.connections).filter(
            db_or(
                db_and(
                    models.connections.c.user_id == current_user.id,
                    models.connections.c.connected_user_id == user_id
                ),
                db_and(
                    models.connections.c.user_id == user_id,
                    models.connections.c.connected_user_id == current_user.id
                )
            )
        ).first()
        
        connection_status = None
        if connection:
            connection_status = connection.status
        
        # Get user's assessment stats
        assessment_count = db.query(models.Assessment).filter(
            models.Assessment.user_id == user_id,
            models.Assessment.ai_score.isnot(None)
        ).count()
        
        # Get connection count
        connection_count = db.query(models.connections).filter(
            db_or(
                models.connections.c.user_id == user_id,
                models.connections.c.connected_user_id == user_id
            ),
            models.connections.c.status == 'accepted'
        ).count()
        
        return {
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email if connection_status == 'accepted' or user.id == current_user.id else None,
                "phone": user.phone if connection_status == 'accepted' or user.id == current_user.id else None,
                "role": user.role,
                "sport": user.sport,
                "location": user.location,
                "age": user.age,
                "bio": user.bio,
                "height": user.height,
                "weight": user.weight,
                "achievements": user.achievements,
                "profile_photo": get_image_url(user.profile_photo or user.profile_image),
                "profile_image": get_image_url(user.profile_image),
                "ai_score": user.ai_score,
                "national_rank": user.national_rank,
                "experience": user.experience,
                "is_online": user.is_online,
                "is_verified": user.is_verified,
                "assessment_count": assessment_count,
                "connection_count": connection_count,
                "created_at": user.created_at.isoformat() if user.created_at else None
            },
            "connection_status": connection_status,
            "is_own_profile": user.id == current_user.id
        }
        
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch user")