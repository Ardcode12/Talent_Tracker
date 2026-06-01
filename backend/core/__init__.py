
# backend/core/__init__.py

from .config import (
    SECRET_KEY, 
    ALGORITHM, 
    ACCESS_TOKEN_EXPIRE_MINUTES, 
    UPLOAD_DIR,
    BASE_URL,
    DATABASE_URL,
    settings
)
from .security import (
    verify_password, 
    get_password_hash, 
    create_access_token,
    decode_access_token
)
from .dependencies import (
    get_current_user, 
    get_current_user_optional, 
    get_image_url, 
    get_image_url_with_fallback,
    generate_avatar_url
)