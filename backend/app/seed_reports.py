"""
seed_reports.py — Insert dummy session + results data for testing the Reports page
==================================================================================
Run from the backend directory:
    python -m app.seed_reports

This inserts:
  - 5 sessions for Ziyan (varied road types, window counts, scores)
  - 2 sessions for Ahmad
  - Each with full window arrays + dummy LLM feedback

Window counts vary between 16-28 (64-112 min sessions, i.e. ~1-2 hours).
"""

import uuid
import random
from datetime import datetime, timedelta

# ── Adjust this import to match your project structure ──────────────────────
try:
    from app.database import sessions_col, results_col
except ImportError:
    from pymongo import MongoClient
    import os
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB = os.getenv("MONGO_DB", "driveiq")
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    sessions_col = db["sessions"]
    results_col = db["results"]


# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

ZIYAN_USER_ID = "338b532844bb43e3bb2d7614803a7a6c"
AHMAD_USER_ID = "31af0037ba0647ae8dc7b7ee43596524"

FAKE_INSTRUCTOR_ID = "demo_instructor_001"
FAKE_INSTRUCTOR_NAME = "Dr. Sarah Mitchell"


# ═══════════════════════════════════════════════════════════════════════════════
# WINDOW GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

NORMAL_FEEDBACK = [
    "Good control and smooth acceleration. Your speed was consistent and within safe limits.",
    "Excellent lane discipline and steady speed maintenance throughout this window.",
    "Your driving in this window shows generally stable control, which is a positive indicator.",
    "Well-maintained following distance and smooth steering inputs. Keep it up!",
    "Consistent speed and smooth braking. This window reflects safe driving behavior.",
    "Smooth transitions between acceleration and cruising. No issues detected.",
    "Solid driving here — steering was controlled and speed was well within range.",
]


def _generate_windows(num_windows, normal_pct, aggressive_pct, road_type, seed_val=42):
    """
    Generate variable-length window arrays with road-type-aware metrics.
    
    Args:
        num_windows: 16-28 windows (64-112 min at 4 min each)
        normal_pct: fraction of normal windows
        aggressive_pct: fraction of aggressive windows (remainder = drowsy)
        road_type: "Motorway" or "Secondary" — affects speed ranges
        seed_val: for reproducibility
    """
    random.seed(seed_val)

    aggressive_count = max(0, round(num_windows * aggressive_pct))
    drowsy_count = max(0, num_windows - round(num_windows * normal_pct) - aggressive_count)
    normal_count = num_windows - aggressive_count - drowsy_count

    classifications = (
        ["Normal"] * normal_count
        + ["Aggressive"] * aggressive_count
        + ["Drowsy"] * drowsy_count
    )
    random.shuffle(classifications)

    is_motorway = road_type.lower() in ("motorway", "motor", "highway")

    windows = []
    for i, label in enumerate(classifications):
        w = {
            "window_id": i,
            "predicted_label": label,
            "alert_cause": "No alert",
            "severity": 0.0,
            "knn_distance": round(random.uniform(1.2, 3.5), 4),
            "trigger_features": [],
            "feedback": None,
        }

        if label == "Aggressive":
            cause = random.choice(["Overspeeding", "Harsh acceleration / braking"])
            severity = round(random.uniform(3.5, 8.5), 1)
            w["alert_cause"] = cause
            w["severity"] = severity
            w["knn_distance"] = round(random.uniform(4.0, 7.0), 4)

            if cause == "Overspeeding":
                max_spd = round(random.uniform(130, 165), 2) if is_motorway else round(random.uniform(72, 98), 2)
                w["trigger_features"] = [
                    {"feature": "Maximum Speed", "value": max_spd, "unit": "km/h"},
                    {"feature": "Speed Ratio", "value": round(random.uniform(-60, -10), 2), "unit": "ratio"},
                ]
                w["feedback"] = (
                    f"Your driving in this window shows signs of overspeeding. "
                    f"The maximum speed reached {max_spd} km/h, which exceeds the expected range "
                    f"for this road type. Try maintaining a consistent speed within the posted limits, "
                    f"especially when transitioning between road segments."
                )
            else:
                accel = round(random.uniform(2.8, 6.0), 2)
                w["trigger_features"] = [
                    {"feature": "Longitudinal Acceleration", "value": accel, "unit": "m/s²"},
                    {"feature": "Brake Pressure", "value": round(random.uniform(0.55, 0.95), 3), "unit": "normalized"},
                ]
                w["feedback"] = (
                    f"Harsh braking was detected in this window with a longitudinal acceleration of "
                    f"{accel} m/s². This suggests sudden stops that can be uncomfortable for passengers "
                    f"and indicate late reaction to traffic changes. "
                    f"Try anticipating stops earlier and applying gradual pressure."
                )

        elif label == "Drowsy":
            severity = round(random.uniform(1.5, 5.5), 1)
            w["alert_cause"] = "Unstable driving"
            w["severity"] = severity
            w["knn_distance"] = round(random.uniform(3.0, 5.5), 4)
            lane_dev = round(random.uniform(0.2, 0.8), 3)
            steer_var = round(random.uniform(1.8, 6.0), 2)
            w["trigger_features"] = [
                {"feature": "Lane Deviation", "value": lane_dev, "unit": "meters"},
                {"feature": "Steering Variability", "value": steer_var, "unit": "degrees"},
            ]
            w["feedback"] = (
                f"Your driving in this window shows patterns consistent with drowsiness. "
                f"Lane deviation of {lane_dev} meters and steering variability of {steer_var} degrees "
                f"suggest reduced alertness. Consider taking a break if you've been driving for an "
                f"extended period. Fatigue significantly impacts reaction times."
            )

        else:
            w["feedback"] = random.choice(NORMAL_FEEDBACK)

        windows.append(w)

    return windows


