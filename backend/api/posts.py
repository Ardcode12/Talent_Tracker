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

router = APIRouter(prefix="/api/posts", tags=["posts"])


# Add this helper function at the top of the file
def get_image_url_with_fallback(image_path: Optional[str], name: str = "User") -> str:
    """Get image URL with fallback to UI Avatars"""
    if image_path:
        url = get_image_url(image_path)
        if url:
            return url
    # Return UI Avatars fallback
    initials = ''.join([part[0].upper() for part in name.split()[:2]]) if name else 'U'
    return f"https://ui-avatars.com/api/?name={initials}&background=6366f1&color=fff&size=200"


@router.get("/feed", response_model=None)
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
                "profile_photo": get_image_url_with_fallback(post.user.profile_photo or post.user.profile_image, post.user.name),
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
        # Ensure directory exists
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


@router.get("/{post_id}/comments", response_model=None)
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
                "profile_photo": get_image_url_with_fallback(comment.user.profile_photo or comment.user.profile_image, comment.user.name)
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


@router.get("/my-posts")
async def get_my_posts(
    page: int = Query(1, ge=1), 
    limit: int = Query(50, le=100), 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Get posts created by the current user only"""
    try:
        offset = (page - 1) * limit
        
        # Query posts by current user only
        posts = db.query(models.Post)\
            .filter(models.Post.user_id == current_user.id)\
            .options(joinedload(models.Post.user))\
            .order_by(models.Post.created_at.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        # Get total count for current user
        total = db.query(models.Post)\
            .filter(models.Post.user_id == current_user.id)\
            .count()
        
        formatted = []
        for post in posts:
            formatted.append({
                "id": str(post.id),
                "user_id": str(post.user_id),
                "user": {
                    "id": str(post.user.id),
                    "name": post.user.name,
                    "profile_photo": get_image_url_with_fallback(post.user.profile_photo or post.user.profile_image, post.user.name),
                    "sport": post.user.sport,
                    "location": post.user.location
                },
                "text": post.text,
                "content": {
                    "text": post.text,
                    "media_url": get_image_url(post.media_url),
                    "media_type": post.media_type
                },
                "media_url": get_image_url(post.media_url),
                "media_type": post.media_type,
                "is_ai_verified": post.is_ai_verified or False,
                "likes_count": post.likes_count or 0,
                "comments_count": post.comments_count or 0,
                "shares_count": post.shares_count or 0,
                "created_at": post.created_at.isoformat() if post.created_at else None
            })
        
        print(f"[MY-POSTS] User {current_user.id} has {total} posts, returning {len(formatted)}")
        
        return {
            "data": formatted, 
            "total": total, 
            "page": page, 
            "limit": limit,
            "user_id": current_user.id
        }
    except Exception as e:
        print(f"Error in get_my_posts: {e}")
        traceback.print_exc()
        return {"data": [], "total": 0, "page": page, "limit": limit, "error": str(e)}


@router.get("/user/{user_id}")
async def get_posts_by_user(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all posts by a specific user"""
    try:
        # Check if user exists
        user = db.query(models.User).filter(
            models.User.id == user_id,
            models.User.is_active == True
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get posts
        offset = (page - 1) * limit
        posts = db.query(models.Post).filter(
            models.Post.user_id == user_id
        ).order_by(
            models.Post.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        # Check which posts current user has liked
        liked_post_ids = set()
        if current_user:
            likes = db.query(models.post_likes.c.post_id).filter(
                models.post_likes.c.user_id == current_user.id,
                models.post_likes.c.post_id.in_([p.id for p in posts])
            ).all()
            liked_post_ids = {like[0] for like in likes}
        
        # Format response
        formatted_posts = []
        for post in posts:
            formatted_posts.append({
                "id": str(post.id),
                "text": post.text,
                "media_url": get_image_url(post.media_url) if post.media_url else None,
                "media_type": post.media_type,
                "likes_count": post.likes_count or 0,
                "comments_count": post.comments_count or 0,
                "shares_count": post.shares_count or 0,
                "is_ai_verified": post.is_ai_verified or False,
                "is_liked": post.id in liked_post_ids,
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
        
        # Get total count
        total = db.query(models.Post).filter(
            models.Post.user_id == user_id
        ).count()
        
        print(f"Found {len(formatted_posts)} posts for user {user_id}")
        
        return {
            "data": formatted_posts,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit if total > 0 else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch user posts: {str(e)}")