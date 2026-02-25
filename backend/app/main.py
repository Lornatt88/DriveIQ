# app/main.py
from __future__ import annotations

import os
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from pydantic import BaseModel, Field

from app.auth import hash_password, verify_password
from app.config import DATASETS_ROOT, JWT_ALG, JWT_EXPIRE_MIN, JWT_SECRET
from app.database import (
    ensure_indexes,
    events_col,
    files_col,
    institute_codes_col,
    metrics_col,
    results_col,
    sessions_col,
    settings_col,
    trips_col,
    users_col,
)
from app.ml.predictor import predict_from_dataframe
from app.permissions import get_current_user, require_role
from app.utils import to_jsonable

# ---------------------------
# Helpers
# ---------------------------

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


# ---------------------------
# Models
# ---------------------------

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    confirm_password: str
    role: str = Field(..., pattern="^(instructor|trainee)$")
    institute_code: Optional[str] = None


class LoginRequest(BaseModel):
    id: Optional[str] = None
    email: Optional[str] = None
    password: str


class UserPublic(BaseModel):
    user_id: str
    role: str
    name: str
    email: str
    instructor_id: Optional[str] = None
    join_code: Optional[str] = None
    trainee_of_instructor_id: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class JoinRequest(BaseModel):
    join_code: str


class TripCreate(BaseModel):
    trainee_id: str
    road_type: str
    notes: str = ""
    expected_label: str = ""


class TripUpdate(BaseModel):
    road_type: Optional[str] = None
    notes: Optional[str] = None
    expected_label: Optional[str] = None
    status: Optional[str] = None


class IngestRequest(BaseModel):
    dataset_folder: str  # folder name under DATASETS_ROOT


class SessionCreate(BaseModel):
    trainee_id: str
    vehicle_id: str = "UNKNOWN"
    scheduled_at: str
    duration_min: int = 60
    notes: str = ""
    road_type: str = "secondary"  # stored (internal)


class SessionNoteUpdate(BaseModel):
    instructor_notes: str


class SettingsUpdate(BaseModel):
    profile: Optional[dict] = None
    notifications: Optional[dict] = None
    preferences: Optional[dict] = None


class MLPredictRequest(BaseModel):
    dataset_folder: str
    road_type: str = "secondary"


class SessionStartRequest(BaseModel):
    pass


class SessionEndRequest(BaseModel):
    pass


# ---------------------------
# App
# ---------------------------

app = FastAPI(title="DriveIQ Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev
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


# ---------------------------
# AUTH
# ---------------------------

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
    join_code = None

    if role == "instructor":
        if not body.institute_code:
            raise HTTPException(status_code=400, detail="institute_code is required for instructor")

        institute_code = body.institute_code.strip()
        code_doc = institute_codes_col.find_one({"code": institute_code})
        if not code_doc:
            raise HTTPException(status_code=400, detail="Invalid institute_code")
        if code_doc.get("used") is True:
            raise HTTPException(status_code=400, detail="Institute code already used")

        instructor_id = uuid.uuid4().hex
        join_code = ("J" + uuid.uuid4().hex[:6]).upper()

        doc = {
            "user_id": user_id,
            "role": "instructor",
            "name": body.name.strip(),
            "email": email,
            "password_hash": hash_password(body.password),
            "instructor_id": instructor_id,
            "join_code": join_code,
            "created_at": now_utc(),
        }
        users_col.insert_one(doc)

        institute_codes_col.update_one(
            {"_id": code_doc["_id"], "used": {"$ne": True}},
            {"$set": {"used": True, "used_by": user_id, "used_at": now_utc()}},
        )

    else:
        doc = {
            "user_id": user_id,
            "role": "trainee",
            "name": body.name.strip(),
            "email": email,
            "password_hash": hash_password(body.password),
            "trainee_of_instructor_id": None,
            "created_at": now_utc(),
        }
        users_col.insert_one(doc)

    token = create_access_token(subject=user_id, extra={"role": role, "email": email})

    user_public = UserPublic(
        user_id=user_id,
        role=role,
        name=body.name.strip(),
        email=email,
        instructor_id=instructor_id,
        join_code=join_code,
        trainee_of_instructor_id=None,
    )

    return TokenResponse(access_token=token, token_type="bearer", user=user_public)


@app.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest):
    identifier = (body.id or body.email or "").strip().lower()
    if not identifier:
        raise HTTPException(status_code=422, detail="Missing id/email")

    user = users_col.find_one({"email": identifier})
    if not user:
        raise HTTPException(status_code=401, detail="Wrong email or password")

    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Wrong email or password")

    token = create_access_token(
        subject=user["user_id"],
        extra={"role": user.get("role"), "email": user.get("email")},
    )

    pub = UserPublic(
        user_id=user["user_id"],
        role=user["role"],
        name=user.get("name", ""),
        email=user.get("email", ""),
        instructor_id=user.get("instructor_id"),
        join_code=user.get("join_code"),
        trainee_of_instructor_id=user.get("trainee_of_instructor_id"),
    )

    return TokenResponse(access_token=token, token_type="bearer", user=pub)


