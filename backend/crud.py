# backend/crud.py
from sqlalchemy.orm import Session
import models, schemas

# Import the password hashing/verification functions from core.security
from core.security import get_password_hash, verify_password


def get_user_by_email(db: Session, email: str):
    """Get user by email address"""
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user: schemas.UserCreate):
    """Create a new user"""
    hashed_password = get_password_hash(user.password)
    
    # Handle experience conversion safely
    experience_value = None
    if user.experience is not None:
        try:
            experience_value = int(user.experience) if isinstance(user.experience, str) else user.experience
        except (ValueError, TypeError):
            experience_value = None
    
    db_user = models.User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        phone=user.phone,
        role=user.role,
        sport=user.sport,
        experience=experience_value,
        specialization=user.specialization
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str):
    """Authenticate user with email and password"""
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.password):
        return False
    return user


def get_users(db: Session, skip: int = 0, limit: int = 10):
    """Get list of users with pagination"""
    return db.query(models.User).offset(skip).limit(limit).all()