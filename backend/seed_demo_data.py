"""
DriveIQ – MongoDB Seed Script (v2 – Per-Session Booking Model)
================================================================
Run:  python seed_demo_data.py --reset

Architecture:
  - NO join codes, NO permanent trainee-instructor links
  - Students browse instructors by profile/rating/availability
  - Students pick an available time slot → instant booking
  - Instructor-student link exists ONLY per session
  - Reviews drive instructor ratings

Collections seeded:
  users, instructor_profiles, availability, bookings,
  sessions, results, reviews, settings

⚠️  Use --reset to wipe and re-seed cleanly.
"""

import os
import sys
import uuid
import random
from datetime import datetime, timedelta
from pathlib import Path
from pymongo import MongoClient
import bcrypt
from dotenv import load_dotenv

# Load .env from the same directory as this script
load_dotenv(Path(__file__).resolve().parent / ".env")

# ── Config ──────────────────────────────────────────────────────────────────

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB  = os.getenv("MONGO_DB", "driver_behavior")

if not MONGO_URI:
    print("❌ MONGO_URI not found. Make sure .env exists in the backend folder.")
    sys.exit(1)

print(f"   Connecting to: {MONGO_URI[:40]}...")
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

# ── Collections ─────────────────────────────────────────────────────────────

users_col              = db["users"]
instructor_profiles_col = db["instructor_profiles"]
availability_col       = db["availability"]
bookings_col           = db["bookings"]
sessions_col           = db["sessions"]
results_col            = db["results"]
reviews_col            = db["reviews"]
settings_col           = db["settings"]

# ── Helpers ─────────────────────────────────────────────────────────────────

def now():      return datetime.utcnow()
def days_ago(n): return now() - timedelta(days=n)
def days_from_now(n): return now() + timedelta(days=n)
def uid():      return uuid.uuid4().hex
def hash_pw(p): return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ── Reset ───────────────────────────────────────────────────────────────────

def reset_all():
    print("🗑️  Wiping all collections...")
    for col in [users_col, instructor_profiles_col, availability_col,
                bookings_col, sessions_col, results_col, reviews_col, settings_col]:
        col.delete_many({})
    print("   Done.\n")

# ── Seed ────────────────────────────────────────────────────────────────────

