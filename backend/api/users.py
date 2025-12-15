# backend/api/users.py
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Request
from sqlalchemy.orm import Session
from typing import Optional
from core.dependencies import get_current_user, get_current_user_optional, get_image_url # Changed
from core.config import UPLOAD_DIR # Changed
from database import get_db # Changed
import crud, models, schemas # Changed
from datetime import datetime
import shutil
import traceback

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=schemas.UserProfile)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/profile")
async def update_profile(
    age: int = Form(...),
    location: str = Form(...),
    userId: int = Form(...),
    bio: str = Form(None),
    height: str = Form(None),
    weight: str = Form(None),
    achievements: str = Form(None),
    skills: str = Form(None),
    profileImage: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    try:
        user = db.query(models.User).filter(models.User.id == userId).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"User with id {userId} not found")

        user.age = age
        user.location = location.strip()
        if bio:
            user.bio = bio.strip()
        if height:
            user.height = height.strip()
        if weight:
            user.weight = weight.strip()
        if achievements:
            user.achievements = achievements
        if skills:
            user.skills = skills

        if profileImage and profileImage.filename:
            extension = profileImage.filename.split(".")[-1].lower()
            if extension == "jpeg":
                extension = "jpg"
            file_name = f"profile_{userId}_{datetime.now().timestamp()}.{extension}"
            file_path = UPLOAD_DIR / file_name

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(profileImage.file, buffer)

            image_url = f"/uploads/{file_name}"
            user.profile_image = image_url
            user.profile_photo = image_url

        db.commit()
        db.refresh(user)

        return {
            "message": "Profile updated successfully",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "age": user.age,
                "location": user.location,
                "bio": user.bio,
                "height": user.height,
                "weight": user.weight,
                "achievements": user.achievements,
                "skills": user.skills,
                "profile_image": user.profile_image,
                "profile_photo": user.profile_photo,
                "role": user.role,
                "sport": user.sport,
                "phone": user.phone,
            }
        }
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=schemas.UserStats)
async def get_user_stats(current_user: models.User = Depends(get_current_user)):
    return {
        "data": {
            "name": current_user.name,
            "profilePhoto": get_image_url(current_user.profile_photo or current_user.profile_image),
            "nationalRank": getattr(current_user, 'national_rank', None),
            "aiScore": getattr(current_user, 'ai_score', None),
            "weeklyProgress": getattr(current_user, 'weekly_progress', 0) or 0
        }
    }
