"""Subscription plans, usage tracking, and UPI QR Code payment routes."""

from __future__ import annotations

import io
import urllib.parse
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import qrcode

from ..auth.database import get_db
from ..auth.models import User, PlanTier, PLAN_CONFIGS
from ..auth.schemas import (
    PlanInfo,
    SubscriptionResponse,
    UsageResponse,
    PaymentSubmitRequest,
    PaymentResponse,
)
from ..auth.service import (
    get_user_subscription,
    get_today_usage,
    submit_payment_utr,
)
from .deps import get_current_user

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

import os

# Configure default UPI details for QR Code generation (Can be overridden via env vars)
UPI_ID = os.environ.get("UPI_ID", "8430478128@axl")
UPI_NAME = os.environ.get("UPI_NAME", "Voice Studio by echowkidar.com")


@router.get("/plans", response_model=List[PlanInfo])
async def list_plans():
    """List all available subscription plans with INR prices and limits."""
    plans = []
    for tier, cfg in PLAN_CONFIGS.items():
        plans.append(
            PlanInfo(
                tier=tier.value,
                name=cfg["name"],
                price_inr=cfg["price_inr"],
                daily_char_limit=cfg["daily_char_limit"],
                allowed_models=cfg["allowed_models"],
                features=cfg["features"],
            )
        )
    return plans


@router.get("/my", response_model=SubscriptionResponse)
async def my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get active user subscription status."""
    sub = await get_user_subscription(db, current_user.id)
    allowed = sub.allowed_models.split(",") if sub.allowed_models != "all" else ["all"]
    return SubscriptionResponse(
        tier=sub.tier,
        status=sub.status,
        daily_char_limit=sub.daily_char_limit,
        allowed_models=allowed,
        expires_at=sub.expires_at,
    )


@router.get("/usage", response_model=UsageResponse)
async def my_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get character usage stats for today."""
    sub = await get_user_subscription(db, current_user.id)
    used_today = await get_today_usage(db, current_user.id)

    limit = sub.daily_char_limit
    if limit == -1:  # Unlimited
        remaining = -1
        percentage = 0.0
    else:
        remaining = max(0, limit - used_today)
        percentage = min(100.0, round((used_today / limit) * 100, 1)) if limit > 0 else 100.0

    return UsageResponse(
        usage_date=date.today(),
        chars_used_today=used_today,
        daily_limit=limit,
        chars_remaining=remaining,
        percentage_used=percentage,
    )


@router.get("/qr")
async def generate_upi_qr(
    plan_tier: str = "starter",
    amount_inr: int = 299,
):
    """Generate dynamic UPI QR Code image for GPay, PhonePe, Paytm, BHIM UPI."""
    try:
        tier_enum = PlanTier(plan_tier)
        cfg = PLAN_CONFIGS[tier_enum]
        actual_amount = cfg["price_inr"]
    except Exception:
        actual_amount = amount_inr

    # Standard UPI Deep Link URI
    # upi://pay?pa=ADDRESS&pn=NAME&am=AMOUNT&cu=INR&tn=NOTE
    upi_note = f"VoiceStudio {plan_tier.capitalize()} Plan"
    upi_url = f"upi://pay?pa={UPI_ID}&pn={urllib.parse.quote(UPI_NAME)}&am={actual_amount}&cu=INR&tn={urllib.parse.quote(upi_note)}"

    img = qrcode.make(upi_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png")


@router.post("/payment/utr", response_model=PaymentResponse)
async def submit_payment(
    req: PaymentSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit UTR / Transaction Reference ID after QR code payment."""
    if not req.utr_number or len(req.utr_number.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid UTR or Transaction Reference ID (12 digits for UPI)",
        )

    try:
        p_req = await submit_payment_utr(db, current_user.id, req)
        return PaymentResponse.model_validate(p_req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