@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return to_jsonable(current_user)


# ---------------------------
# TRAINEE JOIN
# ---------------------------

@app.post("/trainee/join")
def trainee_join(body: JoinRequest, current_user=Depends(require_role("trainee"))):
    join_code = body.join_code.strip().upper()

    instructor = users_col.find_one({"role": "instructor", "join_code": join_code})
    if not instructor:
        raise HTTPException(status_code=400, detail="Invalid join_code")

    users_col.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"trainee_of_instructor_id": instructor["instructor_id"]}},
    )

    return {
        "status": "ok",
        "linked_to": {
            "instructor_id": instructor["instructor_id"],
            "instructor_name": instructor.get("name", ""),
            "join_code": join_code,
        },
    }


# ---------------------------
# DASHBOARDS
# ---------------------------

@app.get("/dashboard/instructor")
def instructor_dashboard(current_user=Depends(require_role("instructor"))):
    instructor_id = current_user["instructor_id"]

    learners = list(
        users_col.find(
            {"role": "trainee", "trainee_of_instructor_id": instructor_id},
            {"_id": 0, "password_hash": 0},
        )
    )
    learner_ids = [l["user_id"] for l in learners]

    recent_sessions = list(
        sessions_col.find({"instructor_id": instructor_id}).sort("created_at", -1).limit(10)
    )

    latest_results = list(
        results_col.find({"trainee_id": {"$in": learner_ids}}).sort("created_at", -1).limit(50)
    )

    scores: List[float] = []
    for r in latest_results:
        analysis = r.get("analysis") or {}
        sc = analysis.get("overall")
        if isinstance(sc, (int, float)):
            scores.append(float(sc))

    avg_score = int(sum(scores) / len(scores)) if scores else 0

    strong = len([s for s in scores if s >= 70])
    needs_focus = len([s for s in scores if s < 70])

    # Alerts (optional, kept)
    trip_ids = [str(t["_id"]) for t in trips_col.find({"instructor_id": instructor_id}, {"_id": 1})]
    high_alerts = events_col.count_documents({"severity": "high", "trip_id": {"$in": trip_ids}})

    active = sessions_col.find_one(
        {"instructor_id": instructor_id, "status": "active"},
        sort=[("started_at", -1)],
    )
    active = to_jsonable(active) if active else None

    return {
        "summary": {
            "total_learners": len(learners),
            "avg_score": avg_score,
            "strong_sessions": strong,
            "needs_focus_sessions": needs_focus,
        },
        "learners": to_jsonable(learners),
        "recent_sessions": to_jsonable(recent_sessions),
        "alerts": {"high_severity_events": high_alerts},
        "join_code": current_user.get("join_code"),
        "active_session": active,
    }


