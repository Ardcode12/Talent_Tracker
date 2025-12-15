# backend/api/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import timedelta
from core import security, dependencies # Changed
from core.config import ACCESS_TOKEN_EXPIRE_MINUTES # Changed
import crud, schemas # Changed
from database import get_db # Changed

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.AuthResponse)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = crud.get_user_by_email(db, email=user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    created = crud.create_user(db=db, user=user)
    access_token = security.create_access_token(data={"sub": created.email})
    return {"token": access_token, "user": created}


@router.post("/login", response_model=schemas.AuthResponse)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    access_token = security.create_access_token(data={"sub": user.email})
    return {"token": access_token, "user": user}
