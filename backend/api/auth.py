"""Authentication API endpoints for Register, Login, Google OAuth, and Me."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.database import get_db
from ..auth.models import User
from ..auth.schemas import UserRegister, UserLogin, GoogleAuthRequest, UserResponse, TokenResponse
from ..auth.service import register_user, authenticate_user, google_auth
from ..auth.jwt_utils import create_access_token
from .deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register user with email & password."""
    try:
        user, _ = await register_user(db, data)
        token = create_access_token({"sub": str(user.id), "email": user.email})
        return TokenResponse(access_token=token, user=UserResponse.model_validate(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate email & password and return JWT."""
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/google", response_model=TokenResponse)
async def google_login(data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate or register user via Google ID Token."""
    try:
        user = await google_auth(db, data.token)
        token = create_access_token({"sub": str(user.id), "email": user.email})
        return TokenResponse(access_token=token, user=UserResponse.model_validate(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get profile of current logged-in user."""
    return UserResponse.model_validate(current_user)
