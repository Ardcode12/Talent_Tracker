# backend/core/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from core.security import decode_access_token
from core.config import BASE_URL, UPLOAD_DIR
from database import get_db
import crud, models

security = HTTPBearer()

def get_image_url(image_path: Optional[str]) -> Optional[str]:
    """Return absolute URL for stored images/videos. Mirrors previous helper."""
    if not image_path:
        return None
    if image_path.startswith("http://") or image_path.startswith("https://"):
        return image_path
    if image_path.startswith("/"):
        return f"{BASE_URL}{image_path}"
    return f"{BASE_URL}/{image_path}"

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None
    