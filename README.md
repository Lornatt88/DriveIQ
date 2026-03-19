# DriveIQ

A full-stack driving behavior analysis platform with ML-powered classification, anomaly detection, and personalized recommendations.

## Project Overview

DriveIQ is a capstone project that combines a **React Native mobile app**, a **FastAPI backend**, and a **4-phase ML pipeline** to analyze driving behavior in real time. The system ingests raw multi-sensor driving data, classifies each driving segment as Normal, Aggressive, or Drowsy, computes risk-based performance scores with detailed alerts, and generates personalized feedback through fuzzy logic.

Two user roles drive the platform: **students** (learner drivers) book sessions with instructors, complete driving lessons, and receive ML-analyzed session reports; **instructors** manage their availability, run sessions, and review learner progress with AI-generated insights.

## Architecture

```
┌──────────────────────────────────────────────┐
│       Mobile App (Expo / React Native)       │
│  File-based routing  ·  Role-based tabs      │
│  Student dashboard   ·  Instructor dashboard │
└──────────────────┬───────────────────────────┘
                   │ REST API (JSON + JWT)
                   v
┌──────────────────────────────────────────────┐
│          Backend (FastAPI + Python)           │
│  8 routers  ·  JWT auth  ·  Role permissions │
│  ML integration via run_full_knn_pipeline()  │
└──────┬───────────────────────────┬───────────┘
       │                           │
       v                           v
┌─────────────────┐   ┌───────────────────────┐
│  MongoDB Atlas   │   │     ML Pipeline       │
│  9 collections   │   │  TensorFlow + sklearn │
│  PyMongo driver  │   │  4 sequential phases  │
└─────────────────┘   └───────────────────────┘
```

- **Frontend** — Expo 54 / React Native 0.81 / TypeScript. File-based routing via expo-router with two role-specific tab groups (`(studenttabs)/` and `(instructortabs)/`). JWT stored in AsyncStorage.
- **Backend** — FastAPI with 8 routers handling auth, instructors, bookings, sessions, ML pipeline, dashboards, reviews, and profiles. JWT authentication via python-jose with bcrypt password hashing. Sync PyMongo for MongoDB access.
- **ML Pipeline** — 4-phase sequential pipeline in `ml-model/src/`. Called from `routers/session_router.py` via `run_full_knn_pipeline()`. Pre-trained LSTM and KNN models loaded from `ml-model/models/`.
- **Database** — MongoDB Atlas with 9 collections for users, sessions, ML results, bookings, reviews, and configuration.

## ML Pipeline

The ML pipeline is the core technical component. It transforms raw multi-sensor driving data into actionable insights through four sequential phases.

```
Raw Sensor Data (GPS 1Hz, Accelerometer 10Hz, Lane ~30Hz, Vehicle ~10Hz, OSM ~1Hz)
                                     │
                 ┌───────────────────v───────────────────┐
                 │  Phase 1: Preprocessing & Features    │
                 │  Resample to 10Hz · KNN imputation    │
                 │  39 engineered features               │
                 └───────────────────┬───────────────────┘
                                     │
                 ┌───────────────────v───────────────────┐
                 │  Phase 2: LSTM Classification         │
                 │  4-min windows (2400 steps @ 10Hz)    │
                 │  Road-specific models (motor/secondary)│
                 │  3 classes: Normal · Aggressive · Drowsy│
                 └───────────────────┬───────────────────┘
                                     │
                 ┌───────────────────v───────────────────┐
                 │  Phase 3: KNN Scoring & Alerts        │
                 │  Anomaly detection per window         │
                 │  4 alert types with severity scoring  │
                 │  Session risk score (0-100)           │
                 └───────────────────┬───────────────────┘
                                     │
                 ┌───────────────────v───────────────────┐
                 │  Phase 4: Fuzzy Logic Recommendations │
                 │  Linguistic variables · Rule inference │
                 │  Personalized driving feedback        │
                 └──────────────────────────────────────┘
```

### Phase 1 — Data Preprocessing & Feature Engineering

**Source:** `ml-model/src/preprocessing_inference.py`

**Input:** Raw sensor JSON containing five data streams at different sampling frequencies:

| Sensor | Frequency | Key Columns |
|--------|-----------|-------------|
| GPS | 1 Hz | speed_kmh, lat, lon, alt, course, difcourse, hdop, vdop, pdop |
| Accelerometer | 10 Hz | acc_x, acc_y, acc_z, acc_x_kf, acc_y_kf, acc_z_kf, roll, pitch, yaw |
| Lane Detection | ~30 Hz | x_lane, phi, road_width, lane_state |
| Vehicle Detection | ~10 Hz | dist_front, ttc_front, num_vehicles, gps_speed |
| OpenStreetMap | ~1 Hz | max_speed, speed_rel, road_type_osm, num_lanes, lane_id |

