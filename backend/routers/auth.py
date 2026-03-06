"""
routers/auth.py
Authentication endpoints: register, login, me.
Also owns the root / and /health probes.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.auth import create_access_token, hash_password, verify_password
from app.database import institute_codes_col, instructor_profiles_col, users_col
from app.models import ChangePasswordRequest, LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.permissions import get_current_user
from app.utils import now_utc, to_jsonable

router = APIRouter(tags=["Auth"])


@router.get("/")
def root():
    return {"message": "DriveIQ backend running. Go to /docs"}


@router.get("/health")
def health():
    try:
        users_col.estimated_document_count()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MongoDB error: {e}")


@router.post("/auth/register", response_model=TokenResponse)
def register(body: RegisterRequest):
    email = body.email.strip().lower()

    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if users_col.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    role = body.role.strip().lower()
    user_id = uuid.uuid4().hex
    instructor_id = None

    if role == "instructor":
        if not body.institute_code:
            raise HTTPException(status_code=400, detail="Institute code is required for instructor registration")

        code_doc = institute_codes_col.find_one({"code": body.institute_code.strip()})
        if not code_doc:
            raise HTTPException(status_code=400, detail="Invalid institute code")
        if code_doc.get("used") is True:
            raise HTTPException(status_code=400, detail="Institute code already used")

        instructor_id = uuid.uuid4().hex
        doc = {
            "user_id": user_id,
            "role": "instructor",
            "name": body.name.strip(),
            "email": email,
            "password_hash": hash_password(body.password),
            "instructor_id": instructor_id,
            "created_at": now_utc(),
        }
        users_col.insert_one(doc)

        institute_codes_col.update_one(
            {"_id": code_doc["_id"], "used": {"$ne": True}},
            {"$set": {"used": True, "used_by": user_id, "used_at": now_utc()}},
        )

        instructor_profiles_col.insert_one({
            "instructor_id": instructor_id,
            "user_id": user_id,
            "name": body.name.strip(),
            "bio": "",
            "specialties": [],
            "experience_years": 0,
            "price_per_session": 0,
            "currency": "AED",
            "vehicle": "",
            "languages": [],
            "location_area": "",
            "rating": 0.0,
            "total_reviews": 0,
            "total_sessions": 0,
            "verified": False,
            "active": True,
            "created_at": now_utc(),
        })
    else:
        doc = {
            "user_id": user_id,
            "role": "trainee",
            "name": body.name.strip(),
            "email": email,
            "password_hash": hash_password(body.password),
            "created_at": now_utc(),
        }
        users_col.insert_one(doc)

    token = create_access_token(subject=user_id, extra={"role": role, "email": email})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic(
            user_id=user_id, role=role, name=body.name.strip(),
            email=email, instructor_id=instructor_id,
        ),
    )


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest):
    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="Missing email")

    user = users_col.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Wrong email or password")

    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Wrong email or password")

    token = create_access_token(
        subject=user["user_id"],
        extra={"role": user.get("role"), "email": user.get("email")},
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic(
            user_id=user["user_id"], role=user["role"],
            name=user.get("name", ""), email=user.get("email", ""),
            instructor_id=user.get("instructor_id"),
        ),
    )


@router.post("/auth/change-password")
def change_password(body: ChangePasswordRequest, current_user=Depends(get_current_user)):
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")

    # Re-fetch user WITH password_hash (get_current_user strips it)
    user = users_col.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    users_col.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    return {"status": "ok", "message": "Password changed successfully"}


@router.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return to_jsonable(current_user)
