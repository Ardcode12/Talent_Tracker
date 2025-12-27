# backend/api/messaging.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from fastapi import File, UploadFile
from core.config import UPLOAD_DIR
import shutil
from pathlib import Path

from database import get_db
from core.dependencies import get_current_user, get_image_url
import models, schemas
from sqlalchemy import or_ as db_or, and_ as db_and
from datetime import datetime
import traceback

# Import the WebSocket manager for broadcasting
from api.message_ws import manager as ws_manager

router = APIRouter(prefix="/api", tags=["messaging"])


@router.get("/conversations")
async def get_conversations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        conversations = db.query(models.Conversation).filter(
            db_or(
                models.Conversation.user1_id == current_user.id, 
                models.Conversation.user2_id == current_user.id
            ), 
            models.Conversation.is_active == True
        ).order_by(models.Conversation.last_message_at.desc().nullslast()).all()
        
        formatted = []
        for conv in conversations:
            other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
            unread_count = db.query(models.Message).filter(
                models.Message.conversation_id == conv.id, 
                models.Message.sender_id != current_user.id, 
                models.Message.is_read == False, 
                models.Message.is_deleted == False
            ).count()
            
            formatted.append({
                "id": conv.id,
                "other_user": {
                    "id": other_user.id,
                    "name": other_user.name,
                    "profile_photo": get_image_url(other_user.profile_photo or other_user.profile_image),
                    "sport": other_user.sport,
                    "location": other_user.location,
                    "role": other_user.role
                },
                "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
                "last_message_preview": conv.last_message_preview,
                "unread_count": unread_count,
                "is_online": getattr(other_user, "is_online", False)
            })
        return {"data": formatted}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch conversations")


