# DriveIQ Seed Data Reference
## Per-Session Booking Model (v2)

---

## ARCHITECTURE OVERVIEW

```
Student browses instructors → picks a time slot → instant booking
                                                        │
                                    ┌───────────────────┘
                                    ▼
                              BOOKING created
                              (links student + instructor + slot)
                                    │
                                    ▼ instructor starts session
                              SESSION created
                              (from booking, ML runs on end)
                                    │
                                    ▼ session ends
                              RESULT created
                              (ML analysis, feedback, scores)
                                    │
                                    ▼ student optionally leaves
                              REVIEW created
                              (updates instructor rating)
```

**Key principle:** There is NO permanent student-instructor link.
The link only exists per booking/session.

---

## COLLECTIONS & RELATIONSHIPS

```
┌──────────────┐     ┌─────────────────────┐
│    users     │     │ instructor_profiles  │
│  (auth/login)│───▶│  (public profile)    │
│              │     │                     │
│ user_id ◄────┼─────┼── user_id           │
│ instructor_id│◄────┼── instructor_id      │
└──────┬───────┘     └──────────┬──────────┘
       │                        │
       │    ┌───────────────────┘
       │    │
       ▼    ▼
┌──────────────────┐    ┌──────────────┐
│   availability    │    │   reviews     │
│  (time slots)     │    │ (ratings)     │
│                  │    │              │
│ instructor_id ───┼────┤ instructor_id│
│ slot_id          │    │ trainee_id   │
│ status: open/    │    │ session_id   │
│   booked/expired │    │ rating (1-5) │
└────────┬─────────┘    └──────────────┘
         │                      ▲
         │ student picks slot   │ after session
         ▼                      │
┌──────────────────┐           │
│    bookings       │           │
│                  │           │
│ booking_id       │           │
│ trainee_id ──────┼── links to student
│ instructor_id ───┼── links to instructor
│ slot_id ─────────┼── links to availability slot
│ session_id ──────┼── set when session starts
│ status: confirmed│           │
│   /completed/    │           │
│   cancelled      │           │
└────────┬─────────┘           │
         │ instructor starts   │
         ▼                     │
┌──────────────────┐           │
│    sessions       │           │
│                  │           │
│ session_id       │           │
│ booking_id ──────┼── back-link to booking
│ instructor_id    │           │
│ instructor_name  │           │
│ trainee_id       │           │
│ status: active/  │           │
│   completed      │           │
│ dataset_used     │           │
└────────┬─────────┘           │
         │ ML runs on end      │
         ▼                     │
┌──────────────────┐           │
│    results        │           │
│                  │           │
│ session_id ──────┼── links to session
│ booking_id       │           │
│ trainee_id       │           │
│ instructor_id    │           │
│ instructor_name  │           │
│ analysis: {      │           │
│   behavior,      │           │
│   overall (score)│           │
│   badge,         │           │
│   confidence,    │           │
│   probs          │           │
│ }                │           │
│ ai_feedback[]    │           │
│ windows[]        │           │
│ instructor_      │           │
│   comment        │           │
└──────────────────┘           │
                               │
┌──────────────────┐           │
│    settings       │           │
│                  │           │
│ user_id          │           │
│ achievements[]   │           │
│ profile{}        │           │
│ notifications{}  │           │
│ preferences{}    │           │
└──────────────────┘

┌──────────────────┐
│ institute_codes   │
│                  │
│ code (unique)    │
│ used: true/false │
│ used_by: user_id │
└──────────────────┘
```

---

## SEEDED USERS

### Instructors (6)
All passwords: demo1234

| Name                 | Email                          | Location                    | Price  | Rating |
|----------------------|--------------------------------|-----------------------------|--------|--------|
| Dr. Sarah Mitchell   | sarah.mitchell@driveiq.demo    | Dubai Marina                | 45 AED | 4.2/5  |
| Prof. James Carter   | james.carter@driveiq.demo      | JBR / JLT                  | 55 AED | 4.0/5  |
| Ms. Fatima Al-Rashid | fatima.rashid@driveiq.demo     | Al Barsha                   | 40 AED | 4.5/5  |
| Mr. David Thompson   | david.thompson@driveiq.demo    | Deira / Bur Dubai           | 50 AED | 4.6/5  |
| Dr. Priya Sharma     | priya.sharma@driveiq.demo      | Business Bay                | 48 AED | 4.2/5  |
| Mr. Omar Hassan      | omar.hassan@driveiq.demo       | Academic City / Silicon Oasis| 35 AED | 4.5/5  |

