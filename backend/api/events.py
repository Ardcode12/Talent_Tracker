# backend/api/events.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Form, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_, and_
from datetime import datetime, timedelta
from typing import Optional
from database import get_db
from core.dependencies import get_current_user, get_image_url_with_fallback
from core.config import UPLOAD_DIR
import models
import shutil
from pathlib import Path

router = APIRouter(prefix="/api/events", tags=["events"])

# ============================================================================
# PUBLIC EVENT ENDPOINTS
# ============================================================================

@router.get("")
async def get_public_events(
    event_type: str = Query(None),
    sport: str = Query(None),
    location: str = Query(None),
    upcoming_only: bool = Query(True),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db)
):
    """Get approved public events"""
    query = db.query(models.Event).filter(
        models.Event.approval_status == 'approved',
        models.Event.is_public == True
    )
    
    if upcoming_only:
        query = query.filter(models.Event.start_date >= datetime.utcnow())
    
    if event_type:
        query = query.filter(models.Event.event_type == event_type)
    
    if sport:
        query = query.filter(models.Event.sport == sport)
    
    if location:
        query = query.filter(func.lower(models.Event.location).ilike(f"%{location.lower()}%"))
    
    total = query.count()
    offset = (page - 1) * limit
    events = query.order_by(models.Event.start_date).offset(offset).limit(limit).all()
    
    return {
        "data": [format_event(e) for e in events],
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    }

@router.get("/featured")
async def get_featured_events(
    limit: int = Query(5, le=20),
    db: Session = Depends(get_db)
):
    """Get featured events"""
    events = db.query(models.Event).filter(
        models.Event.approval_status == 'approved',
        models.Event.is_featured == True,
        models.Event.start_date >= datetime.utcnow()
    ).order_by(models.Event.start_date).limit(limit).all()
    
    return {"data": [format_event(e) for e in events]}

@router.get("/{event_id}")
async def get_event_detail(
    event_id: int,
    db: Session = Depends(get_db)
):
    """Get event details"""
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {
        "event": format_event(event, include_details=True),
        "creator": {
            "id": event.creator.id,
            "name": event.creator.name,
            "profile_photo": get_image_url_with_fallback(event.creator.profile_photo, event.creator.name),
            "specialization": event.creator.specialization
        } if event.creator else None
    }

# ============================================================================
# COACH EVENT MANAGEMENT
# ============================================================================

@router.post("/create")
async def create_event(
    title: str = Form(...),
    description: str = Form(None),
    event_type: str = Form(...),
    sport: str = Form(None),
    location: str = Form(None),
    venue: str = Form(None),
    is_online: bool = Form(False),
    online_link: str = Form(None),
    start_date: str = Form(...),
    end_date: str = Form(None),
    registration_deadline: str = Form(None),
    max_participants: int = Form(None),
    min_age: int = Form(None),
    max_age: int = Form(None),
    min_ai_score: float = Form(None),
    eligibility_criteria: str = Form(None),
    banner_image: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new event (Coach only)"""
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Only coaches can create events")
    
    # Parse dates
    try:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    except:
        raise HTTPException(status_code=400, detail="Invalid start date format")
    
    end_dt = None
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except:
            pass
    
    reg_deadline = None
    if registration_deadline:
        try:
            reg_deadline = datetime.fromisoformat(registration_deadline.replace('Z', '+00:00'))
        except:
            pass
    
    # Handle banner image
    banner_url = None
    if banner_image and banner_image.filename:
        events_dir = Path(UPLOAD_DIR) / "events"
        events_dir.mkdir(parents=True, exist_ok=True)
        
        ext = banner_image.filename.split(".")[-1].lower()
        filename = f"event_{current_user.id}_{datetime.now().timestamp()}.{ext}"
        filepath = events_dir / filename
        
        with open(filepath, "wb") as f:
            shutil.copyfileobj(banner_image.file, f)
        
        banner_url = f"/uploads/events/{filename}"
    
    # Create event
    event = models.Event(
        created_by=current_user.id,
        title=title,
        description=description,
        event_type=event_type,
        sport=sport or current_user.specialization or current_user.sport,
        location=location,
        venue=venue,
        is_online=is_online,
        online_link=online_link if is_online else None,
        start_date=start_dt,
        end_date=end_dt,
        registration_deadline=reg_deadline,
        max_participants=max_participants,
        min_age=min_age,
        max_age=max_age,
        min_ai_score=min_ai_score,
        eligibility_criteria=eligibility_criteria,
        banner_image=banner_url,
        approval_status="pending",
        status="pending"
    )
    
    db.add(event)
    db.commit()
    db.refresh(event)
    
    return {
        "message": "Event created successfully. Pending admin approval.",
        "event": format_event(event)
    }

@router.get("/my-events")
async def get_my_events(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get events created by current coach"""
    if current_user.role != 'coach':
        raise HTTPException(status_code=403, detail="Only coaches can access this endpoint")
    
    query = db.query(models.Event).filter(models.Event.created_by == current_user.id)
    
    if status:
        query = query.filter(models.Event.approval_status == status)
    
    total = query.count()
    offset = (page - 1) * limit
    events = query.order_by(desc(models.Event.created_at)).offset(offset).limit(limit).all()
    
    return {
        "data": [format_event(e) for e in events],
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        },
        "stats": {
            "pending": db.query(models.Event).filter(
                models.Event.created_by == current_user.id,
                models.Event.approval_status == 'pending'
            ).count(),
            "approved": db.query(models.Event).filter(
                models.Event.created_by == current_user.id,
                models.Event.approval_status == 'approved'
            ).count(),
            "rejected": db.query(models.Event).filter(
                models.Event.created_by == current_user.id,
                models.Event.approval_status == 'rejected'
            ).count()
        }
    }

