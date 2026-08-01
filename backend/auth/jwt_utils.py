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
    """Store plain text password as requested."""
    return password


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain text password with fallback for existing hashes."""
    if not hashed_password:
        return False
    if plain_password == hashed_password:
        return True
    try:
        prep = _prepare_password(plain_password)
        return pwd_context.verify(prep, hashed_password)
    except Exception:
        try:
            return pwd_context.verify(plain_password[:72], hashed_password)
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
