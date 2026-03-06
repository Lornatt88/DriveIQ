"""
routers/sessions.py
Session lifecycle: list, create, start, end, report, timeline, notes, records.
Note: ML upload pipeline is in session_router.py (prefix /api/sessions).
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from app.database import (
    bookings_col, instructor_profiles_col, results_col, sessions_col,
)
from app.datasets import pick_csv_for_simulation, resolve_datasets_root
from app.ml.predictor import predict_from_dataframe
from app.models import GenerateFeedbackRequest, SessionEndRequest, SessionNoteUpdate, SessionStartRequest
from app.permissions import get_current_user, require_role
from app.utils import now_utc, to_jsonable

router = APIRouter(tags=["Sessions"])

# Path to KNN ML source (same relative path works from routers/ directory)
_ML_SRC = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "ml-model", "src")
)


def _ensure_ml_src():
    if _ML_SRC not in sys.path:
        sys.path.insert(0, _ML_SRC)


# ── Reports list ──────────────────────────────────────────────────────────────

@router.get("/sessions/my-reports")
def my_reports(current_user=Depends(require_role("trainee"))):
    """All completed sessions with summary data for the Reports list page."""
    trainee_id = current_user["user_id"]

    sessions = list(
        sessions_col.find(
            {"trainee_id": trainee_id, "status": "completed"}
        ).sort("created_at", -1).limit(50)
    )

    session_ids = [s["session_id"] for s in sessions]
    results = {
        r["session_id"]: r
        for r in results_col.find({"session_id": {"$in": session_ids}})
    }
    # report_ready per session: True whenever any result exists (False only for sessions with no analysis yet)
    report_ready_map = {sid: True for sid in results}

    out = []
    for s in sessions:
        r = results.get(s["session_id"])

        score = 0
        passed = False
        if r:
            score = r.get("performance_score") or r.get("analysis", {}).get("overall", 0)
            passed = score >= 60
        elif s.get("performance_score"):
            score = s["performance_score"]
            passed = s.get("passed", score >= 60)

        ws = None
        if r and r.get("window_summary"):
            ws = r["window_summary"]
        elif s.get("window_summary"):
            ws = s["window_summary"]
        elif r and r.get("windows"):
            windows = r["windows"]
            ws = {
                "total": len(windows),
                "normal": sum(1 for w in windows if w.get("predicted_label") == "Normal"),
                "drowsy": sum(1 for w in windows if w.get("predicted_label") == "Drowsy"),
                "aggressive": sum(1 for w in windows if w.get("predicted_label") == "Aggressive"),
            }

        if not ws:
            ws = {"total": 0, "normal": 0, "drowsy": 0, "aggressive": 0}

        created = s.get("created_at")
        date_str = "—"
        if hasattr(created, "strftime"):
            date_str = created.strftime("%b %d, %Y")
        elif created:
            date_str = str(created)[:10]

        out.append({
            "session_id": s["session_id"],
            "date": date_str,
            "road_type": s.get("road_type", r.get("road_type", "—") if r else "—"),
            "performance_score": int(score),
            "passed": passed,
            "duration_minutes": s.get("duration_min", 0),
            "window_summary": ws,
            "instructor_name": s.get("instructor_name", "—"),
            "report_ready": report_ready_map.get(s["session_id"], False) or bool(s.get("performance_score")) or s.get("status") == "completed",
        })

    return {"sessions": to_jsonable(out)}


# ── Session list ──────────────────────────────────────────────────────────────

@router.get("/sessions")
def list_sessions(current_user=Depends(get_current_user)):
    if current_user["role"] == "instructor":
        instructor_id = current_user["instructor_id"]

        sessions = list(sessions_col.find({"instructor_id": instructor_id}).sort("created_at", -1))
        started_booking_ids = {s.get("booking_id") for s in sessions if s.get("booking_id")}

        pending_bookings = bookings_col.find({
            "instructor_id": instructor_id,
            "status": "confirmed",
            "booking_id": {"$nin": list(started_booking_ids)},
        })
        for b in pending_bookings:
            slot_date = b.get("slot_date", "")
            start_time = b.get("start_time", "00:00")
            # start_time may be "09:00" or a full ISO datetime
            if "T" in start_time:
                scheduled_at = start_time
            elif slot_date:
                scheduled_at = f"{slot_date}T{start_time}"
            else:
                scheduled_at = start_time
            sessions.append({
                "session_id": None,
                "booking_id": b["booking_id"],
                "trainee_id": b.get("trainee_id"),
                "trainee_name": b.get("trainee_name", ""),
                "instructor_id": instructor_id,
                "status": "confirmed",
                "scheduled_at": scheduled_at,
                "vehicle_id": None,
                "created_at": b.get("created_at"),
            })

        sessions.sort(key=lambda s: str(s.get("scheduled_at") or s.get("created_at") or ""), reverse=True)
        return to_jsonable(sessions)
    else:
        cur = sessions_col.find({"trainee_id": current_user["user_id"]}).sort("created_at", -1)
        return to_jsonable(list(cur))


# ── Active session ────────────────────────────────────────────────────────────

@router.get("/sessions/active")
def get_active_session(current_user=Depends(require_role("instructor"))):
    s = sessions_col.find_one(
        {"instructor_id": current_user["instructor_id"], "status": "active"},
        sort=[("started_at", -1)],
    )
    return {"active": to_jsonable(s) if s else None}


# ── Timeline ──────────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/timeline")
def session_timeline(session_id: str, current_user=Depends(get_current_user)):
    """All windows for a session with computed time fields."""
    session = sessions_col.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user["role"] == "instructor":
        if session.get("instructor_id") != current_user.get("instructor_id"):
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        if session.get("trainee_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    result = results_col.find_one(
        {"session_id": session_id},
        sort=[("created_at", -1)]
    )

    if not result or not result.get("windows"):
        return {
            "session_id": session_id,
            "road_type": session.get("road_type", "Unknown"),
            "total_windows": 0,
            "window_duration_minutes": 4,
            "windows": [],
        }

    window_duration = 4

    enriched = []
    for w in result["windows"]:
        wid = w.get("window_id", 0)
        start_min = wid * window_duration
        end_min = start_min + window_duration
        enriched.append({
            **w,
            "start_time": f"{start_min // 60:02d}:{start_min % 60:02d}",
            "end_time": f"{end_min // 60:02d}:{end_min % 60:02d}",
            "is_flagged": w.get("predicted_label", "Normal") != "Normal",
        })

    return to_jsonable({
        "session_id": session_id,
        "road_type": result.get("road_type", session.get("road_type", "Unknown")),
        "total_windows": len(enriched),
        "window_duration_minutes": window_duration,
        "windows": enriched,
    })


# ── Session report ────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/report")
def session_report(session_id: str, current_user=Depends(get_current_user)):
    """Session metadata + score + window summary for the Report detail page."""
    session = sessions_col.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user["role"] == "instructor":
        if session.get("instructor_id") != current_user.get("instructor_id"):
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        if session.get("trainee_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    result = results_col.find_one(
        {"session_id": session_id},
        sort=[("created_at", -1)]
    )

    # report_ready: True if result exists, has inline perf data, or session is already completed (seeded sessions)
    report_ready = bool(result) or bool(session.get("performance_score")) or session.get("status") == "completed"

    score = 0
    if result:
        score = result.get("performance_score") or result.get("analysis", {}).get("overall", 0)
    elif session.get("performance_score"):
        score = session["performance_score"]

    ws = None
    if result and result.get("window_summary"):
        ws = result["window_summary"]
    elif session.get("window_summary"):
        ws = session["window_summary"]
    elif result and result.get("windows"):
        windows = result["windows"]
        ws = {
            "total": len(windows),
            "normal": sum(1 for w in windows if w.get("predicted_label") == "Normal"),
            "drowsy": sum(1 for w in windows if w.get("predicted_label") == "Drowsy"),
            "aggressive": sum(1 for w in windows if w.get("predicted_label") == "Aggressive"),
        }

    if not ws:
        ws = {"total": 0, "normal": 0, "drowsy": 0, "aggressive": 0}

    created = session.get("created_at")
    date_str = "—"
    time_str = "—"
    if hasattr(created, "strftime"):
        date_str = created.strftime("%b %d, %Y")
        time_str = created.strftime("%H:%M")

    analysis = {}
    ai_feedback = []
    if result:
        analysis = result.get("analysis") or {
            "behavior": "Unknown", "confidence": 0.0,
            "overall": int(score), "badge": "Improving", "probs": {},
        }
        ai_feedback = result.get("ai_feedback") or []

    return to_jsonable({
        "report_ready": report_ready,
        "session_summary": {
            "date": date_str,
            "time": time_str,
            "instructor": session.get("instructor_name", "—"),
            "vehicle_id": session.get("vehicle_id", "—"),
            "duration_minutes": session.get("duration_min", 0),
        },
        "overall_score": {
            "score": int(score),
            "passed": score >= 60,
        },
        "road_type": session.get("road_type", "Unknown"),
        "window_summary": ws,
        "summary_feedback": result.get("summary_feedback") if result else None,
        "session": session,
        "analysis": analysis,
        "ai_feedback": ai_feedback,
        "instructor_notes": session.get("instructor_notes", ""),
        "windows": (result.get("windows") if result else []),
    })


# ── Generate ML report ────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/generate-feedback")
def generate_session_feedback(session_id: str, body: GenerateFeedbackRequest, current_user=Depends(require_role("instructor"))):
    """Run the KNN ML pipeline on a completed session and store results."""
    session = sessions_col.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("instructor_id") != current_user.get("instructor_id"):
        raise HTTPException(status_code=403, detail="Forbidden")

    _ensure_ml_src()
    from knn_alerts_inference import run_full_knn_pipeline  # noqa: PLC0415

    test_json_path = os.path.join(_ML_SRC, "test_session.json")
    with open(test_json_path) as f:
        sensor_json = json.load(f)

    rt = session.get("road_type", "Motorway").strip().title()
    sensor_json["session_id"] = session_id
    sensor_json["road_type"] = rt

    ml_result = run_full_knn_pipeline(sensor_json)
    summary = ml_result["session_summary"]
    ml_windows = ml_result["windows"]

    results_col.update_one(
        {"session_id": session_id},
        {"$set": {
            "session_id": session_id,
            "trainee_id": session.get("trainee_id"),
            "instructor_id": session.get("instructor_id"),
            "booking_id": session.get("booking_id"),
            "road_type": rt,
            "session_summary": summary,
            "windows": ml_windows,
            "created_at": now_utc(),
        }},
        upsert=True,
    )

    sessions_col.update_one(
        {"session_id": session_id},
        {"$set": {
            "performance_score":  summary.get("performance_score"),
            "session_risk_score": summary.get("session_risk_score"),
            "dominant_alert":     summary.get("dominant_alert"),
            "average_severity":   summary.get("average_severity"),
            "max_severity":       summary.get("max_severity"),
            "total_windows":      summary.get("total_windows"),
            "total_alerts":       summary.get("total_alerts"),
            "window_summary":     summary.get("window_summary"),
            "instructor_notes":   body.instructor_notes,
            "processed_at":       now_utc(),
        }},
    )

    return {
        "status": "ok",
        "session_id": session_id,
        "total_windows": summary.get("total_windows", len(ml_windows)),
        "performance_score": summary.get("performance_score"),
        "session_risk_score": summary.get("session_risk_score"),
        "dominant_alert": summary.get("dominant_alert"),
        "average_severity": summary.get("average_severity"),
        "window_summary": summary.get("window_summary"),
    }


# ── Start session ─────────────────────────────────────────────────────────────

@router.post("/sessions/{booking_id}/start")
def start_session(booking_id: str, body: SessionStartRequest, current_user=Depends(require_role("instructor"))):
    """Instructor starts a session from a confirmed booking."""
    booking = bookings_col.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if booking.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Booking not in confirmed state")

    sessions_col.update_many(
        {"instructor_id": current_user["instructor_id"], "status": "active"},
        {"$set": {"status": "scheduled"}},
    )

    session_id = uuid.uuid4().hex
    road_type = body.road_type.strip().title()  # "Motorway" or "Secondary"
    chosen = pick_csv_for_simulation(road_type.lower())
    root = resolve_datasets_root()
    used = {
        "csv": chosen.name,
        "rel_path": str(chosen.relative_to(root)) if chosen.is_relative_to(root) else str(chosen),
    }

    from app.database import users_col  # noqa: PLC0415
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


# ── End session ───────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/end")
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

    root = resolve_datasets_root()
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

    if session.get("booking_id"):
        bookings_col.update_one(
            {"booking_id": session["booking_id"]},
            {"$set": {"status": "completed"}},
        )

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


# ── Session notes ─────────────────────────────────────────────────────────────

@router.patch("/sessions/{session_id}/notes")
def update_session_notes(session_id: str, body: SessionNoteUpdate, current_user=Depends(require_role("instructor"))):
    session = sessions_col.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    sessions_col.update_one({"session_id": session_id}, {"$set": {"instructor_notes": body.instructor_notes}})
    return {"status": "ok"}


# ── Records ───────────────────────────────────────────────────────────────────

@router.get("/records/instructor")
def instructor_records(current_user=Depends(require_role("instructor"))):
    instructor_id = current_user["instructor_id"]
    docs = list(results_col.find({"instructor_id": instructor_id}).sort("created_at", -1).limit(200))
    return to_jsonable(docs)


@router.get("/records/trainee")
def trainee_records(current_user=Depends(require_role("trainee"))):
    trainee_id = current_user["user_id"]
    docs = list(results_col.find({"trainee_id": trainee_id}).sort("created_at", -1).limit(200))
    return to_jsonable(docs)
