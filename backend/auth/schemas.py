"""Pydantic schemas for Authentication, Subscriptions, Payments, and Usage."""

from __future__ import annotations

from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field

try:
    from pydantic import EmailStr
except Exception:
    EmailStr = str  # Fallback to standard string if email-validator package is absent


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    token: str  # Google OAuth ID token or credential


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    is_active: bool
    is_admin: bool
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SubscriptionResponse(BaseModel):
    tier: str
    status: str
    daily_char_limit: int
    allowed_models: List[str]
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UsageResponse(BaseModel):
    usage_date: date
    chars_used_today: int
    daily_limit: int
    chars_remaining: int  # -1 if unlimited
    percentage_used: float

    class Config:
        from_attributes = True


class PlanInfo(BaseModel):
    tier: str
    name: str
    price_inr: int
    daily_char_limit: int
    allowed_models: List[str]
    features: List[str]


class PaymentSubmitRequest(BaseModel):
    plan_tier: str
    amount_inr: int
    utr_number: str


class PaymentResponse(BaseModel):
    id: int
    user_id: int
    user_email: Optional[str] = None
    plan_tier: str
    amount_inr: int
    utr_number: str
    status: str
    created_at: datetime
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentApprovalRequest(BaseModel):
    payment_id: int
    action: str  # "approve" or "reject"
    admin_notes: Optional[str] = None
