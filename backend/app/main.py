# app/main.py
# DriveIQ Backend — v2 Per-Session Booking Model
# ================================================
# - No join codes, no permanent trainee-instructor links
# - Students browse instructors, pick time slots, book instantly
# - Instructor-student link exists only per session/booking
# - Reviews drive instructor ratings

from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

import pandas as pd
from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from pydantic import BaseModel, Field

from app.auth import hash_password, verify_password
from app.config import DATASETS_ROOT, JWT_ALG, JWT_EXPIRE_MIN, JWT_SECRET
from app.database import (
    availability_col,
    bookings_col,
    ensure_indexes,
    institute_codes_col,
    instructor_profiles_col,
    results_col,
    reviews_col,
    sessions_col,
    settings_col,
    users_col,
)
from app.ml.predictor import predict_from_dataframe
from app.permissions import get_current_user, require_role
from app.utils import to_jsonable


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def oid(x: str) -> ObjectId:
    try:
        return ObjectId(x)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def now_utc() -> datetime:
    return datetime.utcnow()


def create_access_token(subject: str, extra: Optional[dict] = None) -> str:
    payload = {
        "sub": subject,
        "exp": now_utc() + timedelta(minutes=JWT_EXPIRE_MIN),
        "iat": int(now_utc().timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


# ═══════════════════════════════════════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════════

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


class BookSlotRequest(BaseModel):
    slot_id: str


class AddSlotsRequest(BaseModel):
    """Instructor publishes available time slots."""
    slots: list  # list of {"date": "2026-03-05", "start_hour": 10, "duration_min": 60}


class ReviewCreateRequest(BaseModel):
    session_id: str
    rating: int = Field(..., ge=1, le=5)
    text: str = ""


class SessionNoteUpdate(BaseModel):
    instructor_notes: str


class SettingsUpdate(BaseModel):
    profile: Optional[dict] = None
    notifications: Optional[dict] = None
    preferences: Optional[dict] = None


class SessionStartRequest(BaseModel):
    pass


class SessionEndRequest(BaseModel):
    pass


# ═══════════════════════════════════════════════════════════════════════════
# APP
# ═══════════════════════════════════════════════════════════════════════════

app = FastAPI(title="DriveIQ Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    ensure_indexes()


@app.get("/")
def root():
    return {"message": "DriveIQ backend running. Go to /docs"}


@app.get("/health")
def health():
    try:
        users_col.estimated_document_count()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MongoDB error: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# AUTH — No join codes, no institute codes
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/auth/register", response_model=TokenResponse)
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
        # Require institute code for instructor registration
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

        # Mark code as used
        institute_codes_col.update_one(
            {"_id": code_doc["_id"], "used": {"$ne": True}},
            {"$set": {"used": True, "used_by": user_id, "used_at": now_utc()}},
        )

        # Create empty instructor profile (they fill it in later)
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


@app.post("/auth/login", response_model=TokenResponse)
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


@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return to_jsonable(current_user)


# ═══════════════════════════════════════════════════════════════════════════
# INSTRUCTOR BROWSING (public for trainees)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/instructors")
def list_instructors(
    specialty: Optional[str] = None,
    location: Optional[str] = None,
    min_rating: Optional[float] = None,
    sort_by: str = "rating",
    current_user=Depends(get_current_user),
):
    """Browse all active instructors with optional filters."""
    query: dict = {"active": True}

    if specialty:
        query["specialties"] = {"$regex": specialty, "$options": "i"}
    if location:
        query["location_area"] = {"$regex": location, "$options": "i"}
    if min_rating:
        query["rating"] = {"$gte": min_rating}

    sort_field = "rating" if sort_by == "rating" else "price_per_session"
    sort_dir = -1 if sort_by == "rating" else 1

    profiles = list(
        instructor_profiles_col.find(query, {"_id": 0})
        .sort(sort_field, sort_dir)
        .limit(50)
    )

    return to_jsonable(profiles)


@app.get("/instructors/{instructor_id}")
def get_instructor_profile(instructor_id: str, current_user=Depends(get_current_user)):
    """Get full instructor profile with recent reviews."""
    profile = instructor_profiles_col.find_one(
        {"instructor_id": instructor_id}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Instructor not found")

    recent_reviews = list(
        reviews_col.find({"instructor_id": instructor_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(10)
    )

    return {
        "profile": to_jsonable(profile),
        "reviews": to_jsonable(recent_reviews),
    }


# ═══════════════════════════════════════════════════════════════════════════
# AVAILABILITY (instructor time slots)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/instructors/{instructor_id}/availability")
def get_instructor_availability(
    instructor_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """Get open time slots for an instructor."""
    query: dict = {"instructor_id": instructor_id, "status": "open"}

    if date_from:
        query["date"] = query.get("date", {})
        query["date"]["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to

    # Default: next 14 days if no filter
    if not date_from and not date_to:
        today = now_utc().strftime("%Y-%m-%d")
        future = (now_utc() + timedelta(days=14)).strftime("%Y-%m-%d")
        query["date"] = {"$gte": today, "$lte": future}

    slots = list(
        availability_col.find(query, {"_id": 0})
        .sort([("date", 1), ("start_time", 1)])
    )

    return to_jsonable(slots)


@app.post("/availability")
def add_availability_slots(body: AddSlotsRequest, current_user=Depends(require_role("instructor"))):
    """Instructor publishes time slots."""
    instructor_id = current_user["instructor_id"]
    created = []

    for slot in body.slots:
        date_str = slot.get("date")
        start_hour = slot.get("start_hour", 10)
        duration = slot.get("duration_min", 60)

        if not date_str:
            continue

        try:
            dt = datetime.fromisoformat(f"{date_str}T{start_hour:02d}:00:00")
        except (ValueError, TypeError):
            continue

        slot_id = uuid.uuid4().hex
        doc = {
            "slot_id": slot_id,
            "instructor_id": instructor_id,
            "date": date_str,
            "start_time": dt.isoformat(),
            "end_time": (dt + timedelta(minutes=duration)).isoformat(),
            "duration_min": duration,
            "status": "open",
            "booked_by": None,
            "created_at": now_utc(),
        }
        availability_col.insert_one(doc)
        created.append(slot_id)

    return {"status": "ok", "slots_created": len(created), "slot_ids": created}


@app.get("/availability/me")
def my_availability(current_user=Depends(require_role("instructor"))):
    """Instructor views their own slots."""
    instructor_id = current_user["instructor_id"]
    today = now_utc().strftime("%Y-%m-%d")

    slots = list(
        availability_col.find(
            {"instructor_id": instructor_id, "date": {"$gte": today}},
            {"_id": 0},
        ).sort([("date", 1), ("start_time", 1)])
    )

    return to_jsonable(slots)


@app.delete("/availability/{slot_id}")
def delete_availability_slot(slot_id: str, current_user=Depends(require_role("instructor"))):
    """Instructor removes an open slot."""
    slot = availability_col.find_one({"slot_id": slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if slot.get("status") != "open":
        raise HTTPException(status_code=400, detail="Cannot delete a booked slot")

    availability_col.delete_one({"slot_id": slot_id})
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════
# BOOKINGS (trainee books an instructor's slot)
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/bookings")
def book_slot(body: BookSlotRequest, current_user=Depends(require_role("trainee"))):
    """Trainee picks an open slot → instant booking."""
    slot = availability_col.find_one({"slot_id": body.slot_id})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.get("status") != "open":
        raise HTTPException(status_code=400, detail="Slot is no longer available")

    trainee_id = current_user["user_id"]
    instructor_id = slot["instructor_id"]
    booking_id = uuid.uuid4().hex

    # Get instructor name
    instructor = users_col.find_one({"instructor_id": instructor_id}, {"name": 1})
    instructor_name = instructor.get("name", "Unknown") if instructor else "Unknown"

    # Mark slot as booked
    availability_col.update_one(
        {"slot_id": body.slot_id, "status": "open"},
        {"$set": {"status": "booked", "booked_by": trainee_id}},
    )

    # Create booking
    bookings_col.insert_one({
        "booking_id": booking_id,
        "trainee_id": trainee_id,
        "instructor_id": instructor_id,
        "slot_id": body.slot_id,
        "slot_date": slot.get("date"),
        "start_time": slot.get("start_time"),
        "end_time": slot.get("end_time"),
        "status": "confirmed",
        "session_id": None,
        "created_at": now_utc(),
    })

    return {
        "status": "ok",
        "booking_id": booking_id,
        "instructor_name": instructor_name,
        "date": slot.get("date"),
        "start_time": slot.get("start_time"),
    }


@app.get("/bookings/me")
def my_bookings(current_user=Depends(get_current_user)):
    """Get user's bookings (works for both roles)."""
    if current_user["role"] == "instructor":
        query = {"instructor_id": current_user["instructor_id"]}
    else:
        query = {"trainee_id": current_user["user_id"]}

    bookings = list(
        bookings_col.find(query, {"_id": 0}).sort("created_at", -1).limit(50)
    )

    # Enrich with names
    for b in bookings:
        if current_user["role"] == "trainee":
            inst = users_col.find_one({"instructor_id": b.get("instructor_id")}, {"name": 1})
            b["instructor_name"] = inst.get("name", "Unknown") if inst else "Unknown"
        else:
            trainee = users_col.find_one({"user_id": b.get("trainee_id")}, {"name": 1})
            b["trainee_name"] = trainee.get("name", "Unknown") if trainee else "Unknown"

    return to_jsonable(bookings)


@app.delete("/bookings/{booking_id}")
def cancel_booking(booking_id: str, current_user=Depends(get_current_user)):
    """Cancel a confirmed booking (frees the slot)."""
    booking = bookings_col.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check ownership
    if current_user["role"] == "trainee" and booking.get("trainee_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user["role"] == "instructor" and booking.get("instructor_id") != current_user.get("instructor_id"):
        raise HTTPException(status_code=403, detail="Forbidden")

    if booking.get("status") not in ("confirmed",):
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")

    # Free the slot
    if booking.get("slot_id"):
        availability_col.update_one(
            {"slot_id": booking["slot_id"]},
            {"$set": {"status": "open", "booked_by": None}},
        )

    bookings_col.update_one(
        {"booking_id": booking_id},
        {"$set": {"status": "cancelled"}},
    )

    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════
# REVIEWS
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/reviews")
def create_review(body: ReviewCreateRequest, current_user=Depends(require_role("trainee"))):
    """Trainee leaves a review after a completed session."""
    session = sessions_col.find_one({"session_id": body.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("trainee_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Session not completed yet")

    # Check for duplicate review
    existing = reviews_col.find_one({
        "session_id": body.session_id, "trainee_id": current_user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed this session")

    instructor_id = session["instructor_id"]
    review_id = uuid.uuid4().hex

    reviews_col.insert_one({
        "review_id": review_id,
        "instructor_id": instructor_id,
        "session_id": body.session_id,
        "trainee_id": current_user["user_id"],
        "reviewer_name": current_user.get("name", "Anonymous"),
        "rating": body.rating,
        "text": body.text,
        "created_at": now_utc(),
    })

    # Recompute instructor rating
    all_reviews = list(reviews_col.find({"instructor_id": instructor_id}))
    avg_rating = round(sum(r["rating"] for r in all_reviews) / len(all_reviews), 1)
    instructor_profiles_col.update_one(
        {"instructor_id": instructor_id},
        {"$set": {"rating": avg_rating, "total_reviews": len(all_reviews)}},
    )

    return {"status": "ok", "review_id": review_id}


@app.get("/reviews/{instructor_id}")
def get_reviews(instructor_id: str, current_user=Depends(get_current_user)):
    """Get all reviews for an instructor."""
    revs = list(
        reviews_col.find({"instructor_id": instructor_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(50)
    )
    return to_jsonable(revs)


# ═══════════════════════════════════════════════════════════════════════════
# DASHBOARDS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/dashboard/trainee")
def trainee_dashboard(current_user=Depends(require_role("trainee"))):
    trainee_id = current_user["user_id"]

    # ── Sessions ────────────────────────────────────────────────────
    all_sessions = list(
        sessions_col.find({"trainee_id": trainee_id}).sort("created_at", -1)
    )
    completed_sessions = [s for s in all_sessions if s.get("status") == "completed"]

    # ── Upcoming booking ────────────────────────────────────────────
    upcoming_booking = bookings_col.find_one(
        {"trainee_id": trainee_id, "status": "confirmed"},
        sort=[("start_time", 1)],
    )

    upcoming_session = None
    if upcoming_booking:
        inst = users_col.find_one(
            {"instructor_id": upcoming_booking.get("instructor_id")}, {"name": 1}
        )
        inst_name = inst.get("name", "—") if inst else "—"

        sched = upcoming_booking.get("start_time", "")
        try:
            dt = datetime.fromisoformat(str(sched)) if sched else None
        except (ValueError, TypeError):
            dt = None

        upcoming_session = {
            "booking_id":   upcoming_booking.get("booking_id"),
            "date_iso":     dt.strftime("%Y-%m-%d") if dt else "—",
            "dateISO":      dt.strftime("%Y-%m-%d") if dt else "—",
            "date_label":   dt.strftime("%b %d, %Y") if dt else "—",
            "dateLabel":    dt.strftime("%b %d, %Y") if dt else "—",
            "time_label":   dt.strftime("%I:%M %p") if dt else "—",
            "timeLabel":    dt.strftime("%I:%M %p") if dt else "—",
            "instructor":   inst_name,
            "instructor_id": upcoming_booking.get("instructor_id"),
        }

    # ── Results / Reports ───────────────────────────────────────────
    recent_results = list(
        results_col.find({"trainee_id": trainee_id}).sort("created_at", -1).limit(10)
    )

    latest = recent_results[0] if recent_results else None
    latest_analysis = (latest.get("analysis") if latest else None) or {}
    current_score = latest_analysis.get("overall", 0)
    badge = latest_analysis.get("badge", "Improving")

    # Format reports for frontend
    recent_reports = []
    for r in recent_results:
        analysis = r.get("analysis") or {}
        score = analysis.get("overall", 0)
        created = r.get("created_at")
        date_label = created.strftime("%b %d, %Y") if hasattr(created, "strftime") else str(created)[:10] if created else "—"
        inst_name = r.get("instructor_name", "—")

        recent_reports.append({
            "id":              str(r.get("_id", "")),
            "session_id":      r.get("session_id"),
            "date":            date_label,
            "date_label":      date_label,
            "created_at":      str(created) if created else None,
            "instructor":      inst_name,
            "instructor_name": inst_name,
            "score":           {"overall": score},
            "behavior":        analysis.get("behavior", "Unknown"),
            "badge":           analysis.get("badge", "—"),
        })

    # ── AI Feedback ─────────────────────────────────────────────────
    ai_feedback = (latest.get("ai_feedback") if latest else []) or []

    # ── Instructor comments ─────────────────────────────────────────
    instructor_comments = []
    for r in recent_results:
        comment = r.get("instructor_comment")
        if comment and comment.get("text"):
            instructor_comments.append({
                "id":     str(r.get("_id", "")),
                "date":   comment.get("date", ""),
                "text":   comment["text"],
                "rating": comment.get("rating", 0),
            })

    # ── Achievements ────────────────────────────────────────────────
    user_settings = settings_col.find_one({"user_id": trainee_id}) or {}
    achievements = user_settings.get("achievements", [])

    # ── Milestones ──────────────────────────────────────────────────
    completed_count = len(completed_sessions)
    target = 10
    milestones = []
    for threshold, title, desc in [
        (1, "First Drive", "Complete your first session"),
        (3, "Getting Started", "Complete 3 sessions"),
        (5, "Halfway There", "Complete 5 sessions"),
        (10, "Goal Reached", "Complete all 10 sessions"),
    ]:
        milestones.append({
            "id": f"m-{threshold}", "title": title,
            "subtitle": desc, "reached": completed_count >= threshold,
        })

    # ── Goal text ───────────────────────────────────────────────────
    if current_score >= 90:
        goal_text = "Outstanding! Maintain your excellent driving standards."
    elif current_score >= 80:
        goal_text = "Great progress! Push for 90+ to earn Expert Driver badge."
    elif current_score >= 70:
        goal_text = "Good driving! Focus on consistency to reach 80+."
    elif completed_count > 0:
        goal_text = "Keep practicing! Each session helps improve your score."
    else:
        goal_text = "Complete your first session to start tracking progress."

    return {
        "welcome":              {"name": current_user.get("name", ""), "badge": badge},
        "progress":             {"sessions_completed": completed_count, "target_sessions": target, "current_score": current_score, "goal_text": goal_text},
        "upcoming_session":     upcoming_session,
        "recent_reports":       to_jsonable(recent_reports),
        "recent_sessions":      to_jsonable(all_sessions[:5]),
        "ai_feedback":          to_jsonable(ai_feedback),
        "instructor_comments":  to_jsonable(instructor_comments),
        "achievements":         to_jsonable(achievements),
        "milestones":           to_jsonable(milestones),
    }


@app.get("/dashboard/instructor")
def instructor_dashboard(current_user=Depends(require_role("instructor"))):
    instructor_id = current_user["instructor_id"]

    # All sessions for this instructor
    recent_sessions = list(
        sessions_col.find({"instructor_id": instructor_id}).sort("created_at", -1).limit(20)
    )

    # Unique trainees from bookings (per-session links)
    trainee_ids = list(set(
        b["trainee_id"] for b in bookings_col.find(
            {"instructor_id": instructor_id}, {"trainee_id": 1}
        ) if b.get("trainee_id")
    ))

    learners = list(
        users_col.find(
            {"user_id": {"$in": trainee_ids}, "role": "trainee"},
            {"_id": 0, "password_hash": 0},
        )
    )

    # Scores from results
    latest_results = list(
        results_col.find({"instructor_id": instructor_id}).sort("created_at", -1).limit(50)
    )
    scores = [float(r["analysis"]["overall"]) for r in latest_results if r.get("analysis", {}).get("overall")]
    avg_score = int(sum(scores) / len(scores)) if scores else 0

    # Upcoming bookings
    upcoming = list(
        bookings_col.find(
            {"instructor_id": instructor_id, "status": "confirmed"},
            {"_id": 0},
        ).sort("start_time", 1).limit(10)
    )
    for b in upcoming:
        trainee = users_col.find_one({"user_id": b.get("trainee_id")}, {"name": 1})
        b["trainee_name"] = trainee.get("name", "Unknown") if trainee else "Unknown"

    # Profile info
    profile = instructor_profiles_col.find_one({"instructor_id": instructor_id}, {"_id": 0})

    active = sessions_col.find_one(
        {"instructor_id": instructor_id, "status": "active"},
        sort=[("started_at", -1)],
    )

    return {
        "summary": {
            "total_learners": len(learners),
            "avg_score": avg_score,
            "total_sessions": len([s for s in recent_sessions if s.get("status") == "completed"]),
            "rating": profile.get("rating", 0) if profile else 0,
            "total_reviews": profile.get("total_reviews", 0) if profile else 0,
        },
        "learners": to_jsonable(learners),
        "recent_sessions": to_jsonable(recent_sessions),
        "upcoming_bookings": to_jsonable(upcoming),
        "active_session": to_jsonable(active) if active else None,
        "profile": to_jsonable(profile) if profile else None,
    }


# ═══════════════════════════════════════════════════════════════════════════
# INSTRUCTOR — VIEW A STUDENT'S HISTORY
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/instructor/student/{trainee_id}/history")
def student_history_for_instructor(trainee_id: str, current_user=Depends(require_role("instructor"))):
    """Instructor views a student's past sessions (only sessions booked with any instructor)."""
    instructor_id = current_user["instructor_id"]

    # Verify this student has at least one booking with this instructor
    has_booking = bookings_col.find_one({
        "instructor_id": instructor_id, "trainee_id": trainee_id,
    })
    if not has_booking:
        raise HTTPException(status_code=403, detail="No booking relationship with this student")

    # Return ALL the student's past sessions (across all instructors)
    student = users_col.find_one({"user_id": trainee_id}, {"_id": 0, "password_hash": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    sessions = list(
        sessions_col.find({"trainee_id": trainee_id, "status": "completed"})
        .sort("created_at", -1)
        .limit(50)
    )

    results = list(
        results_col.find({"trainee_id": trainee_id})
        .sort("created_at", -1)
        .limit(50)
    )

    return {
        "student": to_jsonable(student),
        "sessions": to_jsonable(sessions),
        "results": to_jsonable(results),
    }


# ═══════════════════════════════════════════════════════════════════════════
# INSTRUCTOR PROFILE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/instructor/profile/me")
def get_my_instructor_profile(current_user=Depends(require_role("instructor"))):
    profile = instructor_profiles_col.find_one(
        {"instructor_id": current_user["instructor_id"]}, {"_id": 0}
    )
    return to_jsonable(profile) if profile else {}


@app.patch("/instructor/profile/me")
def update_my_instructor_profile(body: dict, current_user=Depends(require_role("instructor"))):
    """Update instructor profile fields (bio, specialties, price, etc.)."""
    allowed_fields = {
        "bio", "specialties", "experience_years", "price_per_session",
        "currency", "vehicle", "languages", "location_area",
    }
    update = {k: v for k, v in body.items() if k in allowed_fields}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    instructor_profiles_col.update_one(
        {"instructor_id": current_user["instructor_id"]},
        {"$set": update},
    )
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════
# SETTINGS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/settings/me")
def get_settings(current_user=Depends(get_current_user)):
    s = settings_col.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    return s or {"user_id": current_user["user_id"], "profile": {}, "notifications": {}, "preferences": {}}


@app.patch("/settings/me")
def update_settings(body: SettingsUpdate, current_user=Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    settings_col.update_one({"user_id": current_user["user_id"]}, {"$set": update}, upsert=True)
    return {"status": "ok"}


# ═══════════════════════════════════════════════════════════════════════════
# SESSIONS (ML simulation — instructor starts/ends)
# ═══════════════════════════════════════════════════════════════════════════

def _resolve_datasets_root() -> Path:
    base = Path(DATASETS_ROOT) if DATASETS_ROOT else (Path.cwd() / "datasets")
    return base.resolve()


def _list_all_csvs() -> List[Path]:
    root = _resolve_datasets_root()
    if not root.exists():
        return []
    return [p for p in root.rglob("*.csv") if p.is_file()]


def _pick_csv_for_simulation(road_type: str) -> Path:
    csvs = _list_all_csvs()
    if not csvs:
        raise HTTPException(status_code=500, detail=f"No CSV datasets found under {str(_resolve_datasets_root())}")
    road = (road_type or "").strip().lower()
    wants_motor = road in ["motor", "motorway", "highway"]
    motor_like = [p for p in csvs if "motor" in p.name.lower() or "highway" in p.name.lower()]
    non_motor_like = [p for p in csvs if p not in motor_like]
    pool = motor_like if (wants_motor and motor_like) else (non_motor_like if non_motor_like else csvs)
    return random.choice(pool)


@app.get("/sessions")
def list_sessions(current_user=Depends(get_current_user)):
    if current_user["role"] == "instructor":
        cur = sessions_col.find({"instructor_id": current_user["instructor_id"]}).sort("created_at", -1)
    else:
        cur = sessions_col.find({"trainee_id": current_user["user_id"]}).sort("created_at", -1)
    return to_jsonable(list(cur))


@app.get("/sessions/{session_id}/report")
def session_report(session_id: str, current_user=Depends(get_current_user)):
    session = sessions_col.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user["role"] == "instructor":
        if session.get("instructor_id") != current_user["instructor_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        if session.get("trainee_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    res = results_col.find_one({"session_id": session_id}, sort=[("created_at", -1)])
    res = to_jsonable(res) if res else None

    analysis = (res.get("analysis") if res else None) or {
        "behavior": "Unknown", "confidence": 0.0, "overall": 0, "badge": "Improving", "probs": {},
    }

    return {
        "session": to_jsonable(session),
        "analysis": analysis,
        "ai_feedback": (res.get("ai_feedback") if res else []),
        "instructor_notes": session.get("instructor_notes", ""),
        "windows": (res.get("windows") if res else []),
    }


@app.post("/sessions/{booking_id}/start")
def start_session(booking_id: str, body: SessionStartRequest, current_user=Depends(require_role("instructor"))):
    """Instructor starts a session from a confirmed booking."""
    booking = bookings_col.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if booking.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Booking not in confirmed state")

    # Ensure only one active session per instructor
    sessions_col.update_many(
        {"instructor_id": current_user["instructor_id"], "status": "active"},
        {"$set": {"status": "scheduled"}},
    )

    session_id = uuid.uuid4().hex
    road_type = "secondary"  # default, can be made dynamic later
    chosen = _pick_csv_for_simulation(road_type)
    root = _resolve_datasets_root()
    used = {
        "csv": chosen.name,
        "rel_path": str(chosen.relative_to(root)) if chosen.is_relative_to(root) else str(chosen),
    }

    trainee = users_col.find_one({"user_id": booking["trainee_id"]}, {"name": 1})

    sessions_col.insert_one({
        "session_id": session_id,
        "booking_id": booking_id,
        "instructor_id": current_user["instructor_id"],
        "instructor_name": current_user.get("name", ""),
        "trainee_id": booking["trainee_id"],
        "trainee_name": trainee.get("name", "Unknown") if trainee else "Unknown",
        "status": "active",
        "road_type": road_type,
        "dataset_used": used,
        "created_at": now_utc(),
        "started_at": now_utc(),
        "ended_at": None,
        "instructor_notes": "",
    })

    bookings_col.update_one(
        {"booking_id": booking_id},
        {"$set": {"session_id": session_id, "status": "in_progress"}},
    )

    return {"status": "ok", "session_id": session_id, "booking_id": booking_id}


@app.post("/sessions/{session_id}/end")
def end_session(session_id: str, body: SessionEndRequest, current_user=Depends(require_role("instructor"))):
    session = sessions_col.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if session.get("status") != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    road_type = (session.get("road_type") or "secondary").strip().lower()
    dataset_used = session.get("dataset_used")

    if not dataset_used or "rel_path" not in dataset_used:
        raise HTTPException(status_code=400, detail="No dataset stored for this session")

    root = _resolve_datasets_root()
    csv_path = (root / dataset_used["rel_path"]).resolve()

    if not csv_path.exists():
        raise HTTPException(status_code=500, detail="Stored dataset file not found")

    df = pd.read_csv(csv_path)

    try:
        ml_out = predict_from_dataframe(df, road_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML inference failed: {str(e)}")

    analysis_summary = {
        "behavior": ml_out.get("label", "Unknown"),
        "confidence": float(ml_out.get("confidence", 0.0)),
        "overall": int(ml_out.get("overall", 0)),
        "badge": ml_out.get("badge", "Improving"),
        "probs": ml_out.get("probs", {}),
    }

    ai_feedback = [{
        "priority": "high" if analysis_summary["behavior"] != "Normal" else "medium",
        "title": "Session analysis",
        "message": f"{analysis_summary['behavior']} (confidence {round(analysis_summary['confidence'] * 100)}%)",
        "icon": "🤖",
    }]

    result_doc = {
        "session_id": session_id,
        "booking_id": session.get("booking_id"),
        "trainee_id": session.get("trainee_id"),
        "instructor_id": session.get("instructor_id"),
        "instructor_name": session.get("instructor_name", ""),
        "created_at": now_utc(),
        "method": "ml_v1",
        "dataset_used": dataset_used,
        "analysis": analysis_summary,
        "ai_feedback": ai_feedback,
    }

    ins = results_col.insert_one(result_doc)

    sessions_col.update_one(
        {"session_id": session_id},
        {"$set": {"status": "completed", "ended_at": now_utc()}},
    )

    # Update booking status
    if session.get("booking_id"):
        bookings_col.update_one(
            {"booking_id": session["booking_id"]},
            {"$set": {"status": "completed"}},
        )

    # Update instructor total sessions
    instructor_profiles_col.update_one(
        {"instructor_id": session["instructor_id"]},
        {"$inc": {"total_sessions": 1}},
    )

    return {
        "status": "ok",
        "session_id": session_id,
        "analysis": to_jsonable(analysis_summary),
        "ai_feedback": to_jsonable(ai_feedback),
        "result_id": str(ins.inserted_id),
    }


@app.patch("/sessions/{session_id}/notes")
def update_session_notes(session_id: str, body: SessionNoteUpdate, current_user=Depends(require_role("instructor"))):
    session = sessions_col.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    sessions_col.update_one({"session_id": session_id}, {"$set": {"instructor_notes": body.instructor_notes}})
    return {"status": "ok"}


@app.get("/sessions/active")
def get_active_session(current_user=Depends(require_role("instructor"))):
    s = sessions_col.find_one(
        {"instructor_id": current_user["instructor_id"], "status": "active"},
        sort=[("started_at", -1)],
    )
    return {"active": to_jsonable(s) if s else None}


# ═══════════════════════════════════════════════════════════════════════════
# RECORDS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/records/instructor")
def instructor_records(current_user=Depends(require_role("instructor"))):
    instructor_id = current_user["instructor_id"]
    docs = list(results_col.find({"instructor_id": instructor_id}).sort("created_at", -1).limit(200))
    return to_jsonable(docs)


@app.get("/records/trainee")
def trainee_records(current_user=Depends(require_role("trainee"))):
    trainee_id = current_user["user_id"]
    docs = list(results_col.find({"trainee_id": trainee_id}).sort("created_at", -1).limit(200))
    return to_jsonable(docs)