@router.post("/conversations/start")
async def start_conversation(
    conversation: schemas.ConversationCreate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        recipient = db.query(models.User).filter(models.User.id == conversation.recipient_id).first()
        
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        if recipient.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot start conversation with yourself")
        
        # Check if messaging is allowed (coach-athlete only, or remove this restriction)
        valid_roles = {"coach", "athlete"}
        if current_user.role in valid_roles and recipient.role in valid_roles:
            # Allow coach-athlete and athlete-athlete messaging
            pass
        else:
            # For now, allow all messaging - remove restriction
            pass
        
        # Check for existing conversation
        existing = db.query(models.Conversation).filter(
            db_or(
                db_and(
                    models.Conversation.user1_id == current_user.id, 
                    models.Conversation.user2_id == recipient.id
                ), 
                db_and(
                    models.Conversation.user1_id == recipient.id, 
                    models.Conversation.user2_id == current_user.id
                )
            )
        ).first()
        
        if existing:
            return {
                "conversation_id": existing.id, 
                "existing": True,
                "other_user": {
                    "id": recipient.id,
                    "name": recipient.name,
                    "profile_photo": get_image_url(recipient.profile_photo or recipient.profile_image),
                    "sport": recipient.sport,
                    "role": recipient.role
                }
            }
        
        # Create new conversation with consistent ordering
        user1_id = min(current_user.id, recipient.id)
        user2_id = max(current_user.id, recipient.id)
        
        new_conv = models.Conversation(user1_id=user1_id, user2_id=user2_id)
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        
        return {
            "conversation_id": new_conv.id, 
            "existing": False,
            "other_user": {
                "id": recipient.id,
                "name": recipient.name,
                "profile_photo": get_image_url(recipient.profile_photo or recipient.profile_image),
                "sport": recipient.sport,
                "role": recipient.role
            }
        }
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to start conversation")


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int, 
    page: int = Query(1, ge=1), 
    limit: int = Query(50, le=100), 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        conversation = db.query(models.Conversation).filter(
            models.Conversation.id == conversation_id, 
            db_or(
                models.Conversation.user1_id == current_user.id, 
                models.Conversation.user2_id == current_user.id
            )
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Mark messages as read
        db.query(models.Message).filter(
            models.Message.conversation_id == conversation_id, 
            models.Message.sender_id != current_user.id, 
            models.Message.is_read == False
        ).update({"is_read": True, "read_at": datetime.utcnow()})
        db.commit()
        
        offset = (page - 1) * limit
        messages = db.query(models.Message).filter(
            models.Message.conversation_id == conversation_id, 
            models.Message.is_deleted == False
        ).order_by(models.Message.created_at.desc()).offset(offset).limit(limit).all()
        
        messages.reverse()  # Chronological order
        
        formatted = []
        for msg in messages:
            formatted.append({
                "id": msg.id,
                "sender_id": msg.sender_id,
                "sender": {
                    "id": msg.sender.id,
                    "name": msg.sender.name,
                    "profile_photo": get_image_url(msg.sender.profile_photo or msg.sender.profile_image),
                    "sport": msg.sender.sport,
                    "location": msg.sender.location
                },
                "text": msg.text,
                "attachment_url": get_image_url(msg.attachment_url) if msg.attachment_url else None,
                "attachment_type": msg.attachment_type,
                "is_read": msg.is_read,
                "created_at": msg.created_at.isoformat(),
                "edited_at": msg.edited_at.isoformat() if msg.edited_at else None
            })
        
        other_user = conversation.user2 if conversation.user1_id == current_user.id else conversation.user1
        
        return {
            "conversation": {
                "id": conversation.id, 
                "other_user": {
                    "id": other_user.id, 
                    "name": other_user.name, 
                    "profile_photo": get_image_url(other_user.profile_photo or other_user.profile_image), 
                    "sport": other_user.sport, 
                    "role": other_user.role, 
                    "is_online": getattr(other_user, "is_online", False)
                }
            }, 
            "messages": formatted, 
            "page": page, 
            "has_more": len(messages) == limit
        }
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch messages")


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: int, 
    message: schemas.MessageCreate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        conversation = db.query(models.Conversation).filter(
            models.Conversation.id == conversation_id, 
            db_or(
                models.Conversation.user1_id == current_user.id, 
                models.Conversation.user2_id == current_user.id
            )
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        new_message = models.Message(
            conversation_id=conversation_id, 
            sender_id=current_user.id, 
            text=message.text, 
            attachment_url=message.attachment_url, 
            attachment_type=message.attachment_type
        )
        db.add(new_message)
        
        conversation.last_message_at = datetime.utcnow()
        conversation.last_message_preview = message.text[:100] if message.text else "[Attachment]"
        
        db.commit()
        db.refresh(new_message)
        
        response = {
            "id": new_message.id,
            "sender_id": new_message.sender_id,
            "sender": {
                "id": current_user.id,
                "name": current_user.name,
                "profile_photo": get_image_url(current_user.profile_photo or current_user.profile_image),
                "sport": current_user.sport,
                "location": current_user.location
            },
            "text": new_message.text,
            "attachment_url": get_image_url(new_message.attachment_url) if new_message.attachment_url else None,
            "attachment_type": new_message.attachment_type,
            "is_read": new_message.is_read,
            "created_at": new_message.created_at.isoformat()
        }
        
        # Broadcast via WebSocket
        try:
            import asyncio
            asyncio.create_task(ws_manager.broadcast(conversation_id, {
                "type": "new_message",
                "message": response
            }))
        except Exception as ws_error:
            print(f"WebSocket broadcast error: {ws_error}")
        
        return response
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.post("/conversations/{conversation_id}/attachments")
async def upload_message_attachment(
    conversation_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        conversation = db.query(models.Conversation).filter(
            models.Conversation.id == conversation_id,
            db_or(
                models.Conversation.user1_id == current_user.id, 
                models.Conversation.user2_id == current_user.id
            )
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        original = file.filename or "upload"
        ext = original.split(".")[-1].lower()
        if ext == "jpeg":
            ext = "jpg"
        timestamp = int(datetime.utcnow().timestamp() * 1000)
        filename = f"msg_{conversation_id}_{current_user.id}_{timestamp}.{ext}"
        file_path = Path(UPLOAD_DIR) / filename

        Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        url = f"/uploads/{filename}"
        return {"attachment_url": url, "attachment_type": file.content_type}
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to upload attachment")


@router.put("/messages/{message_id}")
async def edit_message(
    message_id: int, 
    update: schemas.MessageUpdate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        message = db.query(models.Message).filter(
            models.Message.id == message_id, 
            models.Message.sender_id == current_user.id, 
            models.Message.is_deleted == False
        ).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found or you don't have permission")
        
        if update.text:
            message.text = update.text
            message.edited_at = datetime.utcnow()
        
        db.commit()
        db.refresh(message)
        
        # Broadcast edit via WebSocket
        try:
            import asyncio
            asyncio.create_task(ws_manager.broadcast(message.conversation_id, {
                "type": "message_edited",
                "message_id": message_id,
                "text": message.text,
                "edited_at": message.edited_at.isoformat()
            }))
        except Exception:
            pass
        
        return {"message": "Message updated successfully", "edited_at": message.edited_at.isoformat()}
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to edit message")


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        message = db.query(models.Message).filter(
            models.Message.id == message_id, 
            models.Message.sender_id == current_user.id
        ).first()
        
        if not message:
            raise HTTPException(status_code=404, detail="Message not found or you don't have permission")
        
        conversation_id = message.conversation_id
        message.is_deleted = True
        db.commit()
        
        # Broadcast deletion via WebSocket
        try:
            import asyncio
            asyncio.create_task(ws_manager.broadcast(conversation_id, {
                "type": "message_deleted",
                "message_id": message_id
            }))
        except Exception:
            pass
        
        return {"message": "Message deleted successfully"}
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to delete message")


@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: int, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        conversation = db.query(models.Conversation).filter(
            models.Conversation.id == conversation_id, 
            db_or(
                models.Conversation.user1_id == current_user.id, 
                models.Conversation.user2_id == current_user.id
            )
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        updated = db.query(models.Message).filter(
            models.Message.conversation_id == conversation_id, 
            models.Message.sender_id != current_user.id, 
            models.Message.is_read == False
        ).update({"is_read": True, "read_at": datetime.utcnow()})
        
        db.commit()
        
        # Broadcast read receipts via WebSocket
        try:
            import asyncio
            asyncio.create_task(ws_manager.broadcast(conversation_id, {
                "type": "messages_read",
                "reader_id": current_user.id
            }))
        except Exception:
            pass
        
        return {"messages_marked": updated}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to mark conversation read")


@router.get("/messages/unread-count")
async def get_unread_count(
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        conversations = db.query(models.Conversation).filter(
            db_or(
                models.Conversation.user1_id == current_user.id, 
                models.Conversation.user2_id == current_user.id
            )
        ).all()
        
        total_unread = 0
        for conv in conversations:
            unread = db.query(models.Message).filter(
                models.Message.conversation_id == conv.id, 
                models.Message.sender_id != current_user.id, 
                models.Message.is_read == False, 
                models.Message.is_deleted == False
            ).count()
            total_unread += unread
        
        return {"unread_count": total_unread}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to compute unread count")


# New endpoint: Get users available for messaging
@router.get("/messaging/available-users")
async def get_available_users_for_messaging(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=50),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get users that the current user can message (connected users or based on role)"""
    try:
        # Get connected users
        connected_ids = set()
        
        # Users where current user initiated connection
        initiated = db.query(models.connections.c.connected_user_id).filter(
            models.connections.c.user_id == current_user.id,
            models.connections.c.status == 'accepted'
        ).all()
        connected_ids.update([r[0] for r in initiated])
        
        # Users who initiated connection to current user
        received = db.query(models.connections.c.user_id).filter(
            models.connections.c.connected_user_id == current_user.id,
            models.connections.c.status == 'accepted'
        ).all()
        connected_ids.update([r[0] for r in received])
        
        # Query connected users
        query = db.query(models.User).filter(
            models.User.id.in_(connected_ids),
            models.User.is_active == True
        )
        
        # Apply search filter
        if search:
            query = query.filter(
                db_or(
                    models.User.name.ilike(f'%{search}%'),
                    models.User.sport.ilike(f'%{search}%')
                )
            )
        
        total = query.count()
        offset = (page - 1) * limit
        users = query.offset(offset).limit(limit).all()
        
        formatted = []
        for user in users:
            # Check if conversation already exists
            existing_conv = db.query(models.Conversation).filter(
                db_or(
                    db_and(
                        models.Conversation.user1_id == current_user.id,
                        models.Conversation.user2_id == user.id
                    ),
                    db_and(
                        models.Conversation.user1_id == user.id,
                        models.Conversation.user2_id == current_user.id
                    )
                )
            ).first()
            
            formatted.append({
                "id": str(user.id),
                "name": user.name,
                "profilePhoto": get_image_url(user.profile_photo or user.profile_image),
                "role": user.role.title() if user.role else "User",
                "sport": user.sport,
                "location": user.location,
                "isOnline": getattr(user, "is_online", False),
                "existingConversationId": existing_conv.id if existing_conv else None
            })
        
        return {
            "data": formatted,
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": (total + limit - 1) // limit
            }
        }
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch available users")