@router.put("/{event_id}")
async def update_event(
    event_id: int,
    title: str = Form(None),
    description: str = Form(None),
    location: str = Form(None),
    venue: str = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update event (only if pending or rejected)"""
    event = db.query(models.Event).filter(
        models.Event.id == event_id,
        models.Event.created_by == current_user.id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event.approval_status == 'approved':
        raise HTTPException(status_code=400, detail="Cannot edit approved events")
    
    if title:
        event.title = title
    if description:
        event.description = description
    if location:
        event.location = location
    if venue:
        event.venue = venue
    
    # Reset to pending if was rejected
    if event.approval_status == 'rejected':
        event.approval_status = 'pending'
        event.rejection_reason = None
    
    db.commit()
    
    return {
        "message": "Event updated successfully",
        "event": format_event(event)
    }

@router.delete("/{event_id}")
async def delete_my_event(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete own event"""
    event = db.query(models.Event).filter(
        models.Event.id == event_id,
        models.Event.created_by == current_user.id
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.delete(event)
    db.commit()
    
    return {"message": "Event deleted successfully"}

# ============================================================================
# EVENT REGISTRATION
# ============================================================================

@router.post("/{event_id}/register")
async def register_for_event(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register for an event"""
    event = db.query(models.Event).filter(
        models.Event.id == event_id,
        models.Event.approval_status == 'approved'
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check eligibility
    if event.min_age and current_user.age and current_user.age < event.min_age:
        raise HTTPException(status_code=400, detail=f"Minimum age requirement: {event.min_age}")
    
    if event.max_age and current_user.age and current_user.age > event.max_age:
        raise HTTPException(status_code=400, detail=f"Maximum age requirement: {event.max_age}")
    
    if event.min_ai_score and current_user.ai_score and current_user.ai_score < event.min_ai_score:
        raise HTTPException(status_code=400, detail=f"Minimum AI score requirement: {event.min_ai_score}")
    
    # Check capacity
    if event.max_participants and event.current_participants >= event.max_participants:
        raise HTTPException(status_code=400, detail="Event is full")
    
    # Check if already registered
    existing = db.query(models.EventRegistration).filter(
        models.EventRegistration.event_id == event_id,
        models.EventRegistration.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Already registered for this event")
    
    # Create registration
    registration = models.EventRegistration(
        event_id=event_id,
        user_id=current_user.id,
        status="registered"
    )
    db.add(registration)
    
    event.current_participants = (event.current_participants or 0) + 1
    db.commit()
    
    return {"message": "Successfully registered for event"}

@router.delete("/{event_id}/register")
async def cancel_registration(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel event registration"""
    registration = db.query(models.EventRegistration).filter(
        models.EventRegistration.event_id == event_id,
        models.EventRegistration.user_id == current_user.id
    ).first()
    
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if event:
        event.current_participants = max(0, (event.current_participants or 1) - 1)
    
    db.delete(registration)
    db.commit()
    
    return {"message": "Registration cancelled"}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def format_event(event, include_details=False):
    """Format event for API response"""
    data = {
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
        "current_participants": event.current_participants or 0,
        "approval_status": event.approval_status,
        "status": event.status,
        "is_featured": event.is_featured,
        "banner_image": event.banner_image,
        "created_at": event.created_at.isoformat() if event.created_at else None
    }
    
    if include_details:
        data.update({
            "online_link": event.online_link,
            "registration_deadline": event.registration_deadline.isoformat() if event.registration_deadline else None,
            "min_age": event.min_age,
            "max_age": event.max_age,
            "min_ai_score": event.min_ai_score,
            "eligibility_criteria": event.eligibility_criteria,
            "rejection_reason": event.rejection_reason
        })
    
    return data