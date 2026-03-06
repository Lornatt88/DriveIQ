"""
routers/dashboard.py
Trainee and instructor dashboards.
Also: instructor view of a student's history, and instructor's learner list.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.database import (
    bookings_col, instructor_profiles_col, results_col, sessions_col,
    settings_col, users_col,
)
from app.permissions import get_current_user, require_role
from app.utils import now_utc, to_jsonable

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard/trainee")
def trainee_dashboard(current_user=Depends(require_role("trainee"))):
    trainee_id = current_user["user_id"]

    all_sessions = list(
        sessions_col.find({"trainee_id": trainee_id}).sort("created_at", -1)
    )
    completed_sessions = [s for s in all_sessions if s.get("status") == "completed"]

    raw_upcoming = list(
        bookings_col.find(
            {"trainee_id": trainee_id, "status": "confirmed"}
        ).sort([("slot_date", 1), ("start_time", 1)])
    )

    def _build_upcoming(b: dict) -> dict:
        inst = users_col.find_one(
            {"instructor_id": b.get("instructor_id")}, {"name": 1}
        )
        inst_name = inst.get("name", "—") if inst else "—"
        slot_date = b.get("slot_date", "")
        start_time = b.get("start_time", "")
        sched = start_time
        if sched and "T" not in sched and slot_date:
            sched = f"{slot_date}T{sched}"
        try:
            dt = datetime.fromisoformat(sched) if sched else None
        except (ValueError, TypeError):
            dt = None
        return {
            "booking_id":    b.get("booking_id"),
            "date_iso":      dt.strftime("%Y-%m-%d") if dt else (slot_date or "—"),
            "dateISO":       dt.strftime("%Y-%m-%d") if dt else (slot_date or "—"),
            "date_label":    dt.strftime("%b %d, %Y") if dt else (slot_date or "—"),
            "dateLabel":     dt.strftime("%b %d, %Y") if dt else (slot_date or "—"),
            "time_label":    dt.strftime("%H:%M") if dt else (start_time or "—"),
            "timeLabel":     dt.strftime("%H:%M") if dt else (start_time or "—"),
            "instructor":    inst_name,
            "instructor_id": b.get("instructor_id"),
        }

    upcoming_sessions_list = [_build_upcoming(b) for b in raw_upcoming]
    upcoming_session = upcoming_sessions_list[0] if upcoming_sessions_list else None

    recent_results = list(
        results_col.find({"trainee_id": trainee_id}).sort("created_at", -1).limit(10)
    )

    latest = recent_results[0] if recent_results else None
    latest_analysis = (latest.get("analysis") if latest else None) or {}
    all_scores = [r.get("performance_score") or r.get("analysis", {}).get("overall", 0) for r in recent_results if r]
    current_score = int(sum(all_scores) / len(all_scores)) if all_scores else 0
    badge = "Safe Driver" if current_score >= 80 else "Improving" if current_score >= 60 else "Needs Work"

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

    summary_feedback = (latest.get("summary_feedback") if latest else None)
    raw_ai = (latest.get("ai_feedback") if latest else []) or []

    if summary_feedback:
        ai_feedback = [{
            "id": "summary",
            "title": "Session Summary",
            "message": summary_feedback,
            "icon": "🧠",
            "score": latest_analysis.get("overall", 0),
            "priority": "high",
        }]
    else:
        ai_feedback = raw_ai

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

    user_settings = settings_col.find_one({"user_id": trainee_id}) or {}
    achievements = user_settings.get("achievements", [])

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
        "upcoming_sessions":    upcoming_sessions_list,
        "recent_reports":       to_jsonable(recent_reports),
        "recent_sessions":      to_jsonable(all_sessions[:5]),
        "ai_feedback":          to_jsonable(ai_feedback),
        "instructor_comments":  to_jsonable(instructor_comments),
        "achievements":         to_jsonable(achievements),
        "milestones":           to_jsonable(milestones),
    }


@router.get("/dashboard/instructor")
def instructor_dashboard(current_user=Depends(require_role("instructor"))):
    instructor_id = current_user["instructor_id"]

    recent_sessions = list(
        sessions_col.find({"instructor_id": instructor_id}).sort("created_at", -1).limit(20)
    )

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

    latest_results = list(
        results_col.find({"instructor_id": instructor_id}).sort("created_at", -1).limit(50)
    )
    scores = [float(r["analysis"]["overall"]) for r in latest_results if r.get("analysis", {}).get("overall")]
    avg_score = int(sum(scores) / len(scores)) if scores else 0

    upcoming = list(
        bookings_col.find(
            {"instructor_id": instructor_id, "status": "confirmed"},
            {"_id": 0},
        ).sort("start_time", 1).limit(10)
    )
    for b in upcoming:
        trainee = users_col.find_one({"user_id": b.get("trainee_id")}, {"name": 1})
        b["trainee_name"] = trainee.get("name", "Unknown") if trainee else "Unknown"

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


@router.get("/instructor/student/{trainee_id}/history")
def student_history_for_instructor(trainee_id: str, current_user=Depends(require_role("instructor"))):
    """Instructor views a student's past sessions."""
    instructor_id = current_user["instructor_id"]

    has_booking = bookings_col.find_one({
        "instructor_id": instructor_id, "trainee_id": trainee_id,
    })
    if not has_booking:
        raise HTTPException(status_code=403, detail="No booking relationship with this student")

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


@router.get("/instructor/learners")
def instructor_learners(current_user=Depends(require_role("instructor"))):
    """Return all trainees that have at least one booking with this instructor."""
    instructor_id = current_user["instructor_id"]

    trainee_ids = list(set(
        b["trainee_id"] for b in bookings_col.find(
            {"instructor_id": instructor_id}, {"trainee_id": 1}
        ) if b.get("trainee_id")
    ))

    learners = list(
        users_col.find(
            {"user_id": {"$in": trainee_ids}, "role": "trainee"},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1},
        )
    )

    return to_jsonable(learners)
