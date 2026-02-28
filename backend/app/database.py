"""
database.py — v2 Per-Session Booking Model
============================================
Removed: institute_codes, join_code indexes, trainee_of_instructor_id
Added:   instructor_profiles, availability, bookings, reviews
"""

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import OperationFailure
from app.config import MONGO_URI, MONGO_DB

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

# ── Collections ─────────────────────────────────────────────────────────────

users_col               = db["users"]
institute_codes_col     = db["institute_codes"]
instructor_profiles_col = db["instructor_profiles"]
availability_col        = db["availability"]
bookings_col            = db["bookings"]
sessions_col            = db["sessions"]
results_col             = db["results"]
reviews_col             = db["reviews"]
settings_col            = db["settings"]


def _safe_create_index(col, keys, **kwargs):
    try:
        col.create_index(keys, **kwargs)
    except (OperationFailure, Exception):
        pass


def ensure_indexes():
    # ── USERS ───────────────────────────────────────────────────────────
    _safe_create_index(users_col, [("email", ASCENDING)], unique=True, name="email_unique")
    _safe_create_index(users_col, [("user_id", ASCENDING)], unique=True, name="user_id_unique")
    _safe_create_index(users_col, [("role", ASCENDING), ("created_at", DESCENDING)], name="role_created")

    # ── INSTITUTE CODES ─────────────────────────────────────────────────
    _safe_create_index(institute_codes_col, [("code", ASCENDING)], unique=True, name="ic_code_unique")
    _safe_create_index(institute_codes_col, [("used", ASCENDING)], name="ic_used")

    # ── INSTRUCTOR PROFILES ─────────────────────────────────────────────
    _safe_create_index(instructor_profiles_col, [("instructor_id", ASCENDING)], unique=True, name="ip_instructor_id")
    _safe_create_index(instructor_profiles_col, [("rating", DESCENDING)], name="ip_rating")
    _safe_create_index(instructor_profiles_col, [("active", ASCENDING), ("rating", DESCENDING)], name="ip_active_rating")
    _safe_create_index(instructor_profiles_col, [("specialties", ASCENDING)], name="ip_specialties")
    _safe_create_index(instructor_profiles_col, [("location_area", ASCENDING)], name="ip_location")

    # ── AVAILABILITY ────────────────────────────────────────────────────
    _safe_create_index(availability_col, [("instructor_id", ASCENDING), ("date", ASCENDING)], name="av_instructor_date")
    _safe_create_index(availability_col, [("slot_id", ASCENDING)], unique=True, name="av_slot_id")
    _safe_create_index(availability_col, [("status", ASCENDING), ("date", ASCENDING)], name="av_status_date")
    _safe_create_index(availability_col, [("instructor_id", ASCENDING), ("status", ASCENDING), ("date", ASCENDING)], name="av_inst_status_date")

    # ── BOOKINGS ────────────────────────────────────────────────────────
    _safe_create_index(bookings_col, [("booking_id", ASCENDING)], unique=True, name="bk_booking_id")
    _safe_create_index(bookings_col, [("trainee_id", ASCENDING), ("created_at", DESCENDING)], name="bk_trainee_created")
    _safe_create_index(bookings_col, [("instructor_id", ASCENDING), ("created_at", DESCENDING)], name="bk_instructor_created")
    _safe_create_index(bookings_col, [("status", ASCENDING), ("created_at", DESCENDING)], name="bk_status_created")
    _safe_create_index(bookings_col, [("slot_id", ASCENDING)], name="bk_slot_id")

    # ── SESSIONS ────────────────────────────────────────────────────────
    _safe_create_index(sessions_col, [("session_id", ASCENDING)], unique=True, name="ss_session_id")
    _safe_create_index(sessions_col, [("trainee_id", ASCENDING), ("created_at", DESCENDING)], name="ss_trainee_created")
    _safe_create_index(sessions_col, [("instructor_id", ASCENDING), ("created_at", DESCENDING)], name="ss_instructor_created")
    _safe_create_index(sessions_col, [("booking_id", ASCENDING)], name="ss_booking_id")
    _safe_create_index(sessions_col, [("status", ASCENDING)], name="ss_status")

    # ── RESULTS ─────────────────────────────────────────────────────────
    _safe_create_index(results_col, [("session_id", ASCENDING)], name="rs_session_id")
    _safe_create_index(results_col, [("trainee_id", ASCENDING), ("created_at", DESCENDING)], name="rs_trainee_created")
    _safe_create_index(results_col, [("instructor_id", ASCENDING), ("created_at", DESCENDING)], name="rs_instructor_created")
    _safe_create_index(results_col, [("booking_id", ASCENDING)], name="rs_booking_id")

    # ── REVIEWS ─────────────────────────────────────────────────────────
    _safe_create_index(reviews_col, [("instructor_id", ASCENDING), ("created_at", DESCENDING)], name="rv_instructor_created")
    _safe_create_index(reviews_col, [("trainee_id", ASCENDING)], name="rv_trainee")
    _safe_create_index(reviews_col, [("review_id", ASCENDING)], unique=True, name="rv_review_id")

    # ── SETTINGS ────────────────────────────────────────────────────────
    _safe_create_index(settings_col, [("user_id", ASCENDING)], unique=True, name="st_user_id")
