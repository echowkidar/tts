"""Business logic for User auth, usage logs, subscription tiers, and payment processing."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from .models import User, Subscription, PaymentRequest, UsageLog, PlanTier, PLAN_CONFIGS
from .schemas import UserRegister, PaymentSubmitRequest
from .jwt_utils import hash_password, verify_password, create_access_token


async def register_user(db: AsyncSession, data: UserRegister) -> Tuple[User, Subscription]:
    """Register new email user and assign Free Subscription tier."""
    # Check if email exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise ValueError("User with this email already exists")

    new_user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name or data.email.split("@")[0],
        is_active=True,
        is_admin=False,
        role="user",
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Assign default Free plan
    free_config = PLAN_CONFIGS[PlanTier.FREE]
    new_sub = Subscription(
        user_id=new_user.id,
        tier=PlanTier.FREE.value,
        status="active",
        daily_char_limit=free_config["daily_char_limit"],
        allowed_models=",".join(free_config["allowed_models"]),
    )
    db.add(new_sub)
    await db.commit()
    await db.refresh(new_sub)

    return new_user, new_sub


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    """Authenticate email & password."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def google_auth(db: AsyncSession, google_id_token: str) -> User:
    """Verify Google token with Google API and get or create user."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={google_id_token}")
        if resp.status_code != 200:
            raise ValueError("Invalid Google token")
        payload = resp.json()

    email = payload.get("email")
    google_id = payload.get("sub")
    full_name = payload.get("name")

    if not email:
        raise ValueError("Google token did not contain email")

    # Check if user exists by google_id or email
    result = await db.execute(select(User).where((User.google_id == google_id) | (User.email == email)))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            google_id=google_id,
            full_name=full_name,
            is_active=True,
            is_admin=False,
            role="user",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Free subscription
        free_config = PLAN_CONFIGS[PlanTier.FREE]
        sub = Subscription(
            user_id=user.id,
            tier=PlanTier.FREE.value,
            status="active",
            daily_char_limit=free_config["daily_char_limit"],
            allowed_models=",".join(free_config["allowed_models"]),
        )
        db.add(sub)
        await db.commit()
    else:
        if not user.google_id:
            user.google_id = google_id
            await db.commit()

    return user


async def get_user_subscription(db: AsyncSession, user_id: int) -> Subscription:
    """Get active user subscription or create default Free tier."""
    result = await db.execute(select(Subscription).where(Subscription.user_id == user_id))
    sub = result.scalar_one_or_none()
    if not sub:
        free_config = PLAN_CONFIGS[PlanTier.FREE]
        sub = Subscription(
            user_id=user_id,
            tier=PlanTier.FREE.value,
            status="active",
            daily_char_limit=free_config["daily_char_limit"],
            allowed_models=",".join(free_config["allowed_models"]),
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return sub


async def get_today_usage(db: AsyncSession, user_id: int) -> int:
    """Get total character count used by user today."""
    today = date.today()
    result = await db.execute(
        select(func.sum(UsageLog.char_count)).where(
            and_(UsageLog.user_id == user_id, UsageLog.usage_date == today)
        )
    )
    total = result.scalar()
    return total or 0


async def check_usage_and_limit(
    db: AsyncSession, user_id: int, char_count: int, engine_key: str
) -> Tuple[bool, str]:
    """Check if user can synthesize char_count text with engine_key under their tier."""
    sub = await get_user_subscription(db, user_id)

    # Check allowed engine
    allowed_list = sub.allowed_models.split(",") if sub.allowed_models != "all" else ["all"]
    if "all" not in allowed_list and engine_key.lower() not in allowed_list:
        return False, f"The '{engine_key}' engine is not included in your {sub.tier.capitalize()} plan. Please upgrade your plan."

    # Unlimited tier
    if sub.daily_char_limit == -1:
        return True, "OK"

    # Check daily limit
    chars_used_today = await get_today_usage(db, user_id)
    if chars_used_today + char_count > sub.daily_char_limit:
        remaining = max(0, sub.daily_char_limit - chars_used_today)
        return (
            False,
            f"Daily character limit reached ({chars_used_today}/{sub.daily_char_limit} chars used today). You need {char_count} chars but only {remaining} remaining. Upgrade plan for higher limits.",
        )

    return True, "OK"


async def record_usage(db: AsyncSession, user_id: int, char_count: int, engine_key: str) -> None:
    """Record usage log after synthesis."""
    log_entry = UsageLog(
        user_id=user_id,
        usage_date=date.today(),
        char_count=char_count,
        engine_used=engine_key,
    )
    db.add(log_entry)
    await db.commit()


async def submit_payment_utr(db: AsyncSession, user_id: int, req: PaymentSubmitRequest) -> PaymentRequest:
    """Submit UPI payment UTR for subscription upgrade."""
    # Check duplicate UTR
    dup = await db.execute(select(PaymentRequest).where(PaymentRequest.utr_number == req.utr_number))
    if dup.scalar_one_or_none():
        raise ValueError("This UTR / Transaction Reference ID has already been submitted.")

    p_req = PaymentRequest(
        user_id=user_id,
        plan_tier=req.plan_tier,
        amount_inr=req.amount_inr,
        utr_number=req.utr_number,
        status="pending",
    )
    db.add(p_req)
    await db.commit()
    await db.refresh(p_req)
    return p_req


async def approve_payment(
    db: AsyncSession, payment_id: int, action: str, admin_notes: Optional[str] = None
) -> PaymentRequest:
    """Approve or reject pending payment request and update user's subscription."""
    result = await db.execute(select(PaymentRequest).where(PaymentRequest.id == payment_id))
    p_req = result.scalar_one_or_none()
    if not p_req:
        raise ValueError("Payment request not found")

    if action == "approve":
        p_req.status = "approved"
        p_req.approved_at = datetime.utcnow()
        p_req.admin_notes = admin_notes

        # Upgrade User's Subscription
        tier_enum = PlanTier(p_req.plan_tier)
        plan_cfg = PLAN_CONFIGS[tier_enum]

        sub = await get_user_subscription(db, p_req.user_id)
        sub.tier = p_req.plan_tier
        sub.status = "active"
        sub.daily_char_limit = plan_cfg["daily_char_limit"]
        sub.allowed_models = ",".join(plan_cfg["allowed_models"])
        sub.expires_at = datetime.utcnow() + timedelta(days=30)
        await db.commit()
    elif action == "reject":
        p_req.status = "rejected"
        p_req.admin_notes = admin_notes
        await db.commit()

    return p_req