**Processing steps:**

1. **Temporal synchronization** — Build a unified 10Hz timebase from the maximum timestamp across all streams
2. **Resampling** — Align all sensors to 10Hz using `pd.merge_asof` (backward fill for GPS, nearest for others)
3. **Feature engineering** — Compute derived features such as `speed_ratio = speed_kmh / max_speed`
4. **Missing value imputation** — KNN imputation with 5 neighbors, distance-weighted (`sklearn.impute.KNNImputer`)
5. **Feature ordering** — Enforce strict 39-feature ordering from `feature_schema.json`

**Output:** Clean, synchronized DataFrame at 10Hz with 39 features per timestep.

### Phase 2 — Driving Behavior Classification (LSTM)

**Source:** `ml-model/src/preprocessing_inference.py` (classification section), `backend/app/ml/predictor.py`

Two road-type-specific LSTM models classify each driving window:

| Parameter | Value |
|-----------|-------|
| Models | `motor_model.keras` (motorway), `secondary_model.keras` (secondary roads) |
| Model size | ~3.9 MB each |
| Window size | 2400 timesteps at 10Hz = **4 minutes** |
| Stride (motorway) | 240 timesteps (non-overlapping) |
| Stride (secondary) | 260 timesteps |
| Scaling | Road-specific scalers (`motor_scaler.pkl`, `secondary_scaler.pkl`) |

**Output:** Per-window probability distribution across three classes:

| Class | Label |
|-------|-------|
| 0 | Aggressive |
| 1 | Normal |
| 2 | Drowsy |

Session-level behavior is determined by averaging probabilities across all windows. The overall performance score maps the dominant class and its confidence:

- **Normal** → score 80–100 (higher confidence = higher score)
- **Aggressive** → score 35–50
- **Drowsy** → score 20–40

Badges are assigned based on the overall score: **Excellent** (>= 85), **Improving** (>= 70), **Needs Focus** (< 70).

### Phase 3 — Performance Scoring & Alerts (KNN)

**Source:** `ml-model/src/knn_alerts_inference.py`

While Phase 2 classifies behavior, Phase 3 evaluates overall driving performance using KNN-based anomaly detection.

**Anomaly detection:** For each 4-minute window, aggregate features are computed (mean across timesteps) and scaled. The KNN model measures the mean distance to its nearest neighbors. If this distance exceeds the road-type threshold, the window is flagged as abnormal:

| Road Type | KNN Model | Threshold |
|-----------|-----------|-----------|
| Motorway | `motor_knn_model.pkl` | 3.131 |
| Secondary | `secondary_knn_model.pkl` | 3.319 |

**Alert cause determination:** When a window is flagged abnormal, the system identifies the primary cause by scoring four categories:

| Alert Cause | Scoring Formula |
|-------------|----------------|
| Harsh Driving | \|vert_acc_mean\| + \|horiz_acc_mean\| |
| Overspeeding | speed_kmh_mean + speed_ratio_mean |
| Unstable Steering | \|difcourse_mean\| + \|horiz_acc_mean\| + \|course_mean\| |
| Tailgating | Triggered when ttc_front_mean < 2 seconds |

The cause with the highest score is selected. Severity is normalized to a 0–100 scale using per-session min-max normalization.

**Session-level risk score:**

```
session_risk_score = (total_alerts / total_windows) × 50 + (avg_severity / 100) × 50
performance_score  = 100 - session_risk_score
```

- 50% weight on **alert prevalence** (how often alerts occur)
- 50% weight on **severity magnitude** (how severe the alerts are)

**Per-window output:**
```json
{
  "window_id": 0,
  "predicted_label": "Normal",
  "alert": "Abnormal",
  "alert_cause": "Overspeeding",
  "severity": 72.5,
  "knn_distance": 4.12,
  "trigger_features": [
    { "feature": "Speed (km/h)", "value": 142.3, "unit": "km/h" },
    { "feature": "Speed Ratio", "value": 1.18, "unit": "ratio" }
  ]
}
```

### Phase 4 — Fuzzy Logic Recommendations

**Source:** `ml-model/notebooks/04_knn_alerts_performance_feedback_V2.ipynb`

This phase converts numerical performance indicators into clear, human-readable driving recommendations using fuzzy logic:

