# crud.py or your auth utils
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models, schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Password hashing ---
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# --- User creation ---
def create_user(db: Session, **user_data):
    # Hash password
    hashed_password = get_password_hash(user_data.pop("password"))
    user_data["password_hash"] = hashed_password

    # Handle empty experience
    if user_data.get("experience") in ("", None):
        user_data["experience"] = None
    else:
        user_data["experience"] = int(user_data["experience"])

    # Create user instance
    db_user = models.User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


# --- Get user by email ---
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

# --- Authenticate user ---
def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.password_hash):
        return False
    return user

# --- List users ---
def get_users(db: Session, skip: int = 0, limit: int = 10):
    return db.query(models.User).offset(skip).limit(limit).all()
