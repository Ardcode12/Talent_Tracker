# backend/api/events.py
import shutil
import traceback
from datetime import datetime
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.dependencies import get_current_user, get_image_url
from core.config import UPLOAD_DIR
from database import get_db
import models

router = APIRouter(prefix="/api/events", tags=["events"])


# ============================================================================
# HELPER
# ============================================================================

def _event_to_dict(event: models.Event, db: Session, current_user_id: int) -> dict:
    """Serialize an event with registration info."""
    reg_count = db.query(models.EventRegistration).filter(
        models.EventRegistration.event_id == event.id,
        models.EventRegistration.status == "registered"
    ).count()

    is_registered = db.query(models.EventRegistration).filter(
        models.EventRegistration.event_id == event.id,
        models.EventRegistration.user_id == current_user_id
    ).first() is not None

    creator = db.query(models.User).filter(models.User.id == event.created_by).first()

    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "event_type": event.event_type,
        "sport": event.sport,
        "location": event.location,
        "venue": event.venue,
        "is_online": event.is_online,
        "online_link": event.online_link,
        "start_date": event.start_date.isoformat() if event.start_date else None,
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "registration_deadline": event.registration_deadline.isoformat() if event.registration_deadline else None,
        "max_participants": event.max_participants,
        "current_participants": reg_count,
        "min_age": event.min_age,
        "max_age": event.max_age,
        "min_ai_score": event.min_ai_score,
        "eligibility_criteria": event.eligibility_criteria,
        "banner_image": get_image_url(event.banner_image) if event.banner_image else None,
        "status": event.status,
        "approval_status": event.approval_status,
        "is_public": event.is_public,
        "is_featured": event.is_featured,
        "created_by": event.created_by,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "is_registered": is_registered,
        "slots_left": (event.max_participants - reg_count) if event.max_participants else None,
        "creator": {
            "id": creator.id,
            "name": creator.name,
            "sport": creator.sport,
            "profile_photo": get_image_url(creator.profile_photo or creator.profile_image),
        } if creator else None,
    }


# ============================================================================
# LIST EVENTS
# ============================================================================

@router.get("/")
async def list_events(
    event_type: Optional[str] = None,
    sport: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all active/approved events. Coaches see their own pending ones too."""
    query = db.query(models.Event).filter(models.Event.is_public == True)

    # Coaches also see their own unpublished events
    if current_user.role == "coach":
        from sqlalchemy import or_
        query = db.query(models.Event).filter(
            or_(
                models.Event.is_public == True,
                models.Event.created_by == current_user.id
            )
        )

    if event_type and event_type != "All":
        query = query.filter(models.Event.event_type == event_type)
    if sport:
        query = query.filter(models.Event.sport == sport)

    events = query.order_by(models.Event.start_date.asc()).offset(skip).limit(limit).all()

    return {
        "data": [_event_to_dict(e, db, current_user.id) for e in events],
        "total": query.count(),
    }


# ============================================================================
# GET SINGLE EVENT
# ============================================================================

@router.get("/{event_id}")
async def get_event(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"data": _event_to_dict(event, db, current_user.id)}


# ============================================================================
# CREATE EVENT (Coach only)
# ============================================================================

@router.post("/")
async def create_event(
    title: str = Form(...),
    event_type: str = Form(...),
    description: str = Form(None),
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
    banner: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can create events")
    if current_user.coach_verify_status != "approved":
        raise HTTPException(status_code=403, detail="Your coach credentials must be verified before creating events")

    banner_url = None
    if banner and banner.filename:
        banner_dir = UPLOAD_DIR / "event_banners"
        banner_dir.mkdir(exist_ok=True)
        ext = banner.filename.split(".")[-1].lower()
        fname = f"event_{current_user.id}_{datetime.now().timestamp()}.{ext}"
        with open(banner_dir / fname, "wb") as f:
            shutil.copyfileobj(banner.file, f)
        banner_url = f"/uploads/event_banners/{fname}"

    def _parse_dt(s):
        if not s:
            return None
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return None

    event = models.Event(
        created_by=current_user.id,
        title=title,
        description=description,
        event_type=event_type,
        sport=sport or current_user.sport,
        location=location,
        venue=venue,
        is_online=is_online,
        online_link=online_link,
        start_date=_parse_dt(start_date),
        end_date=_parse_dt(end_date),
        registration_deadline=_parse_dt(registration_deadline),
        max_participants=max_participants,
        min_age=min_age,
        max_age=max_age,
        min_ai_score=min_ai_score,
        eligibility_criteria=eligibility_criteria,
        banner_image=banner_url,
        status="active",
        approval_status="approved",  # Auto-approve for now; admin can review
        is_public=True,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return {"message": "Event created successfully", "data": _event_to_dict(event, db, current_user.id)}


# ============================================================================
# UPDATE EVENT (Coach, own events only)
# ============================================================================

@router.put("/{event_id}")
async def update_event(
    event_id: int,
    title: str = Form(None),
    description: str = Form(None),
    location: str = Form(None),
    max_participants: int = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not your event")

    if title:
        event.title = title
    if description:
        event.description = description
    if location:
        event.location = location
    if max_participants:
        event.max_participants = max_participants

    db.commit()
    db.refresh(event)
    return {"message": "Event updated", "data": _event_to_dict(event, db, current_user.id)}


# ============================================================================
# DELETE EVENT (Coach, own events only)
# ============================================================================

@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your event")

    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}


# ============================================================================
# REGISTER FOR EVENT (Athletes)
# ============================================================================

@router.post("/{event_id}/register")
async def register_for_event(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check deadline
    if event.registration_deadline and datetime.utcnow() > event.registration_deadline:
        raise HTTPException(status_code=400, detail="Registration deadline has passed")

    # Check capacity
    reg_count = db.query(models.EventRegistration).filter(
        models.EventRegistration.event_id == event_id,
        models.EventRegistration.status == "registered"
    ).count()
    if event.max_participants and reg_count >= event.max_participants:
        raise HTTPException(status_code=400, detail="Event is full")

    # Check duplicate
    existing = db.query(models.EventRegistration).filter(
        models.EventRegistration.event_id == event_id,
        models.EventRegistration.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")

    reg = models.EventRegistration(
        event_id=event_id,
        user_id=current_user.id,
        status="registered",
    )
    db.add(reg)
    db.commit()
    return {"message": "Registered successfully"}


# ============================================================================
# UNREGISTER FROM EVENT
# ============================================================================

@router.delete("/{event_id}/register")
async def unregister_from_event(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reg = db.query(models.EventRegistration).filter(
        models.EventRegistration.event_id == event_id,
        models.EventRegistration.user_id == current_user.id
    ).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Not registered")
    db.delete(reg)
    db.commit()
    return {"message": "Unregistered successfully"}


# ============================================================================
# GET REGISTRATIONS (Coach sees who signed up for their event)
# ============================================================================

@router.get("/{event_id}/registrations")
async def get_registrations(
    event_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    regs = db.query(models.EventRegistration).filter(
        models.EventRegistration.event_id == event_id
    ).all()

    result = []
    for r in regs:
        user = db.query(models.User).filter(models.User.id == r.user_id).first()
        if user:
            result.append({
                "registration_id": r.id,
                "user_id": user.id,
                "name": user.name,
                "sport": user.sport,
                "ai_score": user.ai_score,
                "national_rank": user.national_rank,
                "profile_photo": get_image_url(user.profile_photo or user.profile_image),
                "status": r.status,
                "registered_at": r.registered_at.isoformat() if r.registered_at else None,
            })

    return {"data": result, "total": len(result)}