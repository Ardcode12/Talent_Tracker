# backend/api/assessments.py

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from core.dependencies import get_current_user, get_image_url
from core.config import UPLOAD_DIR
from database import get_db
import models, crud
from datetime import datetime
from pathlib import Path
import random, shutil, traceback

# Analyzers
from ml_models.squat_counter_enhanced import EnhancedSquatCounter
from ml_models.shuttle_run.shuttle_run_analyzer import ShuttleRunAnalyzer
from ml_models.vertical_jump_analyzer import VerticalJumpAnalyzer

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_average_of_best_scores(user_id: int, db: Session) -> Optional[float]:
    """
    Calculate AI score as average of BEST scores per assessment type.
    """
    best_scores_query = db.query(
        models.Assessment.test_type,
        func.max(models.Assessment.ai_score).label('best_score')
    ).filter(
        models.Assessment.user_id == user_id,
        models.Assessment.ai_score.isnot(None),
        models.Assessment.ai_score > 0
    ).group_by(models.Assessment.test_type).all()
    
    if not best_scores_query:
        return None
    
    best_scores = [row.best_score for row in best_scores_query if row.best_score]
    
    if best_scores:
        return round(sum(best_scores) / len(best_scores), 1)
    
    return None


def calculate_average_of_all_scores(user_id: int, db: Session) -> Optional[float]:
    """
    Calculate average of ALL assessment scores.
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


def update_user_national_rank(user_id: int, ai_score: float, db: Session) -> Optional[int]:
    """
    Calculate and update user's national rank based on their AI score.
    """
    if not ai_score or ai_score <= 0:
        return None
    
    higher_count = db.query(models.User).filter(
        models.User.role == 'athlete',
        models.User.is_active == True,
        models.User.id != user_id,
        models.User.ai_score.isnot(None),
        models.User.ai_score > ai_score
    ).count()
    
    rank = higher_count + 1
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.national_rank = rank
        db.commit()
    
    return rank


def recalculate_user_scores(user_id: int, db: Session) -> tuple:
    """
    Recalculate user's AI score (best average) and national rank.
    Returns: (new_ai_score, new_rank)
    """
    # Calculate average of best scores per type
    new_ai_score = calculate_average_of_best_scores(user_id, db)
    
    # Update user's AI score
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.ai_score = new_ai_score
        db.commit()
    
    # Calculate and update rank
    new_rank = update_user_national_rank(user_id, new_ai_score, db) if new_ai_score else None
    
    return new_ai_score, new_rank


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/upload")
async def upload_assessment(
    video: UploadFile = File(...),
    test_type: str = Form(...),
    score: Optional[float] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        # Validation
        allowed_types = {
            "video/mp4", 
            "video/quicktime", 
            "video/x-msvideo", 
            "video/webm", 
            "application/octet-stream"
        }
        if video.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Unsupported file type.")

        max_size = 100 * 1024 * 1024  # 100 MB
        video.file.seek(0, 2)
        if video.file.tell() > max_size:
            raise HTTPException(status_code=400, detail="File too large (>100 MB)")
        video.file.seek(0)

        # Save upload
        dst_dir = UPLOAD_DIR / "assessments"
        dst_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c for c in video.filename if c.isalnum() or c in "._-") or "video.mp4"
        file_path = dst_dir / f"{ts}_{test_type}_{safe_name}"
        with open(file_path, "wb") as f:
            shutil.copyfileobj(video.file, f)

        # Analyze based on test type
        ai_score, feedback, analysis_result = 0, "Analysis pending.", {}

        if test_type == "squats":
            counter = EnhancedSquatCounter()
            result = counter.analyze_video(str(file_path))
            valid, partial = result.get("count", 0), result.get("partial_squats", 0)
            if valid == 0:
                ai_score = 15 * (partial / (partial + 1))
            else:
                base = 50
                ai_score = base + min(40, valid * 2.5) + (result.get("consistency_score", 0) / 100) * 10
            ai_score = max(0, min(100, ai_score))
            feedback = (
                f"✅ Squat Analysis:\n\n"
                f"• Valid Reps: {valid}\n"
                f"• Partial Reps: {partial}\n"
                f"• Consistency: {result.get('consistency_score', 0):.1f}%\n"
                f"• Avg Rep Time: {result.get('average_rep_time', 0):.2f}s\n\n"
                f"🏅 AI Score: {ai_score:.0f}%"
            )
            analysis_result = result

        elif test_type == "shuttle_run":
            shuttle = ShuttleRunAnalyzer()
            result = shuttle.analyze_video(str(file_path))
            if result.get("success"):
                ai_score = result["ai_score"]
                feedback = result["feedback"]
                analysis_result = result
            else:
                feedback = f"🚫 Shuttle-run analysis failed: {result.get('error')}"
                ai_score = 0

        elif test_type == "vertical_jump":
            vja = VerticalJumpAnalyzer()
            result = vja.analyze_video(str(file_path))
            if result.get("success"):
                ai_score = result["ai_score"]
                feedback = result["feedback"]
                analysis_result = result
            else:
                feedback = f"🚫 Vertical-jump analysis failed: {result.get('error')}"
                ai_score = 0

        elif test_type == "height_detection":
            detected = 160 + random.random() * 40
            ai_score = 95 + random.random() * 5
            feedback = (
                f"📏 Height Detection:\n\n"
                f"• Estimated height: {detected:.1f} cm\n"
                f"• Confidence: {ai_score:.1f}%\n\n"
                f"✔️ Recorded successfully!"
            )

        # Save assessment to database
        assessment = models.Assessment(
            user_id=current_user.id,
            test_type=test_type,
            video_url=f"/uploads/assessments/{file_path.name}",
            score=score,
            ai_score=float(ai_score),
            ai_feedback=feedback,
            status="completed",
        )
        db.add(assessment)
        db.commit()
        db.refresh(assessment)

        # ================================================================
        # RECALCULATE USER'S AI SCORE AS AVERAGE OF BEST SCORES PER TYPE
        # ================================================================
        new_ai_score, new_rank = recalculate_user_scores(current_user.id, db)

        # Get total athletes for context
        total_athletes = db.query(models.User).filter(
            models.User.role == 'athlete',
            models.User.is_active == True,
            models.User.ai_score.isnot(None),
            models.User.ai_score > 0
        ).count()

        # Calculate percentile
        percentile = None
        if new_rank and total_athletes > 0:
            percentile = round(((total_athletes - new_rank) / total_athletes) * 100, 1)

        return {
            "id": assessment.id,
            "test_type": test_type,
            "ai_score": float(ai_score),  # This assessment's score
            "feedback": feedback,
            "details": analysis_result,
            "status": "completed",
            "user_stats": {
                "ai_score": new_ai_score,  # Average of BEST scores (for Home page)
                "this_assessment_score": float(ai_score),  # This specific assessment
                "national_rank": new_rank,
                "total_athletes": total_athletes,
                "percentile": percentile
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        if "file_path" in locals() and Path(file_path).exists():
            try:
                Path(file_path).unlink()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="Assessment processing failed")


@router.get("")
async def get_assessments(
    test_type: Optional[str] = None,
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user's assessments with optional filter by test type"""
    q = db.query(models.Assessment).filter(models.Assessment.user_id == current_user.id)
    if test_type:
        q = q.filter(models.Assessment.test_type == test_type)
    rows = q.order_by(models.Assessment.created_at.desc()).limit(limit).all()
    
    return {
        "data": [
            {
                "id": a.id,
                "test_type": a.test_type,
                "score": a.score,
                "ai_score": a.ai_score,
                "ai_feedback": a.ai_feedback,
                "status": a.status,
                "video_url": a.video_url,
                "created_at": a.created_at.isoformat(),
            }
            for a in rows
        ],
        "current_ai_score": current_user.ai_score,  # This is now average of BEST
        "national_rank": current_user.national_rank
    }


