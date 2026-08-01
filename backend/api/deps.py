"""FastAPI dependency providers for app.state singletons."""

from __future__ import annotations

from fastapi import Request

from ..core.engine_manager import EngineManager
from ..core.model import ModelManager
from ..services.join_cache import JoinCache
from ..services.synth_cache import SynthCache
from ..services.synthesize import SynthService
from ..services.voices import VoiceRegistry


def get_model_manager(request: Request) -> ModelManager:
    return request.app.state.model_manager  # type: ignore[no-any-return]


def get_engine_manager(request: Request) -> EngineManager:
    return request.app.state.engine_manager  # type: ignore[no-any-return]


def get_engine_installers(request: Request) -> dict:
    return request.app.state.engine_installers  # type: ignore[no-any-return]


def get_model_downloader(request: Request):
    return request.app.state.model_downloader  # type: ignore[no-any-return]


def get_model_deleter(request: Request):
    return request.app.state.model_deleter  # type: ignore[no-any-return]


def get_engine_uninstallers(request: Request) -> dict:
    return request.app.state.engine_uninstallers  # type: ignore[no-any-return]


def get_voice_registry(request: Request) -> VoiceRegistry:
    return request.app.state.voice_registry  # type: ignore[no-any-return]


def get_synth_service(request: Request) -> SynthService:
    return request.app.state.synth_service  # type: ignore[no-any-return]


def get_synth_cache(request: Request) -> SynthCache:
    return request.app.state.synth_cache  # type: ignore[no-any-return]


def get_asr_service(request: Request):
    return request.app.state.asr_service


def get_dub_service(request: Request):
    return request.app.state.dub_service


def get_translate_service(request: Request):
    return request.app.state.translate_service


def get_join_cache(request: Request) -> JoinCache:
    return request.app.state.join_cache  # type: ignore[no-any-return]


def get_update_checker(request: Request):
    return request.app.state.update_checker  # type: ignore[no-any-return]


def get_update_runner(request: Request):
    return request.app.state.update_runner  # type: ignore[no-any-return]


# ----------------------------------------------------------- Auth Dependencies --
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..auth.database import get_db
from ..auth.models import User
from ..auth.jwt_utils import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Extract user from Bearer JWT token if present, else return None."""
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == int(user_id)))
    return result.scalar_one_or_none()


async def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    """Extract user from Bearer JWT token. Raise 401 if missing or invalid."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account")
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require admin permissions."""
    if not current_user.is_admin and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user

