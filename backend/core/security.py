# backend/core/security.py

import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# Define the maximum password length for bcrypt
MAX_PASSWORD_BYTES = 72


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        # Truncate the plain password before verification if it exceeds the bcrypt limit
        truncated_plain_password_bytes = plain_password.encode('utf-8')[:MAX_PASSWORD_BYTES]
        
        # bcrypt expects hashed password as bytes
        if isinstance(hashed_password, str):
            hashed_password_bytes = hashed_password.encode('utf-8')
        else:
            hashed_password_bytes = hashed_password

        # Use bcrypt.checkpw directly
        return bcrypt.checkpw(truncated_plain_password_bytes, hashed_password_bytes)
    except (ValueError, TypeError) as e:
        # Catch potential errors from bcrypt (e.g., invalid salt in hash)
        print(f"Error during bcrypt.checkpw: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    # Truncate the password before hashing if it exceeds the bcrypt limit
    truncated_password_bytes = password.encode('utf-8')[:MAX_PASSWORD_BYTES]
    
    # Generate a salt and hash the password using bcrypt directly
    salt = bcrypt.gensalt()
    hashed_password_bytes = bcrypt.hashpw(truncated_password_bytes, salt)
    
    # Return the hash as a UTF-8 string (to store in DB)
    return hashed_password_bytes.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode JWT access token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None