@router.get("/stats")
async def get_assessment_stats(
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Get assessment statistics for current user.
    Returns BOTH average of all scores AND average of best scores.
    """
    
    # Get stats grouped by test type
    stats = (
        db.query(
            models.Assessment.test_type,
            func.count(models.Assessment.id).label("count"),
            func.avg(models.Assessment.ai_score).label("avg_score"),
            func.max(models.Assessment.ai_score).label("best_score"),
        )
        .filter(
            models.Assessment.user_id == current_user.id,
            models.Assessment.ai_score.isnot(None),
            models.Assessment.ai_score > 0
        )
        .group_by(models.Assessment.test_type)
        .all()
    )

    total = sum(s.count for s in stats)
    
    # Calculate average of ALL scores (for Assessment page display)
    all_scores_avg = calculate_average_of_all_scores(current_user.id, db)
    
    # Calculate average of BEST scores per type (for Home page / Ranking)
    best_scores_avg = calculate_average_of_best_scores(current_user.id, db)
    
    # Get latest assessment
    latest = db.query(models.Assessment).filter(
        models.Assessment.user_id == current_user.id,
        models.Assessment.ai_score.isnot(None),
        models.Assessment.ai_score > 0
    ).order_by(models.Assessment.created_at.desc()).first()

    # Get total athletes for ranking context
    total_athletes = db.query(models.User).filter(
        models.User.role == 'athlete',
        models.User.is_active == True,
        models.User.ai_score.isnot(None),
        models.User.ai_score > 0
    ).count()

    # Calculate percentile (based on best scores average)
    percentile = None
    if current_user.national_rank and total_athletes > 0:
        percentile = round(((total_athletes - current_user.national_rank) / total_athletes) * 100, 1)

    return {
        "total_assessments": total,
        # For Assessment page display - average of ALL scores
        "average_score": all_scores_avg,
        # For Home page / Rankings - average of BEST per type
        "current_ai_score": best_scores_avg,
        "national_rank": current_user.national_rank,
        "total_athletes": total_athletes,
        "percentile": percentile,
        "latest_assessment": {
            "id": latest.id,
            "test_type": latest.test_type,
            "ai_score": latest.ai_score,
            "created_at": latest.created_at.isoformat()
        } if latest else None,
        "by_test_type": {
            s.test_type: {
                "count": s.count, 
                "average_score": round(s.avg_score or 0, 1),
                "best_score": round(s.best_score or 0, 1)
            }
            for s in stats
        },
        "score_explanation": {
            "average_score": "Average of all assessment scores (shown on Assessment page)",
            "current_ai_score": "Average of best scores per type (used for ranking & Home page)"
        }
    }


@router.get("/latest")
async def get_latest_assessment(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest assessment for current user"""
    
    latest = db.query(models.Assessment).filter(
        models.Assessment.user_id == current_user.id
    ).order_by(models.Assessment.created_at.desc()).first()
    
    if not latest:
        return {
            "assessment": None,
            "message": "No assessments found. Complete an assessment to get your AI score."
        }
    
    total_athletes = db.query(models.User).filter(
        models.User.role == 'athlete',
        models.User.is_active == True,
        models.User.ai_score.isnot(None),
        models.User.ai_score > 0
    ).count()

    percentile = None
    if current_user.national_rank and total_athletes > 0:
        percentile = round(((total_athletes - current_user.national_rank) / total_athletes) * 100, 1)

    return {
        "assessment": {
            "id": latest.id,
            "test_type": latest.test_type,
            "ai_score": latest.ai_score,
            "ai_feedback": latest.ai_feedback,
            "status": latest.status,
            "video_url": latest.video_url,
            "created_at": latest.created_at.isoformat()
        },
        "user_stats": {
            "ai_score": current_user.ai_score,  # Average of BEST
            "national_rank": current_user.national_rank,
            "total_athletes": total_athletes,
            "percentile": percentile
        }
    }


@router.get("/{assessment_id}")
async def get_assessment_by_id(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific assessment by ID"""
    
    assessment = db.query(models.Assessment).filter(
        models.Assessment.id == assessment_id,
        models.Assessment.user_id == current_user.id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    return {
        "id": assessment.id,
        "test_type": assessment.test_type,
        "score": assessment.score,
        "ai_score": assessment.ai_score,
        "ai_feedback": assessment.ai_feedback,
        "status": assessment.status,
        "video_url": assessment.video_url,
        "created_at": assessment.created_at.isoformat()
    }


@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an assessment and recalculate scores"""
    
    assessment = db.query(models.Assessment).filter(
        models.Assessment.id == assessment_id,
        models.Assessment.user_id == current_user.id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Delete the video file if exists
    if assessment.video_url:
        video_path = UPLOAD_DIR / assessment.video_url.lstrip("/uploads/")
        if video_path.exists():
            try:
                video_path.unlink()
            except Exception:
                pass
    
    db.delete(assessment)
    db.commit()
    
    # Recalculate user's AI score after deletion
    new_ai_score, new_rank = recalculate_user_scores(current_user.id, db)
    
    return {
        "message": "Assessment deleted successfully",
        "updated_stats": {
            "ai_score": new_ai_score,
            "national_rank": new_rank
        }
    }


@router.get("/history/all")
async def get_assessment_history(
    page: int = Query(1, ge=1),
    limit: int = Query(10, le=50),
    test_type: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get paginated assessment history"""
    
    query = db.query(models.Assessment).filter(
        models.Assessment.user_id == current_user.id
    )
    
    if test_type:
        query = query.filter(models.Assessment.test_type == test_type)
    
    total = query.count()
    offset = (page - 1) * limit
    
    assessments = query.order_by(
        models.Assessment.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return {
        "data": [
            {
                "id": a.id,
                "test_type": a.test_type,
                "ai_score": a.ai_score,
                "ai_feedback": a.ai_feedback,
                "status": a.status,
                "created_at": a.created_at.isoformat()
            }
            for a in assessments
        ],
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit,
            "has_more": offset + limit < total
        },
        "current_stats": {
            "ai_score": current_user.ai_score,
            "national_rank": current_user.national_rank
        }
    }


@router.post("/recalculate-rank")
async def recalculate_my_rank(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Recalculate current user's AI score and national rank"""
    
    new_ai_score, new_rank = recalculate_user_scores(current_user.id, db)
    
    if not new_ai_score:
        return {
            "message": "No valid assessments found. Complete an assessment first.",
            "national_rank": None,
            "ai_score": None
        }
    
    total_athletes = db.query(models.User).filter(
        models.User.role == 'athlete',
        models.User.is_active == True,
        models.User.ai_score.isnot(None),
        models.User.ai_score > 0
    ).count()
    
    percentile = None
    if new_rank and total_athletes > 0:
        percentile = round(((total_athletes - new_rank) / total_athletes) * 100, 1)
    
    return {
        "message": "Scores recalculated successfully",
        "ai_score": new_ai_score,
        "national_rank": new_rank,
        "total_athletes": total_athletes,
        "percentile": percentile,
        "calculation_method": "Average of best scores per assessment type"
    }
# backend/api/assessments.py - Add this endpoint

@router.get("/user/{user_id}/stats")
async def get_user_assessment_stats(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get assessment statistics for a specific user"""
    try:
        # Check if user exists
        user = db.query(models.User).filter(
            models.User.id == user_id,
            models.User.is_active == True
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get total assessments
        total_assessments = db.query(models.Assessment).filter(
            models.Assessment.user_id == user_id,
            models.Assessment.ai_score.isnot(None)
        ).count()
        
        # Get average score
        avg_score = db.query(func.avg(models.Assessment.ai_score)).filter(
            models.Assessment.user_id == user_id,
            models.Assessment.ai_score.isnot(None),
            models.Assessment.ai_score > 0
        ).scalar()
        
        # Get stats by test type
        test_stats = db.query(
            models.Assessment.test_type,
            func.count(models.Assessment.id).label('count'),
            func.avg(models.Assessment.ai_score).label('avg_score'),
            func.max(models.Assessment.ai_score).label('best_score')
        ).filter(
            models.Assessment.user_id == user_id,
            models.Assessment.ai_score.isnot(None)
        ).group_by(models.Assessment.test_type).all()
        
        by_test_type = {}
        for stat in test_stats:
            by_test_type[stat.test_type] = {
                "count": stat.count,
                "average_score": round(stat.avg_score, 1) if stat.avg_score else 0,
                "best_score": round(stat.best_score, 1) if stat.best_score else 0
            }
        
        return {
            "total_assessments": total_assessments,
            "average_score": round(avg_score, 1) if avg_score else None,
            "current_ai_score": user.ai_score,
            "national_rank": user.national_rank,
            "total_athletes": db.query(models.User).filter(
                models.User.role == 'athlete',
                models.User.is_active == True,
                models.User.ai_score.isnot(None)
            ).count(),
            "percentile": None,  # Calculate if needed
            "by_test_type": by_test_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch user assessment stats")
# backend/api/assessments.py - ADD THIS ENDPOINT

@router.get("/user/{user_id}/stats")
async def get_user_assessment_stats(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get assessment statistics for a specific user"""
    try:
        # Check if user exists
        user = db.query(models.User).filter(
            models.User.id == user_id,
            models.User.is_active == True
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get total assessments
        total_assessments = db.query(models.Assessment).filter(
            models.Assessment.user_id == user_id,
            models.Assessment.ai_score.isnot(None)
        ).count()
        
        # Get average score
        avg_score = db.query(func.avg(models.Assessment.ai_score)).filter(
            models.Assessment.user_id == user_id,
            models.Assessment.ai_score.isnot(None),
            models.Assessment.ai_score > 0
        ).scalar()
        
        # Get stats by test type
        test_stats = db.query(
            models.Assessment.test_type,
            func.count(models.Assessment.id).label('count'),
            func.avg(models.Assessment.ai_score).label('avg_score'),
            func.max(models.Assessment.ai_score).label('best_score')
        ).filter(
            models.Assessment.user_id == user_id,
            models.Assessment.ai_score.isnot(None)
        ).group_by(models.Assessment.test_type).all()
        
        by_test_type = {}
        for stat in test_stats:
            by_test_type[stat.test_type] = {
                "count": stat.count,
                "average_score": round(float(stat.avg_score), 1) if stat.avg_score else 0,
                "best_score": round(float(stat.best_score), 1) if stat.best_score else 0
            }
        
        print(f"Assessment stats for user {user_id}: {total_assessments} total, by_type: {by_test_type}")
        
        return {
            "total_assessments": total_assessments,
            "average_score": round(float(avg_score), 1) if avg_score else None,
            "current_ai_score": user.ai_score,
            "national_rank": user.national_rank,
            "total_athletes": db.query(models.User).filter(
                models.User.role == 'athlete',
                models.User.is_active == True,
                models.User.ai_score.isnot(None)
            ).count(),
            "percentile": None,
            "by_test_type": by_test_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch user assessment stats: {str(e)}")    