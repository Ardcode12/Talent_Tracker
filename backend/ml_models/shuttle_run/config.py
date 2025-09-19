import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/talent_tracker"
    )
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # API
    api_v1_str: str = "/api"
    project_name: str = "TalentTracker"

    # Pydantic v2 config
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"   # ignore any extra keys in .env
    )

settings = Settings()
