# backend/core/dependencies.py

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from jose import JWTError, jwt
import urllib.parse

from database import get_db
import models
from core.config import SECRET_KEY, ALGORITHM, BASE_URL

security = HTTPBearer(auto_error=False)


# ============================================================================
# IMAGE URL HELPER FUNCTIONS
# ============================================================================

def generate_avatar_url(name: str, size: int = 128) -> str:
    """
    Generate a UI Avatars URL for users without profile photos.
    """
    safe_name = urllib.parse.quote(name or 'User')
    
    # Color palette for avatars
    colors = [
        "6366f1", "8b5cf6", "ec4899", "f43f5e", 
        "f97316", "eab308", "22c55e", "14b8a6",
        "06b6d4", "3b82f6", "a855f7", "d946ef"
    ]
    
    # Generate consistent color from name
    hash_val = sum(ord(c) for c in (name or 'User'))
    bg_color = colors[hash_val % len(colors)]
    
    return f"https://ui-avatars.com/api/?background={bg_color}&color=fff&name={safe_name}&size={size}&bold=true"


def get_image_url(image_path: Optional[str], fallback_name: str = None) -> Optional[str]:
    """
    Return a clean image path. Returns relative paths so the frontend
    can prepend the correct network IP (avoids localhost issues on mobile).
    """
    if not image_path:
        if fallback_name:
            return generate_avatar_url(fallback_name)
        return None
    
    if str(image_path).lower() in ('null', 'undefined', 'none', ''):
        if fallback_name:
            return generate_avatar_url(fallback_name)
        return None
    
    clean_path = str(image_path).strip()
    if not clean_path:
        if fallback_name:
            return generate_avatar_url(fallback_name)
        return None
    
    # If already a full URL, return as-is
    if clean_path.startswith('http://') or clean_path.startswith('https://'):
        return clean_path
    
    # Return relative path - frontend will prepend correct BASE_URL
    if not clean_path.startswith('/'):
        clean_path = '/uploads/' + clean_path
    
    return clean_path


def get_image_url_with_fallback(image_path: Optional[str], name: str = 'User', size: int = 128) -> str:
    """
    Get image URL with guaranteed fallback (never returns None).
    Returns relative paths so the frontend can prepend the correct network IP.
    """
    if image_path:
        if str(image_path).lower() in ('null', 'undefined', 'none'):
            return generate_avatar_url(name, size)
        
        clean_path = str(image_path).strip()
        if not clean_path:
            return generate_avatar_url(name, size)
        
        if clean_path.startswith('http://') or clean_path.startswith('https://'):
            return clean_path
        
        # Return relative path - frontend will prepend correct BASE_URL
        if not clean_path.startswith('/'):
            clean_path = '/uploads/' + clean_path
        
        return clean_path
    
    return generate_avatar_url(name, size)


# ============================================================================
# AUTHENTICATION DEPENDENCIES
# ============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """Get current authenticated user from JWT token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        
        user = db.query(models.User).filter(models.User.email == email).first()
        return user
    except JWTError:
        return None