# backend/api/search.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_ as db_or, func
from typing import Optional
import traceback

from database import get_db
from core.dependencies import get_current_user, get_current_user_optional, get_image_url
import models

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query(..., min_length=1, max_length=100),
    type: Optional[str] = Query(None, regex="^(all|athletes|coaches|posts)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=50),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Universal search endpoint
    - type: all, athletes, coaches, posts
    """
    try:
        results = {
            "athletes": [],
            "coaches": [],
            "posts": [],
            "query": q
        }
        
        search_term = f"%{q.lower()}%"
        
        # Search Athletes
        if type in [None, "all", "athletes"]:
            athletes = db.query(models.User).filter(
                models.User.role == 'athlete',
                models.User.is_active == True,
                db_or(
                    func.lower(models.User.name).like(search_term),
                    func.lower(models.User.sport).like(search_term),
                    func.lower(models.User.location).like(search_term),
                    func.lower(models.User.bio).like(search_term)
                )
            ).order_by(
                models.User.ai_score.desc().nullslast()
            ).limit(limit if type == "athletes" else 5).all()
            
            results["athletes"] = [
                {
                    "id": str(a.id),
                    "name": a.name,
                    "profile_photo": get_image_url(a.profile_photo or a.profile_image),
                    "sport": a.sport,
                    "location": a.location,
                    "ai_score": a.ai_score,
                    "national_rank": a.national_rank,
                    "is_verified": getattr(a, 'is_verified', False)
                }
                for a in athletes
            ]
        
        # Search Coaches
        if type in [None, "all", "coaches"]:
            coaches = db.query(models.User).filter(
                models.User.role == 'coach',
                models.User.is_active == True,
                db_or(
                    func.lower(models.User.name).like(search_term),
                    func.lower(models.User.sport).like(search_term),
                    func.lower(models.User.specialization).like(search_term),
                    func.lower(models.User.location).like(search_term)
                )
            ).limit(limit if type == "coaches" else 5).all()
            
            results["coaches"] = [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "profile_photo": get_image_url(c.profile_photo or c.profile_image),
                    "sport": c.sport or c.specialization,
                    "location": c.location,
                    "experience": c.experience,
                    "is_verified": getattr(c, 'is_verified', False)
                }
                for c in coaches
            ]
        
        # Search Posts
        if type in [None, "all", "posts"]:
            posts = db.query(models.Post).join(
                models.User, models.Post.user_id == models.User.id
            ).filter(
                db_or(
                    func.lower(models.Post.text).like(search_term),
                    func.lower(models.User.name).like(search_term),
                    func.lower(models.User.sport).like(search_term)
                )
            ).order_by(
                models.Post.created_at.desc()
            ).limit(limit if type == "posts" else 5).all()
            
            results["posts"] = [
                {
                    "id": str(p.id),
                    "text": p.text[:150] + "..." if len(p.text) > 150 else p.text,
                    "media_url": get_image_url(p.media_url),
                    "user": {
                        "id": str(p.user.id),
                        "name": p.user.name,
                        "profile_photo": get_image_url(p.user.profile_photo or p.user.profile_image),
                        "sport": p.user.sport
                    },
                    "likes_count": p.likes_count,
                    "comments_count": p.comments_count,
                    "created_at": p.created_at.isoformat()
                }
                for p in posts
            ]
        
        return results
        
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/suggestions")
async def get_search_suggestions(
    q: str = Query(..., min_length=1, max_length=50),
    db: Session = Depends(get_db)
):
    """Get quick search suggestions as user types"""
    try:
        search_term = f"%{q.lower()}%"
        
        # Get athlete names
        athletes = db.query(models.User.name, models.User.sport).filter(
            models.User.is_active == True,
            func.lower(models.User.name).like(search_term)
        ).limit(5).all()
        
        # Get sports
        sports = db.query(models.User.sport).filter(
            models.User.sport.isnot(None),
            func.lower(models.User.sport).like(search_term)
        ).distinct().limit(3).all()
        
        suggestions = []
        
        for name, sport in athletes:
            suggestions.append({
                "type": "athlete",
                "text": name,
                "subtext": sport
            })
        
        for (sport,) in sports:
            if sport:
                suggestions.append({
                    "type": "sport",
                    "text": sport,
                    "subtext": "Sport"
                })
        
        return {"suggestions": suggestions[:8]}
        
    except Exception:
        traceback.print_exc()
        return {"suggestions": []}