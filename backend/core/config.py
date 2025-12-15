# backend/core/config.py
import os
from pathlib import Path

# Security / JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Uploads and static
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "posts").mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "assessments").mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "profiles").mkdir(parents=True, exist_ok=True)

# Base URL for building absolute URLs (used by get_image_url)
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
