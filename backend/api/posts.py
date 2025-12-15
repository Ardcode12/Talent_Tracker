# backend/api/posts.py
from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from database import get_db # Changed
from core.dependencies import get_current_user, get_image_url # Changed
from core.config import UPLOAD_DIR # Changed
import models, schemas # Changed
import shutil
from datetime import datetime
import traceback

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("/feed", response_model=None) # Set None, assuming complex dict, adjust if specific schema applies
async def get_feed_posts(page: int = Query(1, ge=1), limit: int = Query(10, le=50), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    offset = (page - 1) * limit
    if not hasattr(models, 'Post'):
        return {"data": [], "total": 0, "page": page, "limit": limit}
    posts = db.query(models.Post).options(joinedload(models.Post.user)).order_by(models.Post.created_at.desc()).offset(offset).limit(limit).all()
    formatted = []
    for post in posts:
        is_liked = db.query(models.post_likes).filter(models.post_likes.c.user_id == current_user.id, models.post_likes.c.post_id == post.id).first() is not None
        formatted.append({
            "id": str(post.id),
            "user": {
                "id": str(post.user.id),
                "name": post.user.name,
                "profile_photo": get_image_url(post.user.profile_photo or post.user.profile_image),
                "sport": post.user.sport,
                "location": post.user.location
            },
            "content": {
                "text": post.text,
                "media_url": get_image_url(post.media_url),
                "media_type": post.media_type
            },
            "is_ai_verified": post.is_ai_verified,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "shares_count": post.shares_count,
            "is_liked": is_liked,
            "created_at": post.created_at.isoformat()
        })
    total = db.query(models.Post).count()
    return {"data": formatted, "total": total, "page": page, "limit": limit}


@router.post("")
async def create_post(text: str = Form(...), media: Optional[UploadFile] = File(None), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not text or len(text.strip()) == 0:
        raise HTTPException(
            status_code=422,
            detail="Post text is required and cannot be empty"
        )
    
    if not hasattr(models, 'Post'):
        raise HTTPException(status_code=501, detail="Posts feature not implemented yet")
    
    media_url = None
    media_type = None
    
    if media:
        media_filename = f"{current_user.id}_{datetime.now().timestamp()}_{media.filename}"
        media_path = UPLOAD_DIR / "posts" / media_filename
        
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


@router.post("/{post_id}/like")
async def like_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not hasattr(models, 'Post'):
        raise HTTPException(status_code=501, detail="Posts feature not implemented yet")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing_like = db.query(models.post_likes).filter(
        models.post_likes.c.user_id == current_user.id,
        models.post_likes.c.post_id == post_id
    ).first()
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked")
    
    stmt = models.post_likes.insert().values(
        user_id=current_user.id,
        post_id=post_id
    )
    db.execute(stmt)
    
    post.likes_count += 1
    db.commit()
    
    return {"message": "Post liked successfully"}


@router.delete("/{post_id}/unlike")
async def unlike_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not hasattr(models, 'Post'):
        raise HTTPException(status_code=501, detail="Posts feature not implemented yet")
    
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
    
    post.likes_count = max(0, post.likes_count - 1)
    db.commit()
    
    return {"message": "Post unliked successfully"}


@router.get("/{post_id}/comments", response_model=None) # Set None, adjust if specific schema applies
async def get_comments(post_id: int, db: Session = Depends(get_db)):
    if not hasattr(models, 'Comment'):
        return {"data": []}
    
    comments = db.query(models.Comment)\
        .filter(models.Comment.post_id == post_id)\
        .options(joinedload(models.Comment.user))\
        .order_by(models.Comment.created_at.desc())\
        .all()
    
    formatted_comments = []
    for comment in comments:
        formatted_comments.append({
            "id": str(comment.id),
            "user": {
                "id": str(comment.user.id),
                "name": comment.user.name,
                "profile_photo": get_image_url(comment.user.profile_photo or comment.user.profile_image)
            },
            "text": comment.text,
            "created_at": comment.created_at.isoformat()
        })
    
    return {"data": formatted_comments}


@router.post("/{post_id}/comments")
async def add_comment(post_id: int, text: str = Form(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not hasattr(models, 'Comment') or not hasattr(models, 'Post'):
        raise HTTPException(status_code=501, detail="Comments feature not implemented yet")
    
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = models.Comment(
        post_id=post_id,
        user_id=current_user.id,
        text=text
    )
    
    db.add(comment)
    post.comments_count += 1
    db.commit()
    db.refresh(comment)
    
    return {"message": "Comment added successfully", "comment_id": comment.id}