@app.get("/dashboard/trainee")
def trainee_dashboard(current_user=Depends(require_role("trainee"))):
    trainee_id = current_user["user_id"]

    recent_sessions = list(
        sessions_col.find({"trainee_id": trainee_id}).sort("created_at", -1).limit(5)
    )

    recent_reports = list(
        results_col.find({"trainee_id": trainee_id}).sort("created_at", -1).limit(5)
    )

    latest = results_col.find_one({"trainee_id": trainee_id}, sort=[("created_at", -1)])
    latest = to_jsonable(latest) if latest else None

    completed = sessions_col.count_documents({"trainee_id": trainee_id, "status": "completed"})
    target = 10

    current_score = (latest.get("analysis", {}).get("overall") if latest else 0)
    badge = (latest.get("analysis", {}).get("badge") if latest else "Improving")

    linked = current_user.get("trainee_of_instructor_id")
    instructor = None
    if linked:
        instructor = users_col.find_one(
            {"role": "instructor", "instructor_id": linked},
            {"_id": 0, "password_hash": 0},
        )

    return {
        "welcome": {"name": current_user.get("name", ""), "badge": badge},
        "progress": {
            "sessions_completed": completed,
            "target_sessions": target,
            "current_score": current_score,
        },
        "recent_reports": to_jsonable(recent_reports),
        "recent_sessions": to_jsonable(recent_sessions),
        "ai_feedback": (latest.get("ai_feedback") if latest else []),
        "instructor_comments": [],
        "milestones": [],
        "link": {
            "is_linked": bool(linked),
            "instructor": to_jsonable(instructor) if instructor else None,
        },
    }


# ---------------------------
# SETTINGS
# ---------------------------

@app.get("/settings/me")
def get_settings(current_user=Depends(get_current_user)):
    s = settings_col.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    return s or {"user_id": current_user["user_id"], "profile": {}, "notifications": {}, "preferences": {}}