def seed():
    print("🌱 Seeding demo data (v2 — per-session booking model)...\n")

    # ════════════════════════════════════════════════════════════════════
    # 1. INSTRUCTORS
    # ════════════════════════════════════════════════════════════════════

    instructors_data = [
        {
            "name":        "Dr. Sarah Mitchell",
            "email":       "sarah.mitchell@driveiq.demo",
            "bio":         "15 years of driving instruction experience. Specializes in nervous beginners and motorway confidence building. Patient, calm, and thorough approach.",
            "specialties": ["Beginner Friendly", "Motorway", "Nervous Drivers"],
            "experience_years": 15,
            "price_per_session": 45.00,
            "currency": "AED",
            "vehicle": "Toyota Yaris 2024 (Dual Control)",
            "languages": ["English", "Arabic"],
            "location_area": "Dubai Marina",
        },
        {
            "name":        "Prof. James Carter",
            "email":       "james.carter@driveiq.demo",
            "bio":         "Former racing instructor turned driving educator. Expert in defensive driving and high-speed confidence. Great for students who want to feel in control at any speed.",
            "specialties": ["Defensive Driving", "Highway", "Advanced Techniques"],
            "experience_years": 12,
            "price_per_session": 55.00,
            "currency": "AED",
            "vehicle": "Honda Civic 2023 (Dual Control)",
            "languages": ["English"],
            "location_area": "JBR / JLT",
        },
        {
            "name":        "Ms. Fatima Al-Rashid",
            "email":       "fatima.rashid@driveiq.demo",
            "bio":         "Certified female instructor with a focus on empowering women drivers. Covers everything from parking to desert highway driving. Bilingual Arabic/English.",
            "specialties": ["Women Drivers", "Parking", "City Driving"],
            "experience_years": 8,
            "price_per_session": 40.00,
            "currency": "AED",
            "vehicle": "Nissan Sunny 2024 (Dual Control)",
            "languages": ["Arabic", "English"],
            "location_area": "Al Barsha",
        },
        {
            "name":        "Mr. David Thompson",
            "email":       "david.thompson@driveiq.demo",
            "bio":         "Specializes in test preparation and road test routes. 95% first-time pass rate. Structured lesson plans with clear progress tracking.",
            "specialties": ["Test Preparation", "Road Test Routes", "Structured Lessons"],
            "experience_years": 10,
            "price_per_session": 50.00,
            "currency": "AED",
            "vehicle": "Kia Cerato 2024 (Dual Control)",
            "languages": ["English", "Hindi"],
            "location_area": "Deira / Bur Dubai",
        },
        {
            "name":        "Dr. Priya Sharma",
            "email":       "priya.sharma@driveiq.demo",
            "bio":         "PhD in Transportation Safety. Research-backed teaching methods focused on hazard perception and situational awareness. Ideal for analytical learners.",
            "specialties": ["Hazard Perception", "Night Driving", "Research-Based"],
            "experience_years": 7,
            "price_per_session": 48.00,
            "currency": "AED",
            "vehicle": "Hyundai Accent 2024 (Dual Control)",
            "languages": ["English", "Hindi", "Urdu"],
            "location_area": "Business Bay",
        },
        {
            "name":        "Mr. Omar Hassan",
            "email":       "omar.hassan@driveiq.demo",
            "bio":         "Young, energetic instructor who connects well with teens and university students. Makes learning fun while maintaining high safety standards.",
            "specialties": ["Young Drivers", "University Students", "Beginner Friendly"],
            "experience_years": 5,
            "price_per_session": 35.00,
            "currency": "AED",
            "vehicle": "Toyota Corolla 2023 (Dual Control)",
            "languages": ["Arabic", "English", "French"],
            "location_area": "Academic City / Silicon Oasis",
        },
    ]

    instructor_ids = {}  # email -> {user_id, instructor_id}

    print("   👨‍🏫 Creating instructors...")
    for inst in instructors_data:
        user_id = uid()
        instructor_id = uid()

        # User doc (auth)
        users_col.insert_one({
            "user_id":       user_id,
            "role":          "instructor",
            "name":          inst["name"],
            "email":         inst["email"],
            "password_hash": hash_pw("demo1234"),
            "instructor_id": instructor_id,
            "created_at":    days_ago(random.randint(30, 90)),
        })

        # Instructor profile (public-facing)
        instructor_profiles_col.insert_one({
            "instructor_id":      instructor_id,
            "user_id":            user_id,
            "name":               inst["name"],
            "bio":                inst["bio"],
            "specialties":        inst["specialties"],
            "experience_years":   inst["experience_years"],
            "price_per_session":  inst["price_per_session"],
            "currency":           inst["currency"],
            "vehicle":            inst["vehicle"],
            "languages":          inst["languages"],
            "location_area":      inst["location_area"],
            "rating":             0.0,    # computed from reviews
            "total_reviews":      0,
            "total_sessions":     0,
            "verified":           True,
            "active":             True,
            "created_at":         days_ago(random.randint(30, 90)),
        })

        instructor_ids[inst["email"]] = {
            "user_id": user_id,
            "instructor_id": instructor_id,
            "name": inst["name"],
        }
        print(f"      ✅ {inst['name']:25s} | {inst['price_per_session']} {inst['currency']}/session | {inst['location_area']}")

    # ════════════════════════════════════════════════════════════════════
    # 2. TRAINEES
    # ════════════════════════════════════════════════════════════════════

    print("\n   🎓 Creating trainees...")

    trainee1_id = uid()
    trainee2_id = uid()

    users_col.insert_one({
        "user_id":       trainee1_id,
        "role":          "trainee",
        "name":          "Ziyan Hashim",
        "email":         "ziyan@driveiq.demo",
        "password_hash": hash_pw("demo1234"),
        "created_at":    days_ago(25),
    })

    users_col.insert_one({
        "user_id":       trainee2_id,
        "role":          "trainee",
        "name":          "Ahmad Khan",
        "email":         "ahmad@driveiq.demo",
        "password_hash": hash_pw("demo1234"),
        "created_at":    days_ago(20),
    })

    print(f"      ✅ Ziyan Hashim  | ziyan@driveiq.demo")
    print(f"      ✅ Ahmad Khan    | ahmad@driveiq.demo")

    # ════════════════════════════════════════════════════════════════════
    # 3. AVAILABILITY (instructor time slots)
    # ════════════════════════════════════════════════════════════════════

    print("\n   📅 Creating availability slots...")

    slot_count = 0
    for email, ids in instructor_ids.items():
        iid = ids["instructor_id"]

        # Past slots (already booked — status: booked)
        # Future slots (open for booking)
        for day_offset in range(-14, 21):
            # Each instructor has 2-3 slots per day
            if random.random() < 0.3:
                continue  # skip some days (days off)

            base_date = now() + timedelta(days=day_offset)
            hours = random.sample([8, 10, 12, 14, 16, 18], k=random.randint(2, 3))

            for hour in sorted(hours):
                slot_start = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                slot_end   = slot_start + timedelta(minutes=60)

                is_past = day_offset < 0
                # Past slots are either booked or were open (expired)
                if is_past:
                    status = random.choice(["booked", "booked", "expired"])
                else:
                    status = "open"

                availability_col.insert_one({
                    "slot_id":        uid(),
                    "instructor_id":  iid,
                    "date":           slot_start.strftime("%Y-%m-%d"),
                    "start_time":     slot_start.isoformat(),
                    "end_time":       slot_end.isoformat(),
                    "duration_min":   60,
                    "status":         status,  # open | booked | expired | cancelled
                    "booked_by":      None,
                    "created_at":     days_ago(max(1, abs(day_offset) + 5)),
                })
                slot_count += 1

    print(f"      ✅ {slot_count} time slots created across {len(instructor_ids)} instructors")

    # ════════════════════════════════════════════════════════════════════
    # 4. COMPLETED SESSIONS + BOOKINGS + RESULTS (for trainee 1)
    # ════════════════════════════════════════════════════════════════════

    print("\n   📝 Creating completed sessions with results for Ziyan...")

    # Ziyan has booked different instructors over time
    sarah = instructor_ids["sarah.mitchell@driveiq.demo"]
    james = instructor_ids["james.carter@driveiq.demo"]
    fatima = instructor_ids["fatima.rashid@driveiq.demo"]
    david = instructor_ids["david.thompson@driveiq.demo"]

    session_data = [
        {"days": 21, "road": "secondary", "behavior": "Aggressive", "score": 52, "badge": "Improving",  "confidence": 0.78, "instructor": sarah},
        {"days": 18, "road": "motor",     "behavior": "Normal",     "score": 71, "badge": "Improving",  "confidence": 0.85, "instructor": sarah},
        {"days": 15, "road": "secondary", "behavior": "Drowsy",     "score": 45, "badge": "Improving",  "confidence": 0.72, "instructor": james},
        {"days": 12, "road": "motor",     "behavior": "Normal",     "score": 76, "badge": "Good",       "confidence": 0.88, "instructor": sarah},
        {"days": 9,  "road": "secondary", "behavior": "Normal",     "score": 80, "badge": "Good",       "confidence": 0.91, "instructor": fatima},
        {"days": 6,  "road": "motor",     "behavior": "Normal",     "score": 83, "badge": "Good",       "confidence": 0.90, "instructor": david},
        {"days": 3,  "road": "secondary", "behavior": "Normal",     "score": 87, "badge": "Great",      "confidence": 0.93, "instructor": sarah},
        {"days": 1,  "road": "motor",     "behavior": "Normal",     "score": 91, "badge": "Excellent",  "confidence": 0.95, "instructor": david},
    ]

    ai_feedback_templates = {
        "Aggressive": [
            {"priority": "high",   "title": "Harsh Braking Detected",     "message": "Multiple hard braking events detected. Try to anticipate traffic flow and brake gradually.", "icon": "🛑", "area": "Braking",     "score": 40},
            {"priority": "high",   "title": "Aggressive Acceleration",    "message": "Rapid acceleration patterns observed. Smoother throttle control will improve safety.",      "icon": "⚡", "area": "Acceleration", "score": 45},
            {"priority": "medium", "title": "Lane Discipline",            "message": "Minor lane deviations noticed. Keep a steady grip and focus on lane centering.",             "icon": "🛣️", "area": "Lane Control", "score": 55},
        ],
        "Drowsy": [
            {"priority": "high",   "title": "Drowsiness Indicators",      "message": "Patterns consistent with drowsy driving detected. Take regular breaks every 2 hours.",      "icon": "😴", "area": "Alertness",    "score": 35},
            {"priority": "high",   "title": "Lane Drift Detected",        "message": "Gradual lane drifting observed, often associated with fatigue. Pull over if tired.",        "icon": "↔️", "area": "Lane Control", "score": 40},
            {"priority": "medium", "title": "Reaction Time",              "message": "Slower response patterns detected. Ensure adequate rest before driving.",                   "icon": "⏱️", "area": "Reaction",     "score": 45},
        ],
        "Normal": [
            {"priority": "low",    "title": "Smooth Driving",             "message": "Good overall driving pattern. Continue maintaining consistent speed and safe following distance.", "icon": "✅", "area": "Overall",      "score": 85},
            {"priority": "low",    "title": "Good Lane Discipline",       "message": "Excellent lane centering throughout the session. Keep it up!",                                   "icon": "🛣️", "area": "Lane Control", "score": 88},
            {"priority": "medium", "title": "Speed Management",           "message": "Mostly within limits. Watch for slight overspeeding in transition zones.",                       "icon": "🏎️", "area": "Speed",        "score": 78},
        ],
    }

    instructor_note_templates = [
        "Good improvement since last session. Focus on maintaining lane position during turns.",
        "Nice work on motorway merging. Practice mirror checks more consistently.",
        "Braking has improved significantly. Work on smoother acceleration from stops.",
        "Great session overall. Remember to check blind spots when changing lanes.",
        "Solid progress! Try to reduce speed slightly when approaching roundabouts.",
        "Very smooth driving today. Keep up the consistent performance.",
        "Excellent control at higher speeds. Work on parking maneuvers next session.",
        "Outstanding improvement! You're ready for more complex routes.",
    ]

    for i, sd in enumerate(session_data):
        session_id = uid()
        booking_id = uid()
        inst = sd["instructor"]
        session_created = days_ago(sd["days"])
        started = session_created.replace(hour=10, minute=0, second=0, microsecond=0)
        ended   = started + timedelta(minutes=random.randint(45, 75))

        # Booking doc
        bookings_col.insert_one({
            "booking_id":     booking_id,
            "trainee_id":     trainee1_id,
            "instructor_id":  inst["instructor_id"],
            "slot_date":      session_created.strftime("%Y-%m-%d"),
            "start_time":     started.isoformat(),
            "end_time":       ended.isoformat(),
            "status":         "completed",  # pending | confirmed | completed | cancelled
            "session_id":     session_id,
            "created_at":     session_created - timedelta(days=2),
        })

        # Session doc (per-session instructor link)
        sessions_col.insert_one({
            "session_id":        session_id,
            "booking_id":        booking_id,
            "instructor_id":     inst["instructor_id"],
            "instructor_name":   inst["name"],
            "trainee_id":        trainee1_id,
            "vehicle_id":        "VH-" + str(random.randint(100, 999)),
            "duration_min":      int((ended - started).total_seconds() / 60),
            "status":            "completed",
            "road_type":         sd["road"],
            "dataset_used":      {"csv": f"D{random.randint(1,6)}_{sd['road']}_data.csv"},
            "created_at":        session_created,
            "started_at":        started,
            "ended_at":          ended,
            "instructor_notes":  instructor_note_templates[i],
        })

        # Anomaly windows
        num_windows = 30
        windows = []
        for w in range(num_windows):
            is_anomaly = random.random() < (0.4 if sd["behavior"] != "Normal" else 0.08)
            windows.append({
                "window_index": w,
                "start_min": w * 4,
                "end_min": (w + 1) * 4,
                "is_anomaly": is_anomaly,
                "anomaly_score": round(random.uniform(0.6, 0.95), 3) if is_anomaly else round(random.uniform(0.0, 0.2), 3),
                "top_feature": random.choice(["speed_variance", "lane_offset", "brake_intensity", "steering_angle", "acceleration"]) if is_anomaly else None,
            })

        # Probabilities
        if sd["behavior"] == "Normal":
            probs = {"Normal": round(sd["confidence"], 2), "Aggressive": round(random.uniform(0.02, 0.10), 2), "Drowsy": round(random.uniform(0.02, 0.08), 2)}
        elif sd["behavior"] == "Aggressive":
            probs = {"Normal": round(random.uniform(0.10, 0.20), 2), "Aggressive": round(sd["confidence"], 2), "Drowsy": round(random.uniform(0.02, 0.08), 2)}
        else:
            probs = {"Normal": round(random.uniform(0.10, 0.20), 2), "Aggressive": round(random.uniform(0.05, 0.10), 2), "Drowsy": round(sd["confidence"], 2)}

        feedback = ai_feedback_templates.get(sd["behavior"], ai_feedback_templates["Normal"])

        # Result doc
        results_col.insert_one({
            "session_id":     session_id,
            "booking_id":     booking_id,
            "trainee_id":     trainee1_id,
            "instructor_id":  inst["instructor_id"],
            "instructor_name": inst["name"],
            "created_at":     ended,
            "method":         "ml_v1",
            "analysis": {
                "behavior":   sd["behavior"],
                "confidence": sd["confidence"],
                "overall":    sd["score"],
                "badge":      sd["badge"],
                "probs":      probs,
            },
            "ai_feedback":    feedback,
            "windows":        windows,
            "instructor_comment": {
                "text":   instructor_note_templates[i],
                "rating": min(5, max(1, sd["score"] // 20)),
                "date":   ended.isoformat(),
            },
        })

        print(f"      Session {i+1}: {sd['behavior']:10s} | Score {sd['score']:3d} | {sd['road']:9s} | {inst['name']:25s} | {sd['days']}d ago")

    # ════════════════════════════════════════════════════════════════════
    # 5. REVIEWS (from trainee 1 for instructors they've used)
    # ════════════════════════════════════════════════════════════════════

    print("\n   ⭐ Creating reviews...")

    reviews_data = [
        {"instructor": sarah,  "rating": 5, "text": "Dr. Mitchell is amazing! Very patient and explains everything clearly. I felt so much more confident on the motorway after our sessions."},
        {"instructor": sarah,  "rating": 4, "text": "Great instructor. Sometimes the sessions feel a bit short, but the quality of instruction is top-notch."},
        {"instructor": james,  "rating": 3, "text": "Good knowledge of defensive driving but the pace was a bit fast for me as a beginner."},
        {"instructor": fatima, "rating": 5, "text": "Ms. Fatima made me feel very comfortable. Perfect for women who are nervous about driving. Highly recommend!"},
        {"instructor": david,  "rating": 5, "text": "Mr. Thompson's structured approach really helped me prepare for the road test. Passed on my first attempt!"},
        {"instructor": david,  "rating": 4, "text": "Very organized lessons with clear progress tracking. Would book again."},
    ]

    # Also add some reviews from "other students" to make it realistic
    fake_reviewers = ["Lorna M.", "Seif A.", "Zaid K.", "Aisha R.", "Mohammed S.", "Sara T.", "Raj P.", "Noor H."]

    for inst_email, ids in instructor_ids.items():
        iid = ids["instructor_id"]
        # 3-6 reviews from random students per instructor
        num_fake = random.randint(3, 6)
        for _ in range(num_fake):
            rating = random.choices([3, 4, 4, 5, 5, 5], k=1)[0]  # skewed positive
            review_texts = [
                f"Really enjoyed the session. {'Highly recommend!' if rating >= 4 else 'Good but could improve pace.'}",
                f"{'Excellent' if rating >= 4 else 'Decent'} instructor. {'Very patient and clear.' if rating >= 4 else 'A bit rushed at times.'}",
                f"{'Great experience!' if rating >= 4 else 'Average session.'} {'Learned a lot.' if rating >= 4 else 'Expected more hands-on practice.'}",
                f"{'Would definitely book again.' if rating >= 4 else 'Might try a different instructor next time.'}",
            ]
            reviews_col.insert_one({
                "review_id":      uid(),
                "instructor_id":  iid,
                "reviewer_name":  random.choice(fake_reviewers),
                "trainee_id":     uid(),  # fake trainee IDs
                "rating":         rating,
                "text":           random.choice(review_texts),
                "created_at":     days_ago(random.randint(1, 60)),
            })

    # Real reviews from Ziyan
    for rv in reviews_data:
        reviews_col.insert_one({
            "review_id":      uid(),
            "instructor_id":  rv["instructor"]["instructor_id"],
            "reviewer_name":  "Ziyan H.",
            "trainee_id":     trainee1_id,
            "rating":         rv["rating"],
            "text":           rv["text"],
            "created_at":     days_ago(random.randint(1, 20)),
        })

    # Now compute and update instructor ratings
    for inst_email, ids in instructor_ids.items():
        iid = ids["instructor_id"]
        all_reviews = list(reviews_col.find({"instructor_id": iid}))
        if all_reviews:
            avg_rating = round(sum(r["rating"] for r in all_reviews) / len(all_reviews), 1)
            total_sessions_done = sessions_col.count_documents({"instructor_id": iid, "status": "completed"})
            instructor_profiles_col.update_one(
                {"instructor_id": iid},
                {"$set": {
                    "rating": avg_rating,
                    "total_reviews": len(all_reviews),
                    "total_sessions": total_sessions_done,
                }},
            )
            print(f"      ⭐ {ids['name']:25s} | Rating: {avg_rating}/5 ({len(all_reviews)} reviews)")

    # ════════════════════════════════════════════════════════════════════
    # 6. UPCOMING BOOKING (for trainee 1)
    # ════════════════════════════════════════════════════════════════════

    print("\n   📅 Creating upcoming booking...")

    upcoming_date = days_from_now(3).replace(hour=14, minute=0, second=0, microsecond=0)
    upcoming_session_id = uid()
    upcoming_booking_id = uid()
    upcoming_slot_id    = uid()

    # The slot
    availability_col.insert_one({
        "slot_id":        upcoming_slot_id,
        "instructor_id":  sarah["instructor_id"],
        "date":           upcoming_date.strftime("%Y-%m-%d"),
        "start_time":     upcoming_date.isoformat(),
        "end_time":       (upcoming_date + timedelta(hours=1)).isoformat(),
        "duration_min":   60,
        "status":         "booked",
        "booked_by":      trainee1_id,
        "created_at":     days_ago(5),
    })

    # The booking
    bookings_col.insert_one({
        "booking_id":     upcoming_booking_id,
        "trainee_id":     trainee1_id,
        "instructor_id":  sarah["instructor_id"],
        "slot_id":        upcoming_slot_id,
        "slot_date":      upcoming_date.strftime("%Y-%m-%d"),
        "start_time":     upcoming_date.isoformat(),
        "end_time":       (upcoming_date + timedelta(hours=1)).isoformat(),
        "status":         "confirmed",
        "session_id":     None,  # created when session starts
        "created_at":     days_ago(2),
    })

    print(f"      ✅ Booked with Dr. Sarah Mitchell on {upcoming_date.strftime('%b %d, %Y at %I:%M %p')}")

    # ════════════════════════════════════════════════════════════════════
    # 7. SETTINGS & ACHIEVEMENTS
    # ════════════════════════════════════════════════════════════════════

    print("\n   🏆 Creating achievements and settings...")

    achievements = [
        {"id": "first_session",   "title": "First Drive",        "subtitle": "Completed your first session",       "icon": "🚗", "earned": True,  "earned_at": days_ago(21).isoformat()},
        {"id": "five_sessions",   "title": "Road Regular",       "subtitle": "Completed 5 driving sessions",       "icon": "🏅", "earned": True,  "earned_at": days_ago(9).isoformat()},
        {"id": "score_above_80",  "title": "Safe Driver",        "subtitle": "Scored above 80 in a session",       "icon": "🛡️", "earned": True,  "earned_at": days_ago(6).isoformat()},
        {"id": "score_above_90",  "title": "Expert Driver",      "subtitle": "Scored above 90 in a session",       "icon": "⭐", "earned": True,  "earned_at": days_ago(1).isoformat()},
        {"id": "ten_sessions",    "title": "Driving Veteran",    "subtitle": "Complete 10 driving sessions",        "icon": "🏆", "earned": False},
        {"id": "perfect_score",   "title": "Flawless",           "subtitle": "Score 100 in a session",             "icon": "💎", "earned": False},
        {"id": "multi_instructor","title": "Explorer",           "subtitle": "Book sessions with 3+ instructors",  "icon": "🗺️", "earned": True,  "earned_at": days_ago(6).isoformat()},
    ]

    settings_col.update_one(
        {"user_id": trainee1_id},
        {"$set": {
            "user_id":      trainee1_id,
            "achievements": achievements,
            "profile": {
                "name":         "Ziyan Hashim",
                "email":        "ziyan@driveiq.demo",
                "phone":        "+971 50 123 4567",
                "license_type": "Learner's Permit",
                "joined":       days_ago(25).isoformat(),
            },
            "notifications": {
                "session_reminders":    True,
                "report_ready":         True,
                "instructor_comments":  True,
                "achievements":         True,
                "booking_confirmations": True,
            },
            "preferences": {"theme": "light", "language": "en"},
        }},
        upsert=True,
    )

    settings_col.update_one(
        {"user_id": trainee2_id},
        {"$set": {
            "user_id":      trainee2_id,
            "achievements": [achievements[0]],
            "profile": {"name": "Ahmad Khan", "email": "ahmad@driveiq.demo"},
            "notifications": {"session_reminders": True, "report_ready": True},
            "preferences": {"theme": "light", "language": "en"},
        }},
        upsert=True,
    )

    earned = len([a for a in achievements if a.get("earned")])
    print(f"      ✅ {earned} achievements earned, {len(achievements) - earned} locked")

    # ── A couple sessions for trainee 2 ─────────────────────────────
    print("\n   📝 Creating sessions for Ahmad...")
    for i, sd in enumerate([
        {"days": 10, "road": "secondary", "behavior": "Aggressive", "score": 48, "badge": "Improving", "confidence": 0.75, "instructor": fatima},
        {"days": 5,  "road": "secondary", "behavior": "Normal",     "score": 65, "badge": "Improving", "confidence": 0.82, "instructor": fatima},
    ]):
        sid = uid()
        bid = uid()
        created = days_ago(sd["days"])
        started = created.replace(hour=14, minute=0)
        ended = started + timedelta(minutes=55)

        bookings_col.insert_one({
            "booking_id": bid, "trainee_id": trainee2_id,
            "instructor_id": sd["instructor"]["instructor_id"],
            "slot_date": created.strftime("%Y-%m-%d"),
            "start_time": started.isoformat(), "end_time": ended.isoformat(),
            "status": "completed", "session_id": sid,
            "created_at": created - timedelta(days=1),
        })
        sessions_col.insert_one({
            "session_id": sid, "booking_id": bid,
            "instructor_id": sd["instructor"]["instructor_id"],
            "instructor_name": sd["instructor"]["name"],
            "trainee_id": trainee2_id,
            "vehicle_id": "VH-301", "duration_min": 55,
            "status": "completed", "road_type": sd["road"],
            "created_at": created, "started_at": started, "ended_at": ended,
            "instructor_notes": "Keep practicing, good effort.",
        })
        results_col.insert_one({
            "session_id": sid, "booking_id": bid,
            "trainee_id": trainee2_id,
            "instructor_id": sd["instructor"]["instructor_id"],
            "instructor_name": sd["instructor"]["name"],
            "created_at": ended, "method": "ml_v1",
            "analysis": {"behavior": sd["behavior"], "confidence": sd["confidence"],
                         "overall": sd["score"], "badge": sd["badge"], "probs": {}},
            "ai_feedback": ai_feedback_templates.get(sd["behavior"], []),
            "instructor_comment": {"text": "Keep practicing, good effort.", "rating": 3, "date": ended.isoformat()},
        })
        print(f"      Session {i+1}: {sd['behavior']:10s} | Score {sd['score']:3d} | {sd['instructor']['name']}")

    # ════════════════════════════════════════════════════════════════════
    # DONE
    # ════════════════════════════════════════════════════════════════════

    print(f"\n{'='*60}")
    print(f"  🎉 SEED COMPLETE (v2 — Per-Session Booking Model)")
    print(f"{'='*60}")
    print(f"\n  Demo accounts (all passwords: demo1234):")
    print(f"  ┌────────────────────────────────────────────────────────┐")
    print(f"  │ TRAINEES                                              │")
    print(f"  │   ziyan@driveiq.demo                                  │")
    print(f"  │   ahmad@driveiq.demo                                  │")
    print(f"  │                                                       │")
    print(f"  │ INSTRUCTORS                                           │")
    for email in instructor_ids:
        print(f"  │   {email:52s} │")
    print(f"  └────────────────────────────────────────────────────────┘")
    print(f"\n  Collections:")
    print(f"    users:                {users_col.count_documents({})}")
    print(f"    instructor_profiles:  {instructor_profiles_col.count_documents({})}")
    print(f"    availability:         {availability_col.count_documents({})}")
    print(f"    bookings:             {bookings_col.count_documents({})}")
    print(f"    sessions:             {sessions_col.count_documents({})}")
    print(f"    results:              {results_col.count_documents({})}")
    print(f"    reviews:              {reviews_col.count_documents({})}")
    print(f"    settings:             {settings_col.count_documents({})}")
    print()


# ── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset_all()
    seed()