### Trainees (2)
All passwords: demo1234

| Name          | Email                  | Sessions | Latest Score |
|---------------|------------------------|----------|-------------|
| Ziyan Hashim  | ziyan@driveiq.demo     | 8        | 91          |
| Ahmad Khan    | ahmad@driveiq.demo     | 2        | 65          |

---

## ZIYAN'S SESSION HISTORY (8 completed + 1 upcoming)

Each session has: booking → session → result (with ML analysis)

| # | Days Ago | Road      | Instructor           | Behavior   | Score | Badge      |
|---|----------|-----------|----------------------|------------|-------|------------|
| 1 | 21       | secondary | Dr. Sarah Mitchell   | Aggressive | 52    | Improving  |
| 2 | 18       | motor     | Dr. Sarah Mitchell   | Normal     | 71    | Improving  |
| 3 | 15       | secondary | Prof. James Carter   | Drowsy     | 45    | Improving  |
| 4 | 12       | motor     | Dr. Sarah Mitchell   | Normal     | 76    | Good       |
| 5 | 9        | secondary | Ms. Fatima Al-Rashid | Normal     | 80    | Good       |
| 6 | 6        | motor     | Mr. David Thompson   | Normal     | 83    | Good       |
| 7 | 3        | secondary | Dr. Sarah Mitchell   | Normal     | 87    | Great      |
| 8 | 1        | motor     | Mr. David Thompson   | Normal     | 91    | Excellent  |

**Upcoming:** Booked with Dr. Sarah Mitchell, 3 days from now at 2:00 PM

**Story arc:** Ziyan started rough (aggressive/drowsy), improved steadily across
different instructors, and is now scoring 91 with "Excellent" badge.

---

## WHAT EACH RESULT CONTAINS

Every result doc (linked to a session) includes:

```
result = {
  session_id:       "abc123",
  booking_id:       "def456",
  trainee_id:       "<ziyan's user_id>",
  instructor_id:    "<instructor's instructor_id>",
  instructor_name:  "Dr. Sarah Mitchell",
  created_at:       "2026-02-27T...",
  method:           "ml_v1",

  analysis: {
    behavior:     "Normal",           // Normal | Aggressive | Drowsy
    confidence:   0.95,               // 0.0 - 1.0
    overall:      91,                 // 0 - 100 (the "score")
    badge:        "Excellent",        // Improving | Good | Great | Excellent
    probs: {
      Normal:     0.95,
      Aggressive: 0.03,
      Drowsy:     0.02
    }
  },

  ai_feedback: [
    {
      priority: "low",
      title:    "Smooth Driving",
      message:  "Good overall driving pattern...",
      icon:     "✅",
      area:     "Overall",
      score:    85
    },
    // ... 2-3 feedback items per result
  ],

  windows: [                          // 30 anomaly windows per session
    {
      window_index: 0,
      start_min:    0,
      end_min:      4,
      is_anomaly:   false,
      anomaly_score: 0.12,
      top_feature:  null
    },
    {
      window_index: 5,
      start_min:    20,
      end_min:      24,
      is_anomaly:   true,
      anomaly_score: 0.78,
      top_feature:  "lane_offset"     // what caused it
    },
    // ...
  ],

  instructor_comment: {
    text:   "Outstanding improvement! You're ready for more complex routes.",
    rating: 4,
    date:   "2026-02-27T..."
  }
}
```

---

## AI FEEDBACK TEMPLATES

### For Aggressive sessions:
- 🛑 "Harsh Braking Detected" — Multiple hard braking events
- ⚡ "Aggressive Acceleration" — Rapid acceleration patterns
- 🛣️ "Lane Discipline" — Minor lane deviations

### For Drowsy sessions:
- 😴 "Drowsiness Indicators" — Patterns consistent with drowsy driving
- ↔️ "Lane Drift Detected" — Gradual lane drifting
- ⏱️ "Reaction Time" — Slower response patterns