@app.patch("/settings/me")
def update_settings(body: SettingsUpdate, current_user=Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    settings_col.update_one({"user_id": current_user["user_id"]}, {"$set": update}, upsert=True)
    return {"status": "ok"}


# ---------------------------
# TRIPS (kept for now)
# ---------------------------

@app.post("/trips")
def create_trip(body: TripCreate, current_user=Depends(require_role("instructor"))):
    trainee = users_col.find_one({"user_id": body.trainee_id, "role": "trainee"})
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")
    if trainee.get("trainee_of_instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Trainee not linked to this instructor")

    doc = {
        "instructor_id": current_user["instructor_id"],
        "trainee_id": body.trainee_id,
        "road_type": body.road_type,
        "notes": body.notes,
        "expected_label": body.expected_label,
        "created_at": now_utc(),
        "status": "created",
        "dataset_folder": None,
    }
    res = trips_col.insert_one(doc)
    return {"trip_id": str(res.inserted_id)}


@app.get("/trips")
def list_trips(current_user=Depends(get_current_user)):
    if current_user["role"] == "instructor":
        cur = trips_col.find({"instructor_id": current_user["instructor_id"]}).sort("created_at", -1)
    else:
        cur = trips_col.find({"trainee_id": current_user["user_id"]}).sort("created_at", -1)
    return to_jsonable(list(cur))


@app.get("/trips/{trip_id}")
def get_trip(trip_id: str, current_user=Depends(get_current_user)):
    t = trips_col.find_one({"_id": oid(trip_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found")

    if current_user["role"] == "instructor":
        if t.get("instructor_id") != current_user["instructor_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        if t.get("trainee_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    return to_jsonable(t)


@app.patch("/trips/{trip_id}")
def update_trip(trip_id: str, payload: TripUpdate, current_user=Depends(require_role("instructor"))):
    t = trips_col.find_one({"_id": oid(trip_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Trip not found")
    if t.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    trips_col.update_one({"_id": oid(trip_id)}, {"$set": update})
    return {"status": "updated"}


# ---------------------------
# INGEST (kept)
# ---------------------------

@app.post("/trips/{trip_id}/ingest")
def ingest_trip(trip_id: str, req: IngestRequest, current_user=Depends(require_role("instructor"))):
    trip = trips_col.find_one({"_id": oid(trip_id)})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    files, summary, route_points, timeline = ingest_dataset(req.dataset_folder)

    files_docs = [
        {
            "trip_id": trip_id,
            "dataset_folder": req.dataset_folder,
            "name": f["name"],
            "path": f["path"],
            "exists": f["exists"],
            "created_at": now_utc(),
        }
        for f in files
    ]
    if files_docs:
        files_col.insert_many(files_docs)

    metrics_col.update_one(
        {"trip_id": trip_id},
        {
            "$set": {
                "trip_id": trip_id,
                "dataset_folder": req.dataset_folder,
                "summary": summary,
                "route_preview": route_points,
                "updated_at": now_utc(),
            }
        },
        upsert=True,
    )

    event_docs = []
    for ev in timeline:
        doc = {
            "trip_id": trip_id,
            "dataset_folder": req.dataset_folder,
            "t": ev.get("t"),
            "kind": ev.get("kind"),
            "meta": ev.get("meta", {}),
            "created_at": now_utc(),
            "instructor_id": trip.get("instructor_id"),
            "trainee_id": trip.get("trainee_id"),
            "severity": ev.get("severity") or ev.get("meta", {}).get("severity") or "low",
        }
        event_docs.append(doc)

    if event_docs:
        events_col.insert_many(event_docs)

    trips_col.update_one(
        {"_id": oid(trip_id)},
        {"$set": {"status": "ingested", "dataset_folder": req.dataset_folder}},
    )

    return {
        "trip_id": trip_id,
        "dataset_folder": req.dataset_folder,
        "files_registered": len(files_docs),
        "route_points_saved": len(route_points),
        "events_inserted": len(event_docs),
        "summary": summary,
    }


# ---------------------------
# Dataset picking (simulation)
# ---------------------------

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


def _load_csv_any(dataset_ref: str | None, road_type: str) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    dataset_ref can be:
      - None -> auto pick random CSV
      - folder name under datasets -> pick random csv inside
      - "something.csv" -> resolve under datasets root (if exists)
      - absolute path -> load directly
    Returns: (df, used_info_dict)
    """
    root = _resolve_datasets_root()

    if not dataset_ref:
        chosen = _pick_csv_for_simulation(road_type)
        used = {
            "csv": chosen.name,
            "rel_path": str(chosen.relative_to(root)) if chosen.is_relative_to(root) else str(chosen),
        }
        return pd.read_csv(chosen), used

    ref = dataset_ref.strip()
    p = Path(ref)

    # absolute CSV
    if p.is_absolute() and p.exists() and p.suffix.lower() == ".csv":
        used = {"csv": p.name, "rel_path": str(p)}
        return pd.read_csv(p), used

    # CSV filename -> search under datasets
    if ref.lower().endswith(".csv"):
        candidates = [c for c in _list_all_csvs() if c.name.lower() == Path(ref).name.lower()]
        if not candidates:
            direct = (root / ref).resolve()
            if direct.exists() and direct.suffix.lower() == ".csv":
                used = {"csv": direct.name, "rel_path": str(direct.relative_to(root))}
                return pd.read_csv(direct), used
            raise HTTPException(status_code=400, detail=f"Dataset CSV not found under datasets: {ref}")

        chosen = random.choice(candidates)
        used = {"csv": chosen.name, "rel_path": str(chosen.relative_to(root))}
        return pd.read_csv(chosen), used

    # folder under datasets root
    folder = (root / ref).resolve()
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=400, detail=f"Dataset folder not found: {folder}")

    csv_files = [x for x in folder.glob("*.csv") if x.is_file()]
    if not csv_files:
        # allow one-level deeper
        csv_files = [x for x in folder.rglob("*.csv") if x.is_file()]
    if not csv_files:
        raise HTTPException(status_code=400, detail=f"No CSV files found in: {folder}")

    chosen = random.choice(csv_files)
    used = {
        "csv": chosen.name,
        "rel_path": str(chosen.relative_to(root)) if chosen.is_relative_to(root) else str(chosen),
    }
    return pd.read_csv(chosen), used


# ---------------------------
# ML endpoint (dev)
# ---------------------------

@app.post("/ml/predict")
def ml_predict(req: MLPredictRequest, current_user=Depends(get_current_user)):
    df, used = _load_csv_any(req.dataset_folder, req.road_type)
    pred = predict_from_dataframe(df, req.road_type)
    return {"status": "ok", "dataset_used": used, "prediction": pred}


# ---------------------------
# PREDICT (Trip) — ML ONLY
# ---------------------------

@app.post("/trips/{trip_id}/predict")
def predict_trip(trip_id: str, current_user=Depends(get_current_user)):
    trip = trips_col.find_one({"_id": oid(trip_id)})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if current_user["role"] == "instructor":
        if trip.get("instructor_id") != current_user["instructor_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        if trip.get("trainee_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    dataset_folder = trip.get("dataset_folder")
    if not dataset_folder:
        raise HTTPException(status_code=400, detail="Trip has no dataset_folder. Ingest first.")

    road_type = trip.get("road_type", "secondary")
    df, used = _load_csv_any(dataset_folder, road_type)
    ml_out = predict_from_dataframe(df, road_type)

    analysis_summary = {
        "behavior": ml_out.get("label", "Unknown"),
        "confidence": float(ml_out.get("confidence", 0.0)),
        "overall": int(ml_out.get("overall", 0)),
        "badge": ml_out.get("badge", "Improving"),
        "probs": ml_out.get("probs", {}),
    }

    ai_feedback = [
        {
            "priority": "high" if analysis_summary["behavior"] != "Normal" else "medium",
            "title": "Session analysis",
            "message": f"{analysis_summary['behavior']} (confidence {round(analysis_summary['confidence'] * 100)}%)",
            "icon": "🤖",
        }
    ]

    result = {
        "trip_id": trip_id,
        "session_id": None,
        "trainee_id": trip.get("trainee_id"),
        "instructor_id": trip.get("instructor_id"),
        "created_at": now_utc(),
        "method": "ml_v1",
        "dataset_used": used,
        "analysis": analysis_summary,
        "ai_feedback": ai_feedback,
    }

    ins = results_col.insert_one(result)
    result["_id"] = ins.inserted_id
    return to_jsonable(result)


@app.get("/trips/{trip_id}/results/latest")
def latest_result(trip_id: str, current_user=Depends(get_current_user)):
    r = results_col.find_one({"trip_id": trip_id}, sort=[("created_at", -1)])
    if not r:
        raise HTTPException(status_code=404, detail="No results yet. Predict first.")
    return to_jsonable(r)


# ---------------------------
# RECORDS (needed by UI)
# ---------------------------

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


# ---------------------------
# SESSIONS (SIMULATION, ML ONLY)
# ---------------------------

@app.post("/sessions")
def create_session(body: SessionCreate, current_user=Depends(require_role("instructor"))):
    trainee = users_col.find_one({"user_id": body.trainee_id, "role": "trainee"})
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")
    if trainee.get("trainee_of_instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Trainee not linked to this instructor")

    doc = {
        "session_id": uuid.uuid4().hex,
        "instructor_id": current_user["instructor_id"],
        "trainee_id": body.trainee_id,
        "vehicle_id": body.vehicle_id,
        "scheduled_at": body.scheduled_at,
        "duration_min": body.duration_min,
        "status": "scheduled",  # scheduled | active | completed | cancelled
        "notes": body.notes,
        "road_type": body.road_type,   # stored, internal
        "dataset_used": None,          # backend fills after ending
        "created_at": now_utc(),
        "started_at": None,
        "ended_at": None,
        "instructor_notes": "",
    }
    sessions_col.insert_one(doc)
    return {"session_id": doc["session_id"]}


@app.get("/sessions")
def list_sessions(current_user=Depends(get_current_user)):
    if current_user["role"] == "instructor":
        cur = sessions_col.find({"instructor_id": current_user["instructor_id"]}).sort("created_at", -1)
    else:
        cur = sessions_col.find({"trainee_id": current_user["user_id"]}).sort("created_at", -1)
    return to_jsonable(list(cur))


@app.get("/sessions/active")
def get_active_session(current_user=Depends(require_role("instructor"))):
    s = sessions_col.find_one(
        {"instructor_id": current_user["instructor_id"], "status": "active"},
        sort=[("started_at", -1)],
    )
    return {"active": to_jsonable(s) if s else None}


@app.post("/sessions/{session_id}/start")
def start_session(session_id: str, body: SessionStartRequest, current_user=Depends(require_role("instructor"))):
    session = sessions_col.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("instructor_id") != current_user["instructor_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    if session.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")

    # ensure only one active session per instructor
    sessions_col.update_many(
        {"instructor_id": current_user["instructor_id"], "status": "active"},
        {"$set": {"status": "scheduled"}},
    )
    # ------------------------------------------------
    # PICK DATASET ONCE WHEN SESSION STARTS
    # ------------------------------------------------
    road_type = (session.get("road_type") or "secondary").strip().lower()
    chosen = _pick_csv_for_simulation(road_type)

    root = _resolve_datasets_root()

    used = {
        "csv": chosen.name,
        "rel_path": str(chosen.relative_to(root)) if chosen.is_relative_to(root) else str(chosen),
    }   

    sessions_col.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": "active",
                "started_at": now_utc(),
                "ended_at": None,
                "dataset_used": used
            }
        }
    )
        
    return {"status": "ok", "session_id": session_id}


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

    # Load the exact same CSV used at start
    root = _resolve_datasets_root()
    csv_path = (root / dataset_used["rel_path"]).resolve()

    if not csv_path.exists():
        raise HTTPException(status_code=500, detail="Stored dataset file not found")

    df = pd.read_csv(csv_path)
    used = dataset_used
    

    # ML only (no heuristics)
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

    ai_feedback = [
        {
            "priority": "high" if analysis_summary["behavior"] != "Normal" else "medium",
            "title": "Session analysis",
            "message": f"{analysis_summary['behavior']} (confidence {round(analysis_summary['confidence'] * 100)}%)",
            "icon": "🤖",
        }
    ]

    result_doc = {
        "trip_id": None,
        "session_id": session_id,
        "trainee_id": session.get("trainee_id"),
        "instructor_id": session.get("instructor_id"),
        "created_at": now_utc(),
        "method": "ml_v1",
        "dataset_used": used,        # stored (internal)
        "analysis": analysis_summary, # what the app should show
        "ai_feedback": ai_feedback,
    }

    ins = results_col.insert_one(result_doc)

    sessions_col.update_one(
        {"session_id": session_id},
        {"$set": {"status": "completed", "ended_at": now_utc(), "dataset_used": used}},
    )

    # response: NO “prediction” wording, no road_type/dataset in the UI response
    return {
        "status": "ok",
        "session_id": session_id,
        "analysis": to_jsonable(analysis_summary),
        "ai_feedback": to_jsonable(ai_feedback),
        "result_id": str(ins.inserted_id),
    }


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
        "behavior": "Unknown",
        "confidence": 0.0,
        "overall": 0,
        "badge": "Improving",
        "probs": {},
    }

    return {
        "session": to_jsonable(session),
        "analysis": analysis,
        "ai_feedback": (res.get("ai_feedback") if res else []),
        "instructor_notes": session.get("instructor_notes", ""),
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


# ---------------------------
# INSTRUCTOR HELPERS
# ---------------------------

@app.get("/instructor/learners")
def instructor_learners(current_user=Depends(require_role("instructor"))):
    instructor_id = current_user["instructor_id"]

    learners = list(
        users_col.find(
            {"role": "trainee", "trainee_of_instructor_id": instructor_id},
            {"_id": 0, "password_hash": 0},
        ).sort("created_at", -1)
    )
    return to_jsonable(learners)
