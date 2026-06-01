# backend/core/config.py

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Upload directory
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Create subdirectories
(UPLOAD_DIR / "posts").mkdir(exist_ok=True)
(UPLOAD_DIR / "assessments").mkdir(exist_ok=True)
(UPLOAD_DIR / "profiles").mkdir(exist_ok=True)

# Database settings from .env
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "arnald2826")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "talent_tracker")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Base URL for the API - ALWAYS use localhost for local development
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000").strip('"').strip("'")

# Security settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here").strip('"').strip("'")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for better UX


# Simple settings class for compatibility
class Settings:
    def __init__(self):
        self.database_url = DATABASE_URL
        self.secret_key = SECRET_KEY
        self.algorithm = ALGORITHM
        self.access_token_expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES
        self.api_v1_str = "/api"
        self.project_name = "TalentTracker"
        self.base_url = BASE_URL


settings = Settings()

# Print config on import for debugging
print(f"[Config] BASE_URL: {BASE_URL}")
print(f"[Config] Database: {DB_HOST}:{DB_PORT}/{DB_NAME}")