### For Normal sessions:
- ✅ "Smooth Driving" — Good overall driving pattern
- 🛣️ "Good Lane Discipline" — Excellent lane centering
- 🏎️ "Speed Management" — Mostly within limits

---

## INSTRUCTOR NOTES (one per session, in order)

1. "Good improvement since last session. Focus on maintaining lane position during turns."
2. "Nice work on motorway merging. Practice mirror checks more consistently."
3. "Braking has improved significantly. Work on smoother acceleration from stops."
4. "Great session overall. Remember to check blind spots when changing lanes."
5. "Solid progress! Try to reduce speed slightly when approaching roundabouts."
6. "Very smooth driving today. Keep up the consistent performance."
7. "Excellent control at higher speeds. Work on parking maneuvers next session."
8. "Outstanding improvement! You're ready for more complex routes."

---

## REVIEWS (28 total)

### From Ziyan (6 reviews):
| Instructor           | Rating | Text (truncated)                              |
|----------------------|--------|-----------------------------------------------|
| Dr. Sarah Mitchell   | 5      | "Amazing! Very patient and explains clearly..."  |
| Dr. Sarah Mitchell   | 4      | "Great instructor. Sessions feel a bit short..." |
| Prof. James Carter   | 3      | "Good knowledge but pace was fast for beginner..." |
| Ms. Fatima Al-Rashid | 5      | "Made me feel very comfortable..."               |
| Mr. David Thompson   | 5      | "Structured approach helped me pass first time!" |
| Mr. David Thompson   | 4      | "Very organized lessons..."                      |

### From fake students (3-6 per instructor):
Random reviews from: Lorna M., Seif A., Zaid K., Aisha R., Mohammed S., Sara T., Raj P., Noor H.
Ratings skewed positive (mostly 4-5 stars).
These compute each instructor's average rating.

---

## AVAILABILITY (345 slots)

Each instructor has 2-3 time slots per day across:
- Past 14 days: status = "booked" or "expired"
- Next 21 days: status = "open" (available for booking)

Slot hours: random from [8, 10, 12, 14, 16, 18]
Duration: 60 minutes each
Some days skipped (random days off)

---

## ACHIEVEMENTS (Ziyan)

| ID              | Title           | Status  |
|-----------------|-----------------|---------|
| first_session   | First Drive     | ✅ Earned |
| five_sessions   | Road Regular    | ✅ Earned |
| score_above_80  | Safe Driver     | ✅ Earned |
| score_above_90  | Expert Driver   | ✅ Earned |
| multi_instructor| Explorer        | ✅ Earned |
| ten_sessions    | Driving Veteran | 🔒 Locked |
| perfect_score   | Flawless        | 🔒 Locked |

---

## AHMAD'S DATA (minimal)

2 completed sessions, both with Ms. Fatima Al-Rashid:
- Session 1: Aggressive, Score 48 (10 days ago)
- Session 2: Normal, Score 65 (5 days ago)
- 1 achievement earned (First Drive)

---

## API ENDPOINTS → WHAT DATA THEY RETURN

| Endpoint                              | Returns                                        |
|---------------------------------------|------------------------------------------------|
| GET /instructors                      | All 6 instructor profiles with ratings         |
| GET /instructors/{id}                 | Profile + reviews for one instructor           |
| GET /instructors/{id}/availability    | Open slots (next 14 days by default)           |
| POST /bookings                        | Books a slot → returns booking_id              |
| GET /bookings/me                      | Student's bookings (upcoming + past)           |
| GET /dashboard/trainee                | Everything for dashboard (score, badge, etc.)  |
| GET /sessions                         | Student's sessions (all statuses)              |
| GET /sessions/{id}/report             | Detailed report with analysis + windows        |
| GET /records/trainee                  | All result docs for the student                |
| GET /reviews/{instructor_id}          | Reviews for an instructor                      |
| GET /settings/me                      | Achievements, profile, notification prefs      |

---

## COLLECTION COUNTS AFTER SEED

| Collection           | Count |
|----------------------|-------|
| users                | 8     |
| instructor_profiles  | 6     |
| availability         | ~345  |
| bookings             | 11    |
| sessions             | 10    |
| results              | 10    |
| reviews              | ~28   |
| settings             | 2     |
| institute_codes      | 7     |
