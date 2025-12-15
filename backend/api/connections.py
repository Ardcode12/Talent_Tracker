# backend/api/connections.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from core.dependencies import get_current_user, get_current_user_optional, get_image_url # Changed & added get_image_url
from database import get_db # Changed
import models, schemas # Changed
from sqlalchemy import or_ as db_or, and_ as db_and, func
import traceback

router = APIRouter(prefix="/api/connections", tags=["connections"])


@router.get("")
async def get_connections(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        connections_initiated = db.query(models.User).join(
            models.connections,
            models.connections.c.connected_user_id == models.User.id
        ).filter(
            models.connections.c.user_id == current_user.id,
            models.connections.c.status == 'accepted'
        ).all()

        connections_received = db.query(models.User).join(
            models.connections,
            models.connections.c.user_id == models.User.id
        ).filter(
            models.connections.c.connected_user_id == current_user.id,
            models.connections.c.status == 'accepted'
        ).all()

        all_connections = list({u.id: u for u in (connections_initiated + connections_received)}.values())

        return {
            "data": [
                {
                    "id": str(user.id),
                    "name": user.name,
                    "profilePhoto": get_image_url(user.profile_photo or user.profile_image or None),  # Use get_image_url
                    "role": user.role.title() if user.role else "User",
                    "sport": user.sport,
                    "location": user.location,
                    "isOnline": getattr(user, "is_online", False),
                    "lastActive": user.last_seen.isoformat() if getattr(user, "last_seen", None) else None
                }
                for user in all_connections
            ]
        }
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch connections")


@router.get("/requests")
async def get_connection_requests(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        pending_requests = db.query(models.User).join(
            models.connections,
            models.connections.c.user_id == models.User.id
        ).filter(
            models.connections.c.connected_user_id == current_user.id,
            models.connections.c.status == 'pending'
        ).all()
        
        formatted_requests = []
        for user in pending_requests:
            user_connections = db.query(models.connections.c.connected_user_id).filter(
                models.connections.c.user_id == user.id,
                models.connections.c.status == 'accepted'
            ).subquery()
            
            mutual_count = db.query(models.connections).filter(
                models.connections.c.user_id == current_user.id,
                models.connections.c.connected_user_id.in_(user_connections),
                models.connections.c.status == 'accepted'
            ).count()
            
            request_info = db.query(models.connections.c.created_at).filter(
                models.connections.c.user_id == user.id,
                models.connections.c.connected_user_id == current_user.id
            ).first()
            
            formatted_requests.append({
                "id": str(user.id),
                "name": user.name,
                "profilePhoto": get_image_url(user.profile_photo or user.profile_image),
                "sport": user.sport,
                "role": user.role.title() if user.role else "User",
                "requestTime": request_info.created_at.isoformat() if request_info else None,
                "mutualConnections": mutual_count
            })
        
        return {"data": formatted_requests}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch requests")


@router.get("/suggestions")
async def get_connection_suggestions(limit: int = Query(10, le=50), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        connected_ids_subquery = db.query(models.connections.c.connected_user_id).filter(
            models.connections.c.user_id == current_user.id
        ).union(
            db.query(models.connections.c.user_id).filter(
                models.connections.c.connected_user_id == current_user.id
            )
        ).subquery()
        
        suggestions = db.query(models.User).filter(
            models.User.id != current_user.id,
            ~models.User.id.in_(connected_ids_subquery)
        ).order_by(
            (models.User.sport == current_user.sport).desc(),
            (models.User.location == current_user.location).desc(),
            func.random()
        ).limit(limit).all()
        
        formatted_suggestions = []
        for user in suggestions:
            connection_count = db.query(models.connections).filter(
                db_or(
                    models.connections.c.user_id == user.id,
                    models.connections.c.connected_user_id == user.id
                ),
                models.connections.c.status == 'accepted'
            ).count()
            
            formatted_suggestions.append({
                "id": str(user.id),
                "name": user.name,
                "profilePhoto": get_image_url(user.profile_photo or user.profile_image),
                "role": user.role.title() if user.role else "User",
                "sport": user.sport,
                "location": user.location,
                "isOnline": getattr(user, "is_online", False),
                "lastActive": user.last_seen.isoformat() if getattr(user, "last_seen", None) else None,
                "connections": connection_count,
                "performance": f"AI Score: {user.ai_score}%" if getattr(user, "ai_score", None) else None,
                "verified": getattr(user, "is_verified", False)
            })
        
        return {"data": formatted_suggestions}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch suggestions")


@router.get("/available")
async def get_available_connections(
    role: Optional[str] = Query(None),
    sport: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    try:
        if current_user:
            connected_ids_subquery = db.query(models.connections.c.connected_user_id).filter(
                models.connections.c.user_id == current_user.id
            ).union(
                db.query(models.connections.c.user_id).filter(
                    models.connections.c.connected_user_id == current_user.id
                )
            ).subquery()
            
            query = db.query(models.User).filter(
                models.User.id != current_user.id,
                ~models.User.id.in_(connected_ids_subquery),
                models.User.is_active == True
            )
        else:
            query = db.query(models.User).filter(
                models.User.is_active == True
            )
        
        if role and role != 'all':
            role_filter = role.lower().rstrip('s')
            query = query.filter(models.User.role == role_filter)
        
        if sport:
            query = query.filter(models.User.sport.ilike(f'%{sport}%'))
        
        if location:
            query = query.filter(models.User.location.ilike(f'%{location}%'))
        
        if search:
            query = query.filter(
                db_or(
                    models.User.name.ilike(f'%{search}%'),
                    models.User.sport.ilike(f'%{search}%'),
                    models.User.location.ilike(f'%{search}%'),
                    models.User.bio.ilike(f'%{search}%')
                )
            )
        
        total_count = query.count()
        
        offset = (page - 1) * limit
        users = query.offset(offset).limit(limit).all()
        
        formatted_users = []
        for user in users:
            user_data = {
                "id": str(user.id),
                "name": user.name,
                "profilePhoto": get_image_url(user.profile_photo or user.profile_image),
                "role": user.role.title() if user.role else "User",
                "sport": user.sport or "Not specified",
                "location": user.location or "Not specified",
                "bio": user.bio,
                "isOnline": getattr(user, 'is_online', False),
                "lastActive": user.last_seen.isoformat() if getattr(user, 'last_seen', None) else None,
                "connections": 0,
                "performance": f"AI Score: {user.ai_score}%" if getattr(user, 'ai_score', None) else None,
                "verified": getattr(user, 'is_verified', False),
                "age": user.age,
                "experience": user.experience,
                "achievements": user.achievements,
                "hasPendingRequest": False,
                "requestStatus": None
            }
            
            if current_user:
                pending_request = db.query(models.connections).filter(
                    db_or(
                        db_and(
                            models.connections.c.user_id == current_user.id,
                            models.connections.c.connected_user_id == user.id,
                            models.connections.c.status == 'pending'
                        ),
                        db_and(
                            models.connections.c.user_id == user.id,
                            models.connections.c.connected_user_id == current_user.id,
                            models.connections.c.status == 'pending'
                        )
                    )
                ).first()
                
                user_data["hasPendingRequest"] = pending_request is not None
                user_data["requestStatus"] = pending_request.status if pending_request else None
                
                user_connections = db.query(models.connections).filter(
                    db_or(
                        db_and(
                            models.connections.c.user_id == user.id,
                            models.connections.c.status == 'accepted'
                        ),
                        db_and(
                            models.connections.c.connected_user_id == user.id,
                            models.connections.c.status == 'accepted'
                        )
                    )
                ).count()
                
                user_data["connections"] = user_connections
            
            formatted_users.append(user_data)
        
        return {
            "data": formatted_users,
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
                "pages": (total_count + limit - 1) // limit
            }
        }
        
    except Exception as e:
        print(f"Error in get_available_connections: {e}")
        traceback.print_exc()
        return {
            "data": [],
            "pagination": {
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0
            }
        }


@router.post("/request/{user_id}")
async def send_connection_request(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")
    
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = db.query(models.connections).filter(
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
    
    if existing:
        raise HTTPException(status_code=400, detail="Connection request already exists")
    
    stmt = models.connections.insert().values(
        user_id=current_user.id,
        connected_user_id=user_id,
        status='pending'
    )
    db.execute(stmt)
    db.commit()
    
    return {"message": "Connection request sent successfully"}


@router.post("/accept/{user_id}")
async def accept_connection_request(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = models.connections.update().where(
        models.connections.c.user_id == user_id,
        models.connections.c.connected_user_id == current_user.id,
        models.connections.c.status == 'pending'
    ).values(status='accepted')
    
    result = db.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Connection request not found")
    
    db.commit()
    return {"message": "Connection request accepted"}


@router.delete("/reject/{user_id}")
async def reject_connection_request(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = models.connections.delete().where(
        models.connections.c.user_id == user_id,
        models.connections.c.connected_user_id == current_user.id,
        models.connections.c.status == 'pending'
    )
    
    result = db.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Connection request not found")
    
    db.commit()
    return {"message": "Connection request rejected"}


@router.delete("/remove/{user_id}")
async def remove_connection(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = models.connections.delete().where(
        db_or(
            db_and(
                models.connections.c.user_id == current_user.id,
                models.connections.c.connected_user_id == user_id,
                models.connections.c.status == 'accepted'
            ),
            db_and(
                models.connections.c.user_id == user_id,
                models.connections.c.connected_user_id == current_user.id,
                models.connections.c.status == 'accepted'
            )
        )
    )
    
    result = db.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    db.commit()
    return {"message": "Connection removed"}


@router.get("/groups")
async def get_groups():
    groups = [
        {
            "id": "g1",
            "name": "Indian Athletics Federation",
            "logo": "/api/placeholder/100/100",
            "memberCount": 5420,
            "description": "Official federation for athletics in India",
            "type": "Federation"
        },
        {
            "id": "g2",
            "name": "Khelo India Academy",
            "logo": "/api/placeholder/100/100",
            "memberCount": 3200,
            "description": "Government sports development program",
            "type": "Academy"
        }
    ]
    return {"data": groups}