- **Linguistic variables** define gradual categories: low / medium / high risk, poor / average / good performance
- A **rule-based fuzzy inference system** maps combinations of risk level and performance to specific feedback
- **Output:** Personalized, actionable recommendations displayed in the mobile app's session report

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | Expo 54 / React Native 0.81 / TypeScript |
| Navigation | expo-router 6.0 (file-based routing) |
| State / Storage | AsyncStorage |
| Backend Framework | FastAPI (Python) |
| Database | MongoDB Atlas (PyMongo) |
| Authentication | JWT (python-jose) + bcrypt (passlib) |
| ML Classification | TensorFlow / Keras (LSTM) |
| ML Anomaly Detection | scikit-learn (KNN) |
| Data Processing | pandas, NumPy |
| Imputation | sklearn KNNImputer |

## Project Structure

```
DriveIQ/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point, CORS, router registration
│   │   ├── config.py                # Environment config (MongoDB, JWT, CORS)
│   │   ├── database.py              # PyMongo collections & index creation
│   │   ├── auth.py                  # JWT token creation & validation
│   │   ├── models.py                # Pydantic request/response schemas
│   │   ├── permissions.py           # Role-based access control
│   │   └── ml/
│   │       ├── predictor.py         # Session-level ML prediction wrapper
│   │       ├── keras_runtime.py     # Model & scaler loading (cached)
│   │       └── feature_builder.py   # Windowing logic for inference
│   ├── routers/
│   │   ├── auth.py                  # Register, login, change password
│   │   ├── instructors.py           # Browse instructors, manage availability
│   │   ├── bookings.py              # Book & cancel lesson slots
│   │   ├── sessions.py              # Session lifecycle, reports, timeline
│   │   ├── session_router.py        # ML pipeline endpoint (upload & process)
│   │   ├── dashboard.py             # Trainee & instructor dashboard data
│   │   ├── reviews.py               # Instructor reviews
│   │   └── profile.py               # User profile & settings
│   ├── scripts/
│   │   └── seed_demo_data.py        # Demo data seeder
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── index.tsx                # Login screen
│   │   ├── signup.tsx               # Registration
│   │   ├── consent.tsx              # Data privacy consent
│   │   ├── (studenttabs)/
│   │   │   ├── dashboard.tsx        # Student dashboard (KPIs, bookings, reports)
│   │   │   ├── sessions.tsx         # Browse & book instructors
│   │   │   ├── reports.tsx          # Session reports list
│   │   │   ├── session-report.tsx   # Detailed ML report with timeline
│   │   │   ├── profile.tsx          # Student profile
│   │   │   └── settings.tsx         # App settings
│   │   ├── (instructortabs)/
│   │   │   ├── dashboard.tsx        # Instructor dashboard (learners, metrics)
│   │   │   ├── sessions.tsx         # Manage active sessions
│   │   │   ├── records.tsx          # Learner performance records
│   │   │   └── settings.tsx         # Instructor settings
│   │   └── student/[id].tsx         # Student detail (instructor view)
│   ├── components/                  # Reusable UI (ScoreRing, BehaviorBar, MetricCard, etc.)
│   ├── lib/
│   │   ├── api.ts                   # Fetch wrapper with JWT auto-injection
│   │   ├── config.ts                # API base URL
│   │   ├── token.ts                 # AsyncStorage token management
│   │   └── theme.ts                 # Design tokens (colors, spacing, fonts)
│   └── package.json
│
├── ml-model/
│   ├── src/
│   │   ├── preprocessing_inference.py   # Phase 1 & 2 (preprocess + classify)
│   │   └── knn_alerts_inference.py      # Phase 3 & 4 (KNN alerts + recommendations)
│   ├── models/                          # Trained model artifacts (see below)
│   ├── notebooks/
│   │   ├── 01_preprocessing_10hz.ipynb          # Phase 1 exploration
│   │   ├── 02_classification_final.ipynb        # Phase 2 LSTM training
│   │   ├── 03_knn_alerts_performance_V1.ipynb   # Phase 3 baseline
│   │   └── 04_knn_alerts_performance_feedback_V2.ipynb  # Phase 3+4 final
│   └── README.md                        # ML pipeline documentation
│
├── start-dev.sh                # Start backend + frontend together
├── CLAUDE.md                   # AI assistant guidance
└── README.md                   # This file
```

## Features

### Student

- Register and log in with JWT authentication
- Dashboard with KPIs: total sessions, average performance score, behavior breakdown, safety badge
- Browse instructors by specialty, location, and rating
- Book available time slots for driving lessons
- View upcoming sessions with countdown timers
- Detailed session reports with per-window behavior timeline, alert causes, severity scores, and trigger features
- AI-generated driving feedback and recommendations
- Track achievements and progress milestones
- Profile management, settings, and password change

### Instructor

