# backend/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, BackgroundTasks, Request
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from pathlib import Path
from typing import Optional
import shutil

from core import security, dependencies
from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, UPLOAD_DIR
import crud, schemas, models
from database import get_db

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
    # Block coaches who are pending verification
    if user.role == "coach" and getattr(user, "coach_verify_status", "approved") == "pending":
        raise HTTPException(
            status_code=403,
            detail="Your coach credentials are pending verification. You will be notified once approved."
        )
    if user.role == "coach" and getattr(user, "coach_verify_status", "approved") == "rejected":
        reason = getattr(user, "coach_verify_reason", "")
        raise HTTPException(
            status_code=403,
            detail=f"Your coach credentials were rejected. Reason: {reason or 'Invalid certificate'}. Please contact support."
        )
    access_token = security.create_access_token(data={"sub": user.email})
    return {"token": access_token, "user": user}


# ============================================================================
# COACH REGISTRATION WITH CERTIFICATE
# ============================================================================

def _run_certificate_verification(user_id: int, cert_path: str):
    """
    Background task: run local OCR on the uploaded certificate and
    automatically approve or reject the coach account based on keyword scoring.
    """
    from database import SessionLocal
    from ml_models.certificate_verifier import verify_certificate

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return

        result = verify_certificate(cert_path)
        print(f"[CoachVerify] User {user_id} result: {result}")

        if result["verified"] is True:
            user.coach_verify_status = "approved"
            user.is_active = True
            user.coach_verify_reason = result["reason"]
            print(f"[CoachVerify] User {user_id} APPROVED automatically.")

        elif result["verified"] is False:
            user.coach_verify_status = "rejected"
            user.coach_verify_reason = result["reason"]
            print(f"[CoachVerify] User {user_id} REJECTED automatically.")

        else:
            # Borderline — keep pending, admin can approve via webhook
            user.coach_verify_status = "pending"
            user.coach_verify_reason = (
                "Certificate could not be verified automatically. "
                "Admin review required."
            )
            print(f"[CoachVerify] User {user_id} flagged for manual review.")

        db.commit()

    except Exception as e:
        import traceback
        print(f"[CoachVerify] Error: {e}")
        traceback.print_exc()
    finally:
        db.close()



@router.post("/register-coach")
async def register_coach(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    sport: str = Form(None),
    experience: int = Form(None),
    specialization: str = Form(None),
    certificate: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Coach registration with mandatory certificate upload.
    Account is created in 'pending' state until certificate is verified.
    """
    # Check existing
    if crud.get_user_by_email(db, email=email):
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate file type
    if certificate.filename:
        ext = certificate.filename.lower().split(".")[-1]
        if ext not in ("jpg", "jpeg", "png", "pdf"):
            raise HTTPException(status_code=400, detail="Certificate must be JPG, PNG, or PDF")
    else:
        raise HTTPException(status_code=400, detail="Certificate file is required")

    # Save certificate
    cert_dir = UPLOAD_DIR / "certificates"
    cert_dir.mkdir(exist_ok=True)
    ts = datetime.now().timestamp()
    cert_filename = f"cert_{email.replace('@','_')}_{ts}.{ext}"
    cert_path = cert_dir / cert_filename
    with open(cert_path, "wb") as f:
        shutil.copyfileobj(certificate.file, f)

    # Hash password
    hashed_password = security.get_password_hash(password)

    # Create user as coach with pending status, inactive until verified
    user = models.User(
        name=name,
        email=email,
        password=hashed_password,
        role="coach",
        sport=sport,
        experience=experience,
        specialization=specialization,
        coach_certificate=f"/uploads/certificates/{cert_filename}",
        coach_verify_status="pending",
        is_active=False,  # Cannot login until approved
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Run OCR verification in background
    background_tasks.add_task(_run_certificate_verification, user.id, str(cert_path))

    return {
        "message": "Registration submitted. Your certificate is being verified. You will be able to log in once approved (usually within a few minutes).",
        "status": "pending",
        "email": email,
    }


# ============================================================================
# N8N / WEBHOOK CALLBACK (for manual review decisions)
# ============================================================================

@router.post("/coach-verify-webhook")
async def coach_verify_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook endpoint for n8n or admin to approve/reject a coach.
    Expects JSON: { "user_id": int, "decision": "approved" | "rejected", "reason": str }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    user_id = body.get("user_id")
    decision = body.get("decision")  # "approved" or "rejected"
    reason = body.get("reason", "")

    if not user_id or decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="user_id and decision (approved/rejected) are required")

    user = db.query(models.User).filter(models.User.id == user_id, models.User.role == "coach").first()
    if not user:
        raise HTTPException(status_code=404, detail="Coach not found")

    user.coach_verify_status = decision
    user.coach_verify_reason = reason
    user.is_active = (decision == "approved")
    db.commit()

    return {"message": f"Coach {user_id} {decision} successfully"}
