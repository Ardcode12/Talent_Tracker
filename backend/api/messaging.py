# backend/api/messaging.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
from core.dependencies import get_current_user, get_image_url
import models, schemas
from sqlalchemy import or_ as db_or, and_ as db_and
from datetime import datetime
import traceback

router = APIRouter(prefix="/api", tags=["messaging"])


@router.get("/conversations") # Removed response_model=List[schemas.ConversationResponse]
async def get_conversations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        conversations = db.query(models.Conversation).filter(db_or(models.Conversation.user1_id == current_user.id, models.Conversation.user2_id == current_user.id), models.Conversation.is_active == True).order_by(models.Conversation.last_message_at.desc().nullsfirst()).all()
        formatted = []
        for conv in conversations:
            other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
            unread_count = db.query(models.Message).filter(models.Message.conversation_id == conv.id, models.Message.sender_id != current_user.id, models.Message.is_read == False, models.Message.is_deleted == False).count()
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
        return {"data": formatted} # Explicitly return as dict with "data" key
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch conversations")


@router.post("/conversations/start")
async def start_conversation(conversation: schemas.ConversationCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        recipient = db.query(models.User).filter(models.User.id == conversation.recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        if recipient.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot start conversation with yourself")
        existing = db.query(models.Conversation).filter(db_or(db_and(models.Conversation.user1_id == current_user.id, models.Conversation.user2_id == recipient.id), db_and(models.Conversation.user1_id == recipient.id, models.Conversation.user2_id == current_user.id))).first()
        if existing:
            return {"conversation_id": existing.id, "existing": True}
        user1_id = min(current_user.id, recipient.id)
        user2_id = max(current_user.id, recipient.id)
        new_conv = models.Conversation(user1_id=user1_id, user2_id=user2_id)
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        return {"conversation_id": new_conv.id, "existing": False}
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to start conversation")


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: int, page: int = Query(1, ge=1), limit: int = Query(50, le=100), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id, db_or(models.Conversation.user1_id == current_user.id, models.Conversation.user2_id == current_user.id)).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        db.query(models.Message).filter(models.Message.conversation_id == conversation_id, models.Message.sender_id != current_user.id, models.Message.is_read == False).update({"is_read": True, "read_at": datetime.utcnow()})
        db.commit()
        offset = (page - 1) * limit
        messages = db.query(models.Message).filter(models.Message.conversation_id == conversation_id, models.Message.is_deleted == False).order_by(models.Message.created_at.desc()).offset(offset).limit(limit).all()
        messages.reverse()
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
        return {"conversation": {"id": conversation.id, "other_user": {"id": other_user.id, "name": other_user.name, "profile_photo": get_image_url(other_user.profile_photo or other_user.profile_image), "sport": other_user.sport, "role": other_user.role, "is_online": getattr(other_user, "is_online", False)}}, "messages": formatted, "page": page, "has_more": len(messages) == limit}
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch messages")


@router.post("/conversations/{conversation_id}/messages", response_model=schemas.MessageResponse)
async def send_message(conversation_id: int, message: schemas.MessageCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id, db_or(models.Conversation.user1_id == current_user.id, models.Conversation.user2_id == current_user.id)).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        new_message = models.Message(conversation_id=conversation_id, sender_id=current_user.id, text=message.text, attachment_url=message.attachment_url, attachment_type=message.attachment_type)
        db.add(new_message)
        conversation.last_message_at = datetime.utcnow()
        conversation.last_message_preview = message.text[:100]
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
        return response
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.put("/messages/{message_id}")
async def edit_message(message_id: int, update: schemas.MessageUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        message = db.query(models.Message).filter(models.Message.id == message_id, models.Message.sender_id == current_user.id, models.Message.is_deleted == False).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found or you don't have permission")
        if update.text:
            message.text = update.text
            message.edited_at = datetime.utcnow()
        db.commit()
        db.refresh(message)
        return {"message": "Message updated successfully"}
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to edit message")


@router.delete("/messages/{message_id}")
async def delete_message(message_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        message = db.query(models.Message).filter(models.Message.id == message_id, models.Message.sender_id == current_user.id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found or you don't have permission")
        message.is_deleted = True
        db.commit()
        return {"message": "Message deleted successfully"}
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to delete message")


@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_read(conversation_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id, db_or(models.Conversation.user1_id == current_user.id, models.Conversation.user2_id == current_user.id)).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        updated = db.query(models.Message).filter(models.Message.conversation_id == conversation_id, models.Message.sender_id != current_user.id, models.Message.is_read == False).update({"is_read": True, "read_at": datetime.utcnow()})
        db.commit()
        return {"messages_marked": updated}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to mark conversation read")


@router.get("/messages/unread-count")
async def get_unread_count(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        conversations = db.query(models.Conversation).filter(db_or(models.Conversation.user1_id == current_user.id, models.Conversation.user2_id == current_user.id)).all()
        total_unread = 0
        for conv in conversations:
            unread = db.query(models.Message).filter(models.Message.conversation_id == conv.id, models.Message.sender_id != current_user.id, models.Message.is_read == False, models.Message.is_deleted == False).count()
            total_unread += unread
        return {"unread_count": total_unread}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to compute unread count")