# ═══════════════════════════════════════════════════════════════════════════════
# BUILD DOCUMENTS
# ═══════════════════════════════════════════════════════════════════════════════

def build_session_and_result(trainee_id, road_type, windows, performance_score, days_ago=0):
    session_id = uuid.uuid4().hex
    booking_id = uuid.uuid4().hex
    created = datetime.utcnow() - timedelta(days=days_ago)
    started = created
    ended = created + timedelta(minutes=len(windows) * 4)
    duration = len(windows) * 4

    normal_count = sum(1 for w in windows if w["predicted_label"] == "Normal")
    aggressive_count = sum(1 for w in windows if w["predicted_label"] == "Aggressive")
    drowsy_count = sum(1 for w in windows if w["predicted_label"] == "Drowsy")

    ws = {
        "total": len(windows),
        "normal": normal_count,
        "drowsy": drowsy_count,
        "aggressive": aggressive_count,
    }

    session_doc = {
        "session_id": session_id,
        "booking_id": booking_id,
        "instructor_id": FAKE_INSTRUCTOR_ID,
        "instructor_name": FAKE_INSTRUCTOR_NAME,
        "trainee_id": trainee_id,
        "vehicle_id": random.choice(["VH-487", "VH-312", "VH-891"]),
        "duration_min": duration,
        "status": "completed",
        "road_type": road_type,
        "performance_score": performance_score,
        "passed": performance_score >= 60,
        "dataset_used": {"csv": f"demo_{road_type.lower()}.csv", "rel_path": f"demo/{road_type.lower()}.csv"},
        "created_at": created,
        "started_at": started,
        "ended_at": ended,
        "instructor_notes": "",
        "window_summary": ws,
    }

    result_doc = {
        "session_id": session_id,
        "booking_id": booking_id,
        "trainee_id": trainee_id,
        "instructor_id": FAKE_INSTRUCTOR_ID,
        "instructor_name": FAKE_INSTRUCTOR_NAME,
        "created_at": created,
        "method": "ml_v2_windowed",
        "dataset_used": session_doc["dataset_used"],

        # Legacy analysis (for dashboard backward compat)
        "analysis": {
            "behavior": "Normal" if normal_count > (aggressive_count + drowsy_count) else "Aggressive" if aggressive_count > drowsy_count else "Drowsy",
            "confidence": round(normal_count / len(windows), 2),
            "overall": int(performance_score),
            "badge": "Safe Driver" if performance_score >= 80 else "Improving" if performance_score >= 60 else "Needs Work",
            "probs": {
                "Normal": round(normal_count / len(windows), 3),
                "Aggressive": round(aggressive_count / len(windows), 3),
                "Drowsy": round(drowsy_count / len(windows), 3),
            },
        },
        "ai_feedback": [{
            "priority": "high" if aggressive_count > 3 else "medium",
            "title": "Session Analysis",
            "message": f"Session completed with {normal_count} normal, {aggressive_count} aggressive, and {drowsy_count} drowsy windows.",
            "icon": "🤖",
        }],

        # New: full window data for reports page
        "road_type": road_type,
        "performance_score": performance_score,
        "windows": windows,
        "window_summary": ws,

        # LLM session summary
        "summary_feedback": (
            f"Over this {duration}-minute {road_type.lower()} session, your driving was predominantly "
            f"classified as normal ({normal_count} of {len(windows)} windows). "
            + (f"However, {aggressive_count} windows showed aggressive behavior — primarily "
               f"related to speed control and braking patterns. " if aggressive_count > 0 else "")
            + (f"Additionally, {drowsy_count} windows indicated signs of drowsiness, "
               f"suggesting fatigue may have affected your alertness. " if drowsy_count > 0 else "")
            + f"Your overall performance score of {performance_score} reflects "
            + ("strong driving ability. Keep up the consistent habits!" if performance_score >= 80
               else "room for improvement. Focus on the flagged areas in each window." if performance_score >= 60
               else "significant areas that need attention. Please review the flagged windows carefully.")
        ),
    }

    return session_doc, result_doc


