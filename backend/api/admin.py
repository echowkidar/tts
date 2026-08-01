"""Admin Panel endpoints for managing Users and approving pending Subscription Payments."""

from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..auth.database import get_db
from ..auth.models import User, PaymentRequest, Subscription
from ..auth.schemas import PaymentResponse, PaymentApprovalRequest, UserResponse
from ..auth.service import approve_payment
from .deps import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/payments", response_model=List[PaymentResponse])
async def list_payment_requests(
    status_filter: str = "pending",
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List payment requests submitted by users for approval."""
    stmt = select(PaymentRequest).order_by(PaymentRequest.created_at.desc())
    if status_filter != "all":
        stmt = stmt.where(PaymentRequest.status == status_filter)

    result = await db.execute(stmt)
    payments = result.scalars().all()

    # Populate user email
    res = []
    for p in payments:
        u_res = await db.execute(select(User.email).where(User.id == p.user_id))
        email = u_res.scalar_one_or_none()
        p_dict = PaymentResponse.model_validate(p)
        p_dict.user_email = email
        res.append(p_dict)

    return res


@router.post("/payments/approve", response_model=PaymentResponse)
async def approve_user_payment(
    req: PaymentApprovalRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a user's UPI payment request (Upgrades subscription on approve)."""
    try:
        p_req = await approve_payment(db, req.payment_id, req.action, req.admin_notes)
        u_res = await db.execute(select(User.email).where(User.id == p_req.user_id))
        email = u_res.scalar_one_or_none()
        p_dict = PaymentResponse.model_validate(p_req)
        p_dict.user_email = email
        return p_dict
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/users")
async def list_all_users(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users and their current subscription tiers, auto-cleaning old admin flags for normal users."""
    stmt = select(User).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()

    user_list = []
    for u in users:
        # Auto-clean if non-admin email was stored as admin
        if u.email != "admin@echowkidar.com" and not u.email.startswith("admin@") and u.is_admin:
            u.is_admin = False
            u.role = "user"
            await db.commit()

        sub_res = await db.execute(select(Subscription).where(Subscription.user_id == u.id))
        sub = sub_res.scalar_one_or_none()
        user_list.append(
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_admin": u.is_admin,
                "created_at": u.created_at,
                "subscription_tier": sub.tier if sub else "free",
                "daily_char_limit": sub.daily_char_limit if sub else 5000,
            }
        )
    return user_list


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user account and their subscription data."""
    try:
        from ..auth.service import delete_user_account
        await delete_user_account(db, user_id)
        return {"status": "ok", "message": f"User #{user_id} deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/users/{user_id}/role")
async def change_user_role(
    user_id: int,
    role: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Change user role (user vs admin)."""
    try:
        from ..auth.service import update_user_role
        u = await update_user_role(db, user_id, role)
        return {"status": "ok", "user_id": u.id, "role": u.role, "is_admin": u.is_admin}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/users/{user_id}/tier")
async def change_user_tier(
    user_id: int,
    tier: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually update user's subscription tier (free, starter, pro, ultra)."""
    try:
        from ..auth.service import update_user_tier
        sub = await update_user_tier(db, user_id, tier)
        return {"status": "ok", "user_id": user_id, "tier": sub.tier, "daily_char_limit": sub.daily_char_limit}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
