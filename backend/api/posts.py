# backend/api/posts.py
from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from database import get_db
from core.dependencies import get_current_user, get_image_url
from core.config import UPLOAD_DIR
import models, schemas
import shutil
from datetime import datetime
import traceback
import os

router = APIRouter(prefix="/api/posts", tags=["posts"])


def get_image_url_with_fallback(image_path: Optional[str], name: str = "User") -> str:
    """Get image URL with fallback to UI Avatars"""
    if image_path:
        url = get_image_url(image_path)
        if url:
            return url
    initials = ''.join([part[0].upper() for part in name.split()[:2]]) if name else 'U'
    return f"https://ui-avatars.com/api/?name={initials}&background=6366f1&color=fff&size=200"


# ============================================
# FEED ENDPOINT
# ============================================
@router.get("/feed")
async def get_feed_posts(
    page: int = Query(1, ge=1), 
    limit: int = Query(10, ge=1, le=50), 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        offset = (page - 1) * limit
        
        posts = db.query(models.Post).options(
            joinedload(models.Post.user)
        ).order_by(models.Post.created_at.desc()).offset(offset).limit(limit).all()
        
        formatted = []
        for post in posts:
            is_liked = db.query(models.post_likes).filter(
                models.post_likes.c.user_id == current_user.id, 
                models.post_likes.c.post_id == post.id
            ).first() is not None
            
            formatted.append({
                "id": str(post.id),
                "user": {
                    "id": str(post.user.id),
                    "name": post.user.name,
                    "profile_photo": get_image_url_with_fallback(
                        post.user.profile_photo or post.user.profile_image, 
                        post.user.name
                    ),
                    "sport": post.user.sport,
                    "location": post.user.location
                },
                "content": {
                    "text": post.text or "",
                    "media_url": get_image_url(post.media_url) if post.media_url else None,
                    "media_type": post.media_type
                },
                "is_ai_verified": post.is_ai_verified or False,
                "likes_count": post.likes_count or 0,
                "comments_count": post.comments_count or 0,
                "shares_count": post.shares_count or 0,
                "is_liked": is_liked,
                "is_own_post": post.user_id == current_user.id,
                "created_at": post.created_at.isoformat() if post.created_at else None
            })
        
        total = db.query(models.Post).count()
        return {"data": formatted, "total": total, "page": page, "limit": limit}
    except Exception as e:
        print(f"Error in get_feed_posts: {e}")
        traceback.print_exc()
        return {"data": [], "total": 0, "page": page, "limit": limit}


# ============================================
# MY POSTS - MUST BE BEFORE /{post_id}
# ============================================
@router.get("/my-posts")
async def get_my_posts(
    page: int = Query(1, ge=1), 
    limit: int = Query(50, ge=1, le=100), 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Get posts created by the current user only"""
    try:
        print(f"[MY-POSTS] Fetching posts for user {current_user.id}")
        
        offset = (page - 1) * limit
        
        posts = db.query(models.Post)\
            .filter(models.Post.user_id == current_user.id)\
            .order_by(models.Post.created_at.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        total = db.query(models.Post)\
            .filter(models.Post.user_id == current_user.id)\
            .count()
        
        formatted = []
        for post in posts:
            formatted.append({
                "id": str(post.id),
                "user_id": str(post.user_id),
                "user": {
                    "id": str(current_user.id),
                    "name": current_user.name,
                    "profile_photo": get_image_url_with_fallback(
                        current_user.profile_photo or current_user.profile_image, 
                        current_user.name
                    ),
                    "sport": current_user.sport,
                    "location": current_user.location
                },
                "text": post.text or "",
                "content": {
                    "text": post.text or "",
                    "media_url": get_image_url(post.media_url) if post.media_url else None,
                    "media_type": post.media_type
                },
                "media_url": get_image_url(post.media_url) if post.media_url else None,
                "media_type": post.media_type,
                "is_ai_verified": post.is_ai_verified or False,
                "likes_count": post.likes_count or 0,
                "comments_count": post.comments_count or 0,
                "shares_count": post.shares_count or 0,
                "is_own_post": True,
                "created_at": post.created_at.isoformat() if post.created_at else None
            })
        
        print(f"[MY-POSTS] Returning {len(formatted)} posts for user {current_user.id}")
        
        return {
            "data": formatted, 
            "total": total, 
            "page": page, 
            "limit": limit
        }
    except Exception as e:
        print(f"Error in get_my_posts: {e}")
        traceback.print_exc()
        return {"data": [], "total": 0, "page": page, "limit": limit}


# ============================================
# USER POSTS - MUST BE BEFORE /{post_id}
# ============================================
@router.get("/user/{user_id}")
async def get_posts_by_user(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all posts by a specific user"""
    try:
        user = db.query(models.User).filter(
            models.User.id == user_id,
            models.User.is_active == True
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        offset = (page - 1) * limit
        posts = db.query(models.Post).filter(
            models.Post.user_id == user_id
        ).order_by(
            models.Post.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        liked_post_ids = set()
        if current_user:
            likes = db.query(models.post_likes.c.post_id).filter(
                models.post_likes.c.user_id == current_user.id,
                models.post_likes.c.post_id.in_([p.id for p in posts])
            ).all()
            liked_post_ids = {like[0] for like in likes}
        
        formatted_posts = []
        for post in posts:
            formatted_posts.append({
                "id": str(post.id),
                "text": post.text or "",
                "content": {
                    "text": post.text or "",
                    "media_url": get_image_url(post.media_url) if post.media_url else None,
                    "media_type": post.media_type
                },
                "media_url": get_image_url(post.media_url) if post.media_url else None,
                "media_type": post.media_type,
                "likes_count": post.likes_count or 0,
                "comments_count": post.comments_count or 0,
                "shares_count": post.shares_count or 0,
                "is_ai_verified": post.is_ai_verified or False,
                "is_liked": post.id in liked_post_ids,
                "is_own_post": user_id == current_user.id,
                "created_at": post.created_at.isoformat() if post.created_at else None,
                "user": {
                    "id": str(user.id),
                    "name": user.name,
                    "profile_photo": get_image_url_with_fallback(
                        user.profile_photo or user.profile_image,
                        user.name
                    ),
                    "sport": user.sport,
                    "location": user.location
                }
            })
        
        total = db.query(models.Post).filter(models.Post.user_id == user_id).count()
        
        return {
            "data": formatted_posts,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_posts_by_user: {e}")
        traceback.print_exc()
        return {"data": [], "total": 0, "page": page, "pages": 0}


# ============================================
# CREATE POST
# ============================================
@router.post("")
async def create_post(
    text: str = Form(...), 
    media: Optional[UploadFile] = File(None), 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=422, detail="Post text is required")
    
    media_url = None
    media_type = None
    
    if media:
        posts_dir = UPLOAD_DIR / "posts"
        posts_dir.mkdir(parents=True, exist_ok=True)
        
        media_filename = f"{current_user.id}_{datetime.now().timestamp()}_{media.filename}"
        media_path = posts_dir / media_filename
        
        with open(media_path, "wb") as buffer:
            shutil.copyfileobj(media.file, buffer)
        
        media_url = f"/uploads/posts/{media_filename}"
        media_type = "image" if media.content_type.startswith("image") else "video"
    
    post = models.Post(
        user_id=current_user.id,
        text=text.strip(),
        media_url=media_url,
        media_type=media_type,
        is_ai_verified=False
    )
    
    db.add(post)
    db.commit()
    db.refresh(post)
    
    return {"message": "Post created successfully", "post_id": post.id}


# ============================================
# LIKE/UNLIKE POST
# ============================================
@router.post("/{post_id}/like")
async def like_post(
    post_id: int, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing_like = db.query(models.post_likes).filter(
        models.post_likes.c.user_id == current_user.id,
        models.post_likes.c.post_id == post_id
    ).first()
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked")
    
    stmt = models.post_likes.insert().values(user_id=current_user.id, post_id=post_id)
    db.execute(stmt)
    post.likes_count = (post.likes_count or 0) + 1
    db.commit()
    
    return {"message": "Post liked successfully", "likes_count": post.likes_count}


@router.delete("/{post_id}/unlike")
async def unlike_post(
    post_id: int, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    stmt = models.post_likes.delete().where(
        models.post_likes.c.user_id == current_user.id,
        models.post_likes.c.post_id == post_id
    )
    result = db.execute(stmt)
    
    if result.rowcount == 0:
        raise HTTPException(status_code=400, detail="Not liked")
    
    post.likes_count = max(0, (post.likes_count or 0) - 1)
    db.commit()
    
    return {"message": "Post unliked successfully", "likes_count": post.likes_count}


# ============================================
# SHARE POST
# ============================================
@router.post("/{post_id}/share")
async def share_post(
    post_id: int,
    share_type: str = Form("external"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Track post shares"""
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post.shares_count = (post.shares_count or 0) + 1
    db.commit()
    
    share_link = f"talenttracker://post/{post_id}"
    
    return {
        "message": "Share tracked successfully",
        "shares_count": post.shares_count,
        "share_link": share_link
    }


# ============================================
# GET COMMENTS (with replies and likes support)
# ============================================
@router.get("/{post_id}/comments")
async def get_comments(
    post_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all comments for a post with replies preview and like status"""
    print(f"[GET_COMMENTS] Fetching comments for post {post_id}, user {current_user.id}")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    offset = (page - 1) * limit
    
    # Get comments with user and replies
    comments = db.query(models.Comment)\
        .filter(models.Comment.post_id == post_id)\
        .options(
            joinedload(models.Comment.user),
            joinedload(models.Comment.replies).joinedload(models.CommentReply.user),
            joinedload(models.Comment.replies).joinedload(models.CommentReply.reply_to_user)
        )\
        .order_by(models.Comment.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()
    
    total = db.query(models.Comment).filter(models.Comment.post_id == post_id).count()
    
    # Get liked comment IDs for current user
    liked_comment_ids = set()
    if comments:
        comment_ids = [c.id for c in comments]
        likes = db.query(models.comment_likes.c.comment_id).filter(
            models.comment_likes.c.user_id == current_user.id,
            models.comment_likes.c.comment_id.in_(comment_ids)
        ).all()
        liked_comment_ids = {like[0] for like in likes}
        print(f"[GET_COMMENTS] User {current_user.id} has liked comments: {liked_comment_ids}")
    
    # Get liked reply IDs
    all_reply_ids = []
    for comment in comments:
        all_reply_ids.extend([r.id for r in comment.replies[:3]])
    
    liked_reply_ids = set()
    if all_reply_ids:
        reply_likes = db.query(models.reply_likes.c.reply_id).filter(
            models.reply_likes.c.user_id == current_user.id,
            models.reply_likes.c.reply_id.in_(all_reply_ids)
        ).all()
        liked_reply_ids = {like[0] for like in reply_likes}
    
    formatted_comments = []
    for comment in comments:
        # Format replies preview (first 2)
        replies_preview = []
        for reply in comment.replies[:2]:
            replies_preview.append({
                "id": str(reply.id),
                "user": {
                    "id": str(reply.user.id),
                    "name": reply.user.name,
                    "profile_photo": get_image_url_with_fallback(
                        reply.user.profile_photo or reply.user.profile_image,
                        reply.user.name
                    ),
                    "sport": reply.user.sport
                },
                "text": reply.text,
                "reply_to_user": {
                    "id": str(reply.reply_to_user.id),
                    "name": reply.reply_to_user.name
                } if reply.reply_to_user else None,
                "likes_count": reply.likes_count or 0,
                "is_liked": reply.id in liked_reply_ids,
                "is_own_reply": reply.user_id == current_user.id,
                "created_at": reply.created_at.isoformat() if reply.created_at else None
            })
        
        is_liked = comment.id in liked_comment_ids
        
        formatted_comments.append({
            "id": str(comment.id),
            "user": {
                "id": str(comment.user.id),
                "name": comment.user.name,
                "profile_photo": get_image_url_with_fallback(
                    comment.user.profile_photo or comment.user.profile_image, 
                    comment.user.name
                ),
                "sport": comment.user.sport
            },
            "text": comment.text,
            "likes_count": comment.likes_count or 0,
            "replies_count": comment.replies_count or len(comment.replies),
            "is_liked": is_liked,
            "is_own_comment": comment.user_id == current_user.id,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
            "replies": replies_preview,
            "has_more_replies": len(comment.replies) > 2
        })
    
    # Get post info
    post_user = db.query(models.User).filter(models.User.id == post.user_id).first()
    
    print(f"[GET_COMMENTS] Returning {len(formatted_comments)} comments")
    
    return {
        "data": formatted_comments,
        "total": total,
        "page": page,
        "limit": limit,
        "post": {
            "id": str(post.id),
            "user_name": post_user.name if post_user else "Unknown",
            "text": (post.text[:100] + "...") if post.text and len(post.text) > 100 else (post.text or "")
        }
    }


# ============================================
# ADD COMMENT
# ============================================
@router.post("/{post_id}/comments")
async def add_comment(
    post_id: int, 
    text: str = Form(...), 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Add a comment to a post"""
    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=422, detail="Comment text is required")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = models.Comment(
        post_id=post_id,
        user_id=current_user.id,
        text=text.strip(),
        likes_count=0,
        replies_count=0
    )
    
    db.add(comment)
    post.comments_count = (post.comments_count or 0) + 1
    db.commit()
    db.refresh(comment)
    
    return {
        "message": "Comment added successfully",
        "comment": {
            "id": str(comment.id),
            "user": {
                "id": str(current_user.id),
                "name": current_user.name,
                "profile_photo": get_image_url_with_fallback(
                    current_user.profile_photo or current_user.profile_image,
                    current_user.name
                ),
                "sport": current_user.sport
            },
            "text": comment.text,
            "likes_count": 0,
            "replies_count": 0,
            "is_liked": False,
            "is_own_comment": True,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
            "replies": [],
            "has_more_replies": False
        },
        "comments_count": post.comments_count
    }


# ============================================
# DELETE COMMENT
# ============================================
@router.delete("/{post_id}/comments/{comment_id}")
async def delete_comment(
    post_id: int,
    comment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a comment"""
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    
    if comment.user_id != current_user.id and post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot delete this comment")
    
    # Delete comment likes
    db.execute(models.comment_likes.delete().where(
        models.comment_likes.c.comment_id == comment_id
    ))
    
    # Delete all replies and their likes
    reply_ids = [r.id for r in comment.replies]
    if reply_ids:
        db.execute(models.reply_likes.delete().where(
            models.reply_likes.c.reply_id.in_(reply_ids)
        ))
    
    db.delete(comment)
    post.comments_count = max(0, (post.comments_count or 0) - 1)
    db.commit()
    
    return {
        "message": "Comment deleted successfully",
        "comments_count": post.comments_count
    }


# ============================================
# COMMENT LIKES
# ============================================
@router.post("/{post_id}/comments/{comment_id}/like")
async def like_comment(
    post_id: int,
    comment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Like a comment"""
    print(f"[LIKE_COMMENT] User {current_user.id} liking comment {comment_id}")
    
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if already liked
    existing_like = db.query(models.comment_likes).filter(
        models.comment_likes.c.user_id == current_user.id,
        models.comment_likes.c.comment_id == comment_id
    ).first()
    
    if existing_like:
        print(f"[LIKE_COMMENT] Already liked!")
        raise HTTPException(status_code=400, detail="Already liked")
    
    # Add like
    stmt = models.comment_likes.insert().values(
        user_id=current_user.id,
        comment_id=comment_id
    )
    db.execute(stmt)
    comment.likes_count = (comment.likes_count or 0) + 1
    db.commit()
    
    print(f"[LIKE_COMMENT] Success! New count: {comment.likes_count}")
    
    return {
        "message": "Comment liked",
        "likes_count": comment.likes_count,
        "is_liked": True
    }


@router.delete("/{post_id}/comments/{comment_id}/unlike")
async def unlike_comment(
    post_id: int,
    comment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unlike a comment"""
    print(f"[UNLIKE_COMMENT] User {current_user.id} unliking comment {comment_id}")
    
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    stmt = models.comment_likes.delete().where(
        models.comment_likes.c.user_id == current_user.id,
        models.comment_likes.c.comment_id == comment_id
    )
    result = db.execute(stmt)
    
    if result.rowcount == 0:
        raise HTTPException(status_code=400, detail="Not liked")
    
    comment.likes_count = max(0, (comment.likes_count or 0) - 1)
    db.commit()
    
    print(f"[UNLIKE_COMMENT] Success! New count: {comment.likes_count}")
    
    return {
        "message": "Comment unliked",
        "likes_count": comment.likes_count,
        "is_liked": False
    }


# ============================================
# GET REPLIES
# ============================================
@router.get("/{post_id}/comments/{comment_id}/replies")
async def get_replies(
    post_id: int,
    comment_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get replies for a comment"""
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    offset = (page - 1) * limit
    
    replies = db.query(models.CommentReply)\
        .filter(models.CommentReply.comment_id == comment_id)\
        .options(
            joinedload(models.CommentReply.user),
            joinedload(models.CommentReply.reply_to_user)
        )\
        .order_by(models.CommentReply.created_at.asc())\
        .offset(offset)\
        .limit(limit + 1)\
        .all()
    
    has_more = len(replies) > limit
    replies = replies[:limit]
    
    # Get liked reply IDs
    liked_reply_ids = set()
    if replies:
        likes = db.query(models.reply_likes.c.reply_id).filter(
            models.reply_likes.c.user_id == current_user.id,
            models.reply_likes.c.reply_id.in_([r.id for r in replies])
        ).all()
        liked_reply_ids = {like[0] for like in likes}
    
    formatted_replies = []
    for reply in replies:
        formatted_replies.append({
            "id": str(reply.id),
            "user": {
                "id": str(reply.user.id),
                "name": reply.user.name,
                "profile_photo": get_image_url_with_fallback(
                    reply.user.profile_photo or reply.user.profile_image,
                    reply.user.name
                ),
                "sport": reply.user.sport
            },
            "text": reply.text,
            "reply_to_user": {
                "id": str(reply.reply_to_user.id),
                "name": reply.reply_to_user.name,
                "profile_photo": get_image_url_with_fallback(
                    reply.reply_to_user.profile_photo,
                    reply.reply_to_user.name
                )
            } if reply.reply_to_user else None,
            "likes_count": reply.likes_count or 0,
            "is_liked": reply.id in liked_reply_ids,
            "is_own_reply": reply.user_id == current_user.id,
            "created_at": reply.created_at.isoformat() if reply.created_at else None
        })
    
    total = db.query(models.CommentReply)\
        .filter(models.CommentReply.comment_id == comment_id)\
        .count()
    
    return {
        "data": formatted_replies,
        "total": total,
        "page": page,
        "has_more": has_more
    }


# ============================================
# ADD REPLY
# ============================================
@router.post("/{post_id}/comments/{comment_id}/replies")
async def add_reply(
    post_id: int,
    comment_id: int,
    text: str = Form(...),
    reply_to_user_id: Optional[int] = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a reply to a comment"""
    print(f"[ADD_REPLY] User {current_user.id} replying to comment {comment_id}")
    
    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=422, detail="Reply text is required")
    
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id,
        models.Comment.post_id == post_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    reply_to_user = None
    if reply_to_user_id:
        reply_to_user = db.query(models.User).filter(
            models.User.id == reply_to_user_id
        ).first()
    
    reply = models.CommentReply(
        comment_id=comment_id,
        user_id=current_user.id,
        text=text.strip(),
        reply_to_user_id=reply_to_user_id if reply_to_user else None,
        likes_count=0
    )
    
    db.add(reply)
    comment.replies_count = (comment.replies_count or 0) + 1
    db.commit()
    db.refresh(reply)
    
    print(f"[ADD_REPLY] Success! Reply ID: {reply.id}")
    
    return {
        "message": "Reply added successfully",
        "reply": {
            "id": str(reply.id),
            "user": {
                "id": str(current_user.id),
                "name": current_user.name,
                "profile_photo": get_image_url_with_fallback(
                    current_user.profile_photo or current_user.profile_image,
                    current_user.name
                ),
                "sport": current_user.sport
            },
            "text": reply.text,
            "reply_to_user": {
                "id": str(reply_to_user.id),
                "name": reply_to_user.name
            } if reply_to_user else None,
            "likes_count": 0,
            "is_liked": False,
            "is_own_reply": True,
            "created_at": reply.created_at.isoformat() if reply.created_at else None
        },
        "replies_count": comment.replies_count
    }


# ============================================
# DELETE REPLY
# ============================================
@router.delete("/{post_id}/comments/{comment_id}/replies/{reply_id}")
async def delete_reply(
    post_id: int,
    comment_id: int,
    reply_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a reply"""
    reply = db.query(models.CommentReply).filter(
        models.CommentReply.id == reply_id,
        models.CommentReply.comment_id == comment_id
    ).first()
    
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    
    comment = db.query(models.Comment).filter(
        models.Comment.id == comment_id
    ).first()
    
    post = db.query(models.Post).filter(
        models.Post.id == post_id
    ).first()
    
    if (reply.user_id != current_user.id and 
        comment.user_id != current_user.id and 
        post.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="You cannot delete this reply")
    
    # Delete reply likes
    db.execute(models.reply_likes.delete().where(
        models.reply_likes.c.reply_id == reply_id
    ))
    
    db.delete(reply)
    comment.replies_count = max(0, (comment.replies_count or 0) - 1)
    db.commit()
    
    return {
        "message": "Reply deleted successfully",
        "replies_count": comment.replies_count
    }


# ============================================
# REPLY LIKES
# ============================================
@router.post("/{post_id}/comments/{comment_id}/replies/{reply_id}/like")
async def like_reply(
    post_id: int,
    comment_id: int,
    reply_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Like a reply"""
    reply = db.query(models.CommentReply).filter(
        models.CommentReply.id == reply_id,
        models.CommentReply.comment_id == comment_id
    ).first()
    
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    
    existing_like = db.query(models.reply_likes).filter(
        models.reply_likes.c.user_id == current_user.id,
        models.reply_likes.c.reply_id == reply_id
    ).first()
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked")
    
    stmt = models.reply_likes.insert().values(
        user_id=current_user.id,
        reply_id=reply_id
    )
    db.execute(stmt)
    reply.likes_count = (reply.likes_count or 0) + 1
    db.commit()
    
    return {
        "message": "Reply liked",
        "likes_count": reply.likes_count,
        "is_liked": True
    }


@router.delete("/{post_id}/comments/{comment_id}/replies/{reply_id}/unlike")
async def unlike_reply(
    post_id: int,
    comment_id: int,
    reply_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unlike a reply"""
    reply = db.query(models.CommentReply).filter(
        models.CommentReply.id == reply_id,
        models.CommentReply.comment_id == comment_id
    ).first()
    
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    
    stmt = models.reply_likes.delete().where(
        models.reply_likes.c.user_id == current_user.id,
        models.reply_likes.c.reply_id == reply_id
    )
    result = db.execute(stmt)
    
    if result.rowcount == 0:
        raise HTTPException(status_code=400, detail="Not liked")
    
    reply.likes_count = max(0, (reply.likes_count or 0) - 1)
    db.commit()
    
    return {
        "message": "Reply unliked",
        "likes_count": reply.likes_count,
        "is_liked": False
    }


# ============================================
# GET SINGLE POST - MUST BE AFTER ALL SPECIFIC ROUTES
# ============================================
@router.get("/{post_id}")
async def get_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single post by ID"""
    post = db.query(models.Post).options(
        joinedload(models.Post.user)
    ).filter(models.Post.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    is_liked = db.query(models.post_likes).filter(
        models.post_likes.c.user_id == current_user.id,
        models.post_likes.c.post_id == post.id
    ).first() is not None
    
    return {
        "id": str(post.id),
        "user": {
            "id": str(post.user.id),
            "name": post.user.name,
            "profile_photo": get_image_url_with_fallback(
                post.user.profile_photo or post.user.profile_image,
                post.user.name
            ),
            "sport": post.user.sport,
            "location": post.user.location
        },
        "content": {
            "text": post.text or "",
            "media_url": get_image_url(post.media_url) if post.media_url else None,
            "media_type": post.media_type
        },
        "is_ai_verified": post.is_ai_verified or False,
        "likes_count": post.likes_count or 0,
        "comments_count": post.comments_count or 0,
        "shares_count": post.shares_count or 0,
        "is_liked": is_liked,
        "is_own_post": post.user_id == current_user.id,
        "created_at": post.created_at.isoformat() if post.created_at else None
    }


# ============================================
# DELETE POST
# ============================================
@router.delete("/{post_id}")
async def delete_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a post (only by owner)"""
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    if post.media_url:
        try:
            media_path = UPLOAD_DIR / post.media_url.lstrip('/')
            if os.path.exists(media_path):
                os.remove(media_path)
        except Exception as e:
            print(f"Error deleting media file: {e}")
    
    db.execute(models.post_likes.delete().where(models.post_likes.c.post_id == post_id))
    db.query(models.Comment).filter(models.Comment.post_id == post_id).delete()
    db.delete(post)
    db.commit()
    
    return {"message": "Post deleted successfully"}


# ============================================
# UPDATE POST
# ============================================
@router.put("/{post_id}")
async def update_post(
    post_id: int,
    text: str = Form(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a post (only by owner)"""
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own posts")
    
    post.text = text.strip()
    post.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Post updated successfully"}