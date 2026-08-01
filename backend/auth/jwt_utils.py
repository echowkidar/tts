"""JWT authentication utilities and password hashing."""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "echowkidar_secret_key_change_in_production_987654321")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

import hashlib

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _prepare_password(password: str) -> str:
    """Pre-hash password with SHA-256 to guarantee fixed 64-char length (always < 72 bytes)."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """Hash password using SHA256 pre-hashing + bcrypt."""
    prep = _prepare_password(password)
    return pwd_context.hash(prep)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password with fallback to direct check."""
    if not hashed_password:
        return False
    try:
        prep = _prepare_password(plain_password)
        return pwd_context.verify(prep, hashed_password)
    except Exception:
        try:
            # Fallback for plain passwords hashed prior to pre-hashing
            truncated = plain_password.encode("utf-8")[:72].decode("utf-8", errors="ignore")
            return pwd_context.verify(truncated, hashed_password)
        except Exception:
            return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