- Register with institute code verification
- Dashboard: total learners, sessions conducted, average performance across students
- Manage availability by publishing and removing time slots
- Start and end driving sessions linked to confirmed bookings
- Automatically run ML pipeline when ending a session
- View detailed ML analysis reports for each learner session
- Add instructor notes to session reports
- Manage profile: bio, specialties, pricing, vehicle, languages, location
- View learner sidebar with status indicators (Active / Scheduled / Learner)

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | No | Register student or instructor |
| `POST` | `/auth/login` | No | Login, returns JWT token |
| `GET` | `/auth/me` | Yes | Current user profile |
| `POST` | `/auth/change-password` | Yes | Change password |
| `GET` | `/instructors` | Yes | Browse instructors (filterable) |
| `GET` | `/instructors/:id` | Yes | Instructor profile + reviews |
| `GET` | `/instructors/:id/availability` | Yes | Available time slots |
| `POST` | `/availability` | Instructor | Publish time slots |
| `GET` | `/availability/me` | Instructor | Own slots |
| `DELETE` | `/availability/:slot_id` | Instructor | Remove open slot |
| `POST` | `/bookings` | Student | Book a time slot |
| `GET` | `/bookings/me` | Yes | User's bookings |
| `DELETE` | `/bookings/:id` | Yes | Cancel booking |
| `GET` | `/sessions` | Yes | List sessions (role-aware) |
| `POST` | `/sessions/:booking_id/start` | Instructor | Start session from booking |
| `POST` | `/sessions/:id/end` | Instructor | End session and run ML inference |
| `GET` | `/sessions/:id/report` | Yes | Session report with ML analysis |
| `GET` | `/sessions/:id/timeline` | Yes | Per-window timeline with timestamps |
| `GET` | `/sessions/my-reports` | Student | Completed sessions with summaries |
| `POST` | `/api/sessions/upload-and-process` | — | Upload sensor JSON, run full ML pipeline |
| `GET` | `/api/sessions/results/:id` | — | Full ML results for a session |
| `GET` | `/dashboard/trainee` | Student | Trainee dashboard data |
| `GET` | `/dashboard/instructor` | Instructor | Instructor dashboard data |
| `POST` | `/reviews` | Student | Leave instructor review |
| `GET` | `/reviews/:instructor_id` | Yes | Instructor's reviews |
| `GET` | `/settings/me` | Yes | User settings |
| `PATCH` | `/settings/me` | Yes | Update settings |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB instance)
- Trained ML model artifacts in `ml-model/models/` (see [Model Artifacts](#model-artifacts))

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net
MONGO_DB=driver_behavior
JWT_SECRET=your_secret_key
```

Start the server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npx expo start
```

Configure the API base URL in `frontend/lib/config.ts` to point to your backend (defaults to `localhost:8000`).

### Quick Start

Start both services together:

```bash
bash start-dev.sh
```

This installs dependencies, launches the FastAPI backend on port 8000, and starts the Expo dev server.

## Database Schema

| Collection | Purpose |
|-----------|---------|
| `users` | User accounts — email, hashed password, role (student/instructor) |
| `instructor_profiles` | Instructor details — bio, specialties, rating, pricing, location |
| `availability` | Time slots published by instructors |
| `bookings` | Confirmed/cancelled lesson reservations |
| `sessions` | Driving session lifecycle, status, and ML summary |
| `results` | Full ML output — per-window alerts, severity, trigger features |
| `reviews` | Student reviews and ratings for instructors |
| `institute_codes` | One-time registration codes for instructors |
| `settings` | User preferences and notification settings |

## Model Artifacts

Located in `ml-model/models/`. These are required for inference and must be generated by running the training notebooks in `ml-model/notebooks/`.

| File | Size | Purpose |
|------|------|---------|
| `motor_model.keras` | 3.9 MB | LSTM classifier for motorway driving |
| `secondary_model.keras` | 3.9 MB | LSTM classifier for secondary road driving |
| `motor_scaler.pkl` | 1.5 KB | Feature scaler for motorway LSTM |
| `secondary_scaler.pkl` | 1.5 KB | Feature scaler for secondary road LSTM |
| `motor_knn_model.pkl` | 53 KB | KNN anomaly detector for motorway |
| `secondary_knn_model.pkl` | 35 KB | KNN anomaly detector for secondary roads |
| `motor_knn_scaler.pkl` | 2.3 KB | Feature scaler for motorway KNN |
| `secondary_knn_scaler.pkl` | 2.3 KB | Feature scaler for secondary road KNN |
| `feature_schema.json` | — | 39-feature ordering specification |
| `knn_feature_cols.json` | — | KNN feature column names |
| `knn_thresholds.json` | — | Anomaly distance thresholds per road type |
