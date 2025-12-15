# backend/crud.py
from sqlalchemy.orm import Session
import models, schemas 

# Import the password hashing/verification functions from core.security
from core.security import get_password_hash, verify_password

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        phone=user.phone,
        role=user.role,
        sport=user.sport,
        experience=user.experience,
        specialization=user.specialization
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.password):
        return False
    return user

def get_users(db: Session, skip: int = 0, limit: int = 10):
    return db.query(models.User).offset(skip).limit(limit).all()
