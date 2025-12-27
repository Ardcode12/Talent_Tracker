# backend/api/notifications.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_ as db_or, and_ as db_and, func
from typing import Optional, List
from datetime import datetime, timedelta
import traceback

from database import get_db
from core.dependencies import get_current_user, get_image_url
import models

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# Notification model (add to models.py if not exists)
# For now, we'll generate notifications dynamically

@router.get("")
async def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=50),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get notifications for the current user"""
    try:
        notifications = []
        
        # 1. New connection requests
        pending_requests = db.query(models.User).join(
            models.connections,
            models.connections.c.user_id == models.User.id
        ).filter(
            models.connections.c.connected_user_id == current_user.id,
            models.connections.c.status == 'pending'
        ).order_by(models.connections.c.created_at.desc()).limit(5).all()
        
        for user in pending_requests:
            notifications.append({
                "id": f"conn_req_{user.id}",
                "type": "connection_request",
                "title": "New Connection Request",
                "message": f"{user.name} wants to connect with you",
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "profile_photo": get_image_url(user.profile_photo or user.profile_image),
                    "sport": user.sport
                },
                "action_url": f"/connections/requests",
                "is_read": False,
                "created_at": datetime.utcnow().isoformat()
            })
        
        # 2. New messages (unread)
        unread_conversations = db.query(models.Conversation).filter(
            db_or(
                models.Conversation.user1_id == current_user.id,
                models.Conversation.user2_id == current_user.id
            )
        ).all()
        
        for conv in unread_conversations:
            unread_messages = db.query(models.Message).filter(
                models.Message.conversation_id == conv.id,
                models.Message.sender_id != current_user.id,
                models.Message.is_read == False
            ).order_by(models.Message.created_at.desc()).first()
            
            if unread_messages:
                other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
                notifications.append({
                    "id": f"msg_{unread_messages.id}",
                    "type": "new_message",
                    "title": "New Message",
                    "message": f"{other_user.name}: {unread_messages.text[:50]}...",
                    "user": {
                        "id": other_user.id,
                        "name": other_user.name,
                        "profile_photo": get_image_url(other_user.profile_photo or other_user.profile_image),
                        "sport": other_user.sport
                    },
                    "action_url": f"/messages/{conv.id}",
                    "is_read": False,
                    "created_at": unread_messages.created_at.isoformat()
                })
        
        # 3. Likes on user's posts (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(days=1)
        user_posts = db.query(models.Post).filter(
            models.Post.user_id == current_user.id
        ).all()
        
        for post in user_posts:
            recent_likes = db.query(models.post_likes).filter(
                models.post_likes.c.post_id == post.id,
                models.post_likes.c.created_at >= yesterday
            ).count()
            
            if recent_likes > 0:
                notifications.append({
                    "id": f"like_{post.id}",
                    "type": "post_like",
                    "title": "Post Liked",
                    "message": f"{recent_likes} people liked your post",
                    "post_id": post.id,
                    "action_url": f"/posts/{post.id}",
                    "is_read": False,
                    "created_at": datetime.utcnow().isoformat()
                })
        
        # 4. Comments on user's posts
        for post in user_posts:
            recent_comments = db.query(models.Comment).filter(
                models.Comment.post_id == post.id,
                models.Comment.user_id != current_user.id,
                models.Comment.created_at >= yesterday
            ).order_by(models.Comment.created_at.desc()).first()
            
            if recent_comments:
                commenter = db.query(models.User).filter(
                    models.User.id == recent_comments.user_id
                ).first()
                
                if commenter:
                    notifications.append({
                        "id": f"comment_{recent_comments.id}",
                        "type": "post_comment",
                        "title": "New Comment",
                        "message": f"{commenter.name} commented on your post",
                        "user": {
                            "id": commenter.id,
                            "name": commenter.name,
                            "profile_photo": get_image_url(commenter.profile_photo or commenter.profile_image)
                        },
                        "post_id": post.id,
                        "action_url": f"/posts/{post.id}",
                        "is_read": False,
                        "created_at": recent_comments.created_at.isoformat()
                    })
        
        # Sort by created_at
        notifications.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Paginate
        start = (page - 1) * limit
        end = start + limit
        paginated = notifications[start:end]
        
        return {
            "data": paginated,
            "total": len(notifications),
            "unread_count": len([n for n in notifications if not n.get('is_read', True)]),
            "page": page,
            "has_more": end < len(notifications)
        }
        
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch notifications")


@router.get("/count")
async def get_notification_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get unread notification count"""
    try:
        count = 0
        
        # Pending connection requests
        pending = db.query(models.connections).filter(
            models.connections.c.connected_user_id == current_user.id,
            models.connections.c.status == 'pending'
        ).count()
        count += pending
        
        # Unread messages
        conversations = db.query(models.Conversation).filter(
            db_or(
                models.Conversation.user1_id == current_user.id,
                models.Conversation.user2_id == current_user.id
            )
        ).all()
        
        for conv in conversations:
            unread = db.query(models.Message).filter(
                models.Message.conversation_id == conv.id,
                models.Message.sender_id != current_user.id,
                models.Message.is_read == False
            ).count()
            count += unread
        
        return {"count": count}
        
    except Exception:
        traceback.print_exc()
        return {"count": 0}