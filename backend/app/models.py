"""
app/models.py
Pydantic request/response models for all routers.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    confirm_password: str
    role: str = Field(..., pattern="^(instructor|trainee)$")
    institute_code: Optional[str] = None  # required for instructor registration


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class UserPublic(BaseModel):
    user_id: str
    role: str
    name: str
    email: str
    instructor_id: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ── Availability ──────────────────────────────────────────────────────────────

class AddSlotsRequest(BaseModel):
    """Instructor publishes available time slots."""
    slots: list  # list of {"date": "2026-03-05", "start_hour": 10, "duration_min": 60}


# ── Bookings ──────────────────────────────────────────────────────────────────

class BookSlotRequest(BaseModel):
    slot_id: str


# ── Reviews ───────────────────────────────────────────────────────────────────

class ReviewCreateRequest(BaseModel):
    session_id: str
    rating: int = Field(..., ge=1, le=5)
    text: str = ""


# ── Sessions ──────────────────────────────────────────────────────────────────

class SessionNoteUpdate(BaseModel):
    instructor_notes: str


class SessionStartRequest(BaseModel):
    road_type: str = "Secondary"  # "Motorway" or "Secondary"


class SessionEndRequest(BaseModel):
    pass


class GenerateFeedbackRequest(BaseModel):
    instructor_notes: str = ""


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    profile: Optional[dict] = None
    notifications: Optional[dict] = None
    preferences: Optional[dict] = None