# ═══════════════════════════════════════════════════════════════════════════════
# SEED
# ═══════════════════════════════════════════════════════════════════════════════

def seed():
    print("🌱 Seeding DriveIQ report data...")
    print()

    # (trainee, road_type, num_windows, normal%, aggressive%, score, days_ago, seed, instructor_notes)
    configs = [
        # ── Ziyan — 5 sessions (oldest → newest) ────────────────────────
        (ZIYAN_USER_ID, "Motorway",  28, 0.60, 0.18, 76.0, 14, 42,
         "Good improvement since last session. Focus on maintaining lane positioning."),

        (ZIYAN_USER_ID, "Secondary", 18, 0.78, 0.11, 88.0, 10, 99,
         "Much better control on secondary roads. Watch your speed near intersections."),

        (ZIYAN_USER_ID, "Motorway",  24, 0.67, 0.13, 81.0,  6, 55,
         "Consistent improvement on motorway driving. Braking is smoother now."),

        (ZIYAN_USER_ID, "Secondary", 16, 0.81, 0.06, 91.0,  3, 77,
         "Excellent session! Very few flagged windows. Keep this up."),

        (ZIYAN_USER_ID, "Motorway",  22, 0.55, 0.23, 64.0,  0, 31,
         "Tough session — fatigue was noticeable in the second half. Rest before long drives."),

        # ── Ahmad — 2 sessions ──────────────────────────────────────────
        (AHMAD_USER_ID, "Motorway",  26, 0.62, 0.15, 72.0,  5, 88,
         "Decent first session. Speed control needs work, especially in the first 30 minutes."),

        (AHMAD_USER_ID, "Secondary", 20, 0.75, 0.10, 85.0,  1, 14,
         "Great improvement from last time. Lane discipline was much better."),
    ]

    all_sessions = []
    all_results = []

    for (trainee, road, n_win, norm_pct, agg_pct, score, days, sd, notes) in configs:
        windows = _generate_windows(n_win, norm_pct, agg_pct, road_type=road, seed_val=sd)
        s, r = build_session_and_result(
            trainee_id=trainee,
            road_type=road,
            windows=windows,
            performance_score=score,
            days_ago=days,
        )
        s["instructor_notes"] = notes
        all_sessions.append(s)
        all_results.append(r)

    # ── Clean up previous seed data ──────────────────────────────────────
    deleted_s = sessions_col.delete_many({"instructor_id": FAKE_INSTRUCTOR_ID})
    deleted_r = results_col.delete_many({"instructor_id": FAKE_INSTRUCTOR_ID})
    if deleted_s.deleted_count or deleted_r.deleted_count:
        print(f"  🧹 Cleaned up {deleted_s.deleted_count} old sessions, {deleted_r.deleted_count} old results")

    # ── Insert ───────────────────────────────────────────────────────────
    sessions_col.insert_many(all_sessions)
    results_col.insert_many(all_results)

    print(f"  ✅ Inserted {len(all_sessions)} sessions + results")
    print()
    print(f"  {'#':<4} {'User':<8} {'Road':<12} {'Win':>4} {'Duration':>10} {'Score':>6}  Breakdown")
    print(f"  {'─'*4} {'─'*8} {'─'*12} {'─'*4} {'─'*10} {'─'*6}  {'─'*20}")
    for i, s in enumerate(all_sessions):
        who = "Ziyan" if s["trainee_id"] == ZIYAN_USER_ID else "Ahmad"
        ws = s["window_summary"]
        print(f"  {i+1:<4} {who:<8} {s['road_type']:<12} {ws['total']:>4} {ws['total']*4:>7} min {s['performance_score']:>6.0f}  "
              f"N:{ws['normal']} A:{ws['aggressive']} D:{ws['drowsy']}")
    print()
    print(f"  📱 Log in as Ziyan → 5 reports  |  Ahmad → 2 reports")
    print(f"  🌱 Done!")


if __name__ == "__main__":
    seed()
