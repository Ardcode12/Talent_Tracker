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


def get_image_url_with_fallback(image_path, name="User"):
    """Get image URL with fallback to UI Avatars"""
    if image_path:
        url = get_image_url(image_path)
        if url:
            return url
    initials = ''.join([part[0].upper() for part in (name or "User").split()[:2]])
    return f"https://ui-avatars.com/api/?name={initials}&background=6366f1&color=fff&size=200"


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
        yesterday = datetime.utcnow() - timedelta(days=1)
        
        # ============================================
        # 1. NEW CONNECTION REQUESTS
        # ============================================
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
                    "profile_photo": get_image_url_with_fallback(
                        user.profile_photo or user.profile_image,
                        user.name
                    ),
                    "sport": user.sport
                },
                "action_url": "/connections/requests",
                "is_read": False,
                "created_at": datetime.utcnow().isoformat()
            })
        
        # ============================================
        # 2. NEW MESSAGES (UNREAD)
        # ============================================
        unread_conversations = db.query(models.Conversation).filter(
            db_or(
                models.Conversation.user1_id == current_user.id,
                models.Conversation.user2_id == current_user.id
            )
        ).all()
        
        for conv in unread_conversations:
            unread_message = db.query(models.Message).filter(
                models.Message.conversation_id == conv.id,
                models.Message.sender_id != current_user.id,
                models.Message.is_read == False
            ).order_by(models.Message.created_at.desc()).first()
            
            if unread_message:
                other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
                
                # Truncate message preview
                message_preview = unread_message.text
                if len(message_preview) > 50:
                    message_preview = message_preview[:50] + "..."
                
                notifications.append({
                    "id": f"msg_{unread_message.id}",
                    "type": "new_message",
                    "title": "New Message",
                    "message": f"{other_user.name}: {message_preview}",
                    "user": {
                        "id": other_user.id,
                        "name": other_user.name,
                        "profile_photo": get_image_url_with_fallback(
                            other_user.profile_photo or other_user.profile_image,
                            other_user.name
                        ),
                        "sport": other_user.sport
                    },
                    "action_url": f"/messages/{conv.id}",
                    "is_read": False,
                    "created_at": unread_message.created_at.isoformat()
                })
        
        # ============================================
        # 3. LIKES ON USER'S POSTS (LAST 24 HOURS)
        # ============================================
        user_posts = db.query(models.Post).filter(
            models.Post.user_id == current_user.id
        ).all()
        
        for post in user_posts:
            # Get recent likes with user info
            recent_likes_query = db.query(
                models.post_likes.c.user_id,
                models.post_likes.c.created_at
            ).filter(
                models.post_likes.c.post_id == post.id,
                models.post_likes.c.created_at >= yesterday
            ).order_by(models.post_likes.c.created_at.desc()).limit(5).all()
            
            if recent_likes_query:
                # Get the most recent liker
                recent_liker_id = recent_likes_query[0][0]
                recent_liker = db.query(models.User).filter(
                    models.User.id == recent_liker_id
                ).first()
                
                like_count = len(recent_likes_query)
                
                if recent_liker:
                    if like_count == 1:
                        message = f"{recent_liker.name} liked your post"
                    else:
                        message = f"{recent_liker.name} and {like_count - 1} others liked your post"
                    
                    notifications.append({
                        "id": f"like_{post.id}_{recent_liker_id}",
                        "type": "post_like",
                        "title": "Post Liked",
                        "message": message,
                        "user": {
                            "id": recent_liker.id,
                            "name": recent_liker.name,
                            "profile_photo": get_image_url_with_fallback(
                                recent_liker.profile_photo or recent_liker.profile_image,
                                recent_liker.name
                            )
                        },
                        "post_id": post.id,
                        "action_url": f"/posts/{post.id}",
                        "is_read": False,
                        "created_at": recent_likes_query[0][1].isoformat()
                    })
        
        # ============================================
        # 4. COMMENTS ON USER'S POSTS
        # ============================================
        for post in user_posts:
            recent_comments = db.query(models.Comment).filter(
                models.Comment.post_id == post.id,
                models.Comment.user_id != current_user.id,
                models.Comment.created_at >= yesterday
            ).order_by(models.Comment.created_at.desc()).limit(5).all()
            
            for comment in recent_comments:
                commenter = db.query(models.User).filter(
                    models.User.id == comment.user_id
                ).first()
                
                if commenter:
                    # Truncate comment text
                    comment_preview = comment.text
                    if len(comment_preview) > 50:
                        comment_preview = comment_preview[:50] + "..."
                    
                    notifications.append({
                        "id": f"comment_{comment.id}",
                        "type": "post_comment",
                        "title": "New Comment",
                        "message": f'{commenter.name} commented: "{comment_preview}"',
                        "user": {
                            "id": commenter.id,
                            "name": commenter.name,
                            "profile_photo": get_image_url_with_fallback(
                                commenter.profile_photo or commenter.profile_image,
                                commenter.name
                            ),
                            "sport": commenter.sport
                        },
                        "post_id": post.id,
                        "action_url": f"/posts/{post.id}",
                        "is_read": False,
                        "created_at": comment.created_at.isoformat()
                    })
        
        # ============================================
        # 5. REPLIES TO USER'S COMMENTS
        # ============================================
        try:
            # Get all comments by current user
            user_comments = db.query(models.Comment).filter(
                models.Comment.user_id == current_user.id
            ).all()
            
            for comment in user_comments:
                # Get recent replies to this comment
                recent_replies = db.query(models.CommentReply).filter(
                    models.CommentReply.comment_id == comment.id,
                    models.CommentReply.user_id != current_user.id,
                    models.CommentReply.created_at >= yesterday
                ).order_by(models.CommentReply.created_at.desc()).limit(5).all()
                
                for reply in recent_replies:
                    replier = db.query(models.User).filter(
                        models.User.id == reply.user_id
                    ).first()
                    
                    if replier:
                        # Truncate reply text
                        reply_preview = reply.text
                        if len(reply_preview) > 50:
                            reply_preview = reply_preview[:50] + "..."
                        
                        notifications.append({
                            "id": f"reply_{reply.id}",
                            "type": "comment_reply",
                            "title": "New Reply",
                            "message": f'{replier.name} replied: "{reply_preview}"',
                            "user": {
                                "id": replier.id,
                                "name": replier.name,
                                "profile_photo": get_image_url_with_fallback(
                                    replier.profile_photo or replier.profile_image,
                                    replier.name
                                ),
                                "sport": replier.sport
                            },
                            "comment_id": comment.id,
                            "post_id": comment.post_id,
                            "action_url": f"/posts/{comment.post_id}",
                            "is_read": False,
                            "created_at": reply.created_at.isoformat()
                        })
        except Exception as e:
            # CommentReply table might not exist yet
            print(f"Could not fetch reply notifications: {e}")
        
        # ============================================
        # 6. LIKES ON USER'S COMMENTS
        # ============================================
        try:
            for comment in user_comments if 'user_comments' in dir() else []:
                # Get recent comment likes
                recent_comment_likes = db.query(
                    models.comment_likes.c.user_id,
                    models.comment_likes.c.created_at
                ).filter(
                    models.comment_likes.c.comment_id == comment.id,
                    models.comment_likes.c.created_at >= yesterday
                ).order_by(models.comment_likes.c.created_at.desc()).limit(3).all()
                
                if recent_comment_likes:
                    liker_id = recent_comment_likes[0][0]
                    liker = db.query(models.User).filter(
                        models.User.id == liker_id
                    ).first()
                    
                    if liker:
                        like_count = len(recent_comment_likes)
                        
                        if like_count == 1:
                            message = f"{liker.name} liked your comment"
                        else:
                            message = f"{liker.name} and {like_count - 1} others liked your comment"
                        
                        notifications.append({
                            "id": f"comment_like_{comment.id}_{liker_id}",
                            "type": "comment_like",
                            "title": "Comment Liked",
                            "message": message,
                            "user": {
                                "id": liker.id,
                                "name": liker.name,
                                "profile_photo": get_image_url_with_fallback(
                                    liker.profile_photo or liker.profile_image,
                                    liker.name
                                )
                            },
                            "comment_id": comment.id,
                            "post_id": comment.post_id,
                            "action_url": f"/posts/{comment.post_id}",
                            "is_read": False,
                            "created_at": recent_comment_likes[0][1].isoformat()
                        })
        except Exception as e:
            # comment_likes table might not exist yet
            print(f"Could not fetch comment like notifications: {e}")
        
        # ============================================
        # 7. MENTIONS IN REPLIES (@username)
        # ============================================
        try:
            # Get replies where current user is mentioned
            mentioned_replies = db.query(models.CommentReply).filter(
                models.CommentReply.reply_to_user_id == current_user.id,
                models.CommentReply.user_id != current_user.id,
                models.CommentReply.created_at >= yesterday
            ).order_by(models.CommentReply.created_at.desc()).limit(10).all()
            
            for reply in mentioned_replies:
                # Skip if already added as a reply notification
                if f"reply_{reply.id}" in [n["id"] for n in notifications]:
                    continue
                
                mentioner = db.query(models.User).filter(
                    models.User.id == reply.user_id
                ).first()
                
                if mentioner:
                    # Get the parent comment to find the post
                    parent_comment = db.query(models.Comment).filter(
                        models.Comment.id == reply.comment_id
                    ).first()
                    
                    if parent_comment:
                        reply_preview = reply.text
                        if len(reply_preview) > 50:
                            reply_preview = reply_preview[:50] + "..."
                        
                        notifications.append({
                            "id": f"mention_{reply.id}",
                            "type": "mention",
                            "title": "You were mentioned",
                            "message": f'{mentioner.name} mentioned you: "{reply_preview}"',
                            "user": {
                                "id": mentioner.id,
                                "name": mentioner.name,
                                "profile_photo": get_image_url_with_fallback(
                                    mentioner.profile_photo or mentioner.profile_image,
                                    mentioner.name
                                ),
                                "sport": mentioner.sport
                            },
                            "comment_id": reply.comment_id,
                            "post_id": parent_comment.post_id,
                            "action_url": f"/posts/{parent_comment.post_id}",
                            "is_read": False,
                            "created_at": reply.created_at.isoformat()
                        })
        except Exception as e:
            print(f"Could not fetch mention notifications: {e}")
        
        # ============================================
        # 8. CONNECTION ACCEPTED
        # ============================================
        try:
            accepted_connections = db.query(models.User).join(
                models.connections,
                models.connections.c.connected_user_id == models.User.id
            ).filter(
                models.connections.c.user_id == current_user.id,
                models.connections.c.status == 'accepted',
                models.connections.c.created_at >= yesterday
            ).limit(5).all()
            
            for user in accepted_connections:
                notifications.append({
                    "id": f"conn_accept_{user.id}",
                    "type": "connection_accepted",
                    "title": "Connection Accepted",
                    "message": f"{user.name} accepted your connection request",
                    "user": {
                        "id": user.id,
                        "name": user.name,
                        "profile_photo": get_image_url_with_fallback(
                            user.profile_photo or user.profile_image,
                            user.name
                        ),
                        "sport": user.sport
                    },
                    "action_url": f"/profile/{user.id}",
                    "is_read": False,
                    "created_at": datetime.utcnow().isoformat()
                })
        except Exception as e:
            print(f"Could not fetch connection accepted notifications: {e}")
        
        # ============================================
        # 9. NEW ASSESSMENT RESULTS (if applicable)
        # ============================================
        try:
            recent_assessments = db.query(models.Assessment).filter(
                models.Assessment.user_id == current_user.id,
                models.Assessment.status == 'completed',
                models.Assessment.created_at >= yesterday
            ).order_by(models.Assessment.created_at.desc()).limit(3).all()
            
            for assessment in recent_assessments:
                notifications.append({
                    "id": f"assessment_{assessment.id}",
                    "type": "assessment_complete",
                    "title": "Assessment Complete",
                    "message": f"Your {assessment.test_type} assessment is ready! Score: {assessment.ai_score}%",
                    "action_url": f"/assessments/{assessment.id}",
                    "is_read": False,
                    "created_at": assessment.created_at.isoformat()
                })
        except Exception as e:
            print(f"Could not fetch assessment notifications: {e}")
        
        # ============================================
        # SORT AND PAGINATE
        # ============================================
        
        # Remove duplicate notifications
        seen_ids = set()
        unique_notifications = []
        for notif in notifications:
            if notif["id"] not in seen_ids:
                seen_ids.add(notif["id"])
                unique_notifications.append(notif)
        
        notifications = unique_notifications
        
        # Sort by created_at (most recent first)
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
        yesterday = datetime.utcnow() - timedelta(days=1)
        
        # ============================================
        # 1. PENDING CONNECTION REQUESTS
        # ============================================
        pending = db.query(models.connections).filter(
            models.connections.c.connected_user_id == current_user.id,
            models.connections.c.status == 'pending'
        ).count()
        count += pending
        
        # ============================================
        # 2. UNREAD MESSAGES
        # ============================================
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
        
        # ============================================
        # 3. RECENT COMMENTS ON USER'S POSTS
        # ============================================
        user_post_ids = db.query(models.Post.id).filter(
            models.Post.user_id == current_user.id
        ).all()
        user_post_ids = [p[0] for p in user_post_ids]
        
        if user_post_ids:
            recent_comments = db.query(models.Comment).filter(
                models.Comment.post_id.in_(user_post_ids),
                models.Comment.user_id != current_user.id,
                models.Comment.created_at >= yesterday
            ).count()
            count += recent_comments
        
        # ============================================
        # 4. RECENT REPLIES TO USER'S COMMENTS
        # ============================================
        try:
            user_comment_ids = db.query(models.Comment.id).filter(
                models.Comment.user_id == current_user.id
            ).all()
            user_comment_ids = [c[0] for c in user_comment_ids]
            
            if user_comment_ids:
                recent_replies = db.query(models.CommentReply).filter(
                    models.CommentReply.comment_id.in_(user_comment_ids),
                    models.CommentReply.user_id != current_user.id,
                    models.CommentReply.created_at >= yesterday
                ).count()
                count += recent_replies
        except Exception:
            pass  # CommentReply table might not exist
        
        # ============================================
        # 5. MENTIONS
        # ============================================
        try:
            mentions = db.query(models.CommentReply).filter(
                models.CommentReply.reply_to_user_id == current_user.id,
                models.CommentReply.user_id != current_user.id,
                models.CommentReply.created_at >= yesterday
            ).count()
            count += mentions
        except Exception:
            pass  # CommentReply table might not exist
        
        return {"count": count}
        
    except Exception:
        traceback.print_exc()
        return {"count": 0}


@router.post("/mark-read")
async def mark_notifications_read(
    notification_ids: List[str] = None,
    mark_all: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark notifications as read"""
    try:
        # Since notifications are dynamically generated,
        # we would need a separate table to track read status
        # For now, return success
        return {
            "message": "Notifications marked as read",
            "count": len(notification_ids) if notification_ids else 0
        }
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to mark notifications as read")


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    try:
        # Mark all messages as read
        db.query(models.Message).filter(
            models.Message.sender_id != current_user.id,
            models.Message.is_read == False
        ).update({"is_read": True, "read_at": datetime.utcnow()})
        
        db.commit()
        
        return {"message": "All notifications marked as read"}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to mark all notifications as read")


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification (dismiss it)"""
    try:
        # Since notifications are dynamically generated,
        # we would need a separate table to track dismissed notifications
        # For now, return success
        return {"message": "Notification dismissed"}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to delete notification")