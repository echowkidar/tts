"""SQLAlchemy ORM models for User, Subscription, PaymentRequest, and UsageLog."""

from __future__ import annotations

from datetime import datetime, date
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class PlanTier(str, Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ULTRA = "ultra"


# Plan configuration details (INR pricing & character limits)
PLAN_CONFIGS = {
    PlanTier.FREE: {
        "name": "Free Plan",
        "price_inr": 0,
        "daily_char_limit": 5000,
        "allowed_models": ["kokoro", "kittentts"],
        "features": ["5,000 Chars / Day", "Kokoro & Kitten TTS", "Standard Speed"],
    },
    PlanTier.STARTER: {
        "name": "Starter Plan",
        "price_inr": 299,
        "daily_char_limit": 50000,
        "allowed_models": ["kokoro", "kittentts", "vibevoice", "chatterbox"],
        "features": ["50,000 Chars / Day", "+ VibeVoice & Chatterbox", "Faster Processing"],
    },
    PlanTier.PRO: {
        "name": "Pro Plan",
        "price_inr": 799,
        "daily_char_limit": 200000,
        "allowed_models": ["all"],
        "features": ["200,000 Chars / Day", "All TTS Engines", "Voice Cloning"],
    },
    PlanTier.ULTRA: {
        "name": "Ultra Plan",
        "price_inr": 1499,
        "daily_char_limit": -1,  # Unlimited
        "allowed_models": ["all"],
        "features": ["Unlimited Chars", "All TTS Engines", "Priority Processing"],
    },
}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Null if Google OAuth
    full_name = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    role = Column(String, default="user")  # "user" or "admin"
    created_at = Column(DateTime, default=datetime.utcnow)

    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    payment_requests = relationship("PaymentRequest", back_populates="user", cascade="all, delete-orphan")
    usage_logs = relationship("UsageLog", back_populates="user", cascade="all, delete-orphan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    tier = Column(String, default=PlanTier.FREE.value, nullable=False)
    status = Column(String, default="active", nullable=False)  # "active", "expired", "pending"
    daily_char_limit = Column(Integer, default=5000, nullable=False)
    allowed_models = Column(String, default="kokoro,kittentts", nullable=False)  # CSV or "all"
    expires_at = Column(DateTime, nullable=True)  # Null = permanent free or active till renewed
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="subscription")


class PaymentRequest(Base):
    __tablename__ = "payment_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_tier = Column(String, nullable=False)
    amount_inr = Column(Integer, nullable=False)
    utr_number = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="pending", nullable=False)  # "pending", "approved", "rejected"
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="payment_requests")


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    usage_date = Column(Date, default=date.today, index=True, nullable=False)
    char_count = Column(Integer, default=0, nullable=False)
    engine_used = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="usage_logs")
