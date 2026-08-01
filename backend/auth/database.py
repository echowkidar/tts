"""SQLite database configuration and session management using SQLAlchemy async."""

from __future__ import annotations

import os
from pathlib import Path
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Database path in backend directory
_BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = os.environ.get("DATABASE_URL", f"sqlite+aiosqlite:///{_BACKEND_DIR / 'database.db'}")

engine = create_async_engine(
    DB_PATH,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in DB_PATH else {},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables and create default admin user if missing."""
    from .models import User, Subscription, PlanTier
    from .jwt_utils import hash_password

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create default admin if no users exist
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).limit(1))
        if not result.scalar_one_or_none():
            admin_user = User(
                email="admin@echowkidar.com",
                hashed_password=hash_password("admin123"),
                full_name="System Admin",
                is_active=True,
                is_admin=True,
                role="admin",
            )
            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)

            # Assign Ultra plan to admin
            admin_sub = Subscription(
                user_id=admin_user.id,
                tier=PlanTier.ULTRA.value,
                status="active",
                daily_char_limit=-1,  # Unlimited
                allowed_models="all",
            )
            session.add(admin_sub)
            await session.commit()
