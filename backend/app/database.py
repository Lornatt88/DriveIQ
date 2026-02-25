from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import OperationFailure
from app.config import MONGO_URI, MONGO_DB

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

# Collections (ALL used by main.py)
users_col = db["users"]
trips_col = db["trips"]
sessions_col = db["sessions"]
booking_requests_col = db["booking_requests"]
settings_col = db["settings"]

files_col = db["files"]
metrics_col = db["metrics"]
events_col = db["events"]
results_col = db["results"]

# Institute codes = codes given by institute (for instructor registration)
institute_codes_col = db["institute_codes"]

def _safe_create_index(col, keys, **kwargs):
    """
    Create index but NEVER crash app startup if:
    - index exists with different name/options
    - index already exists
    """
    try:
        col.create_index(keys, **kwargs)
    except OperationFailure:
        # Do not crash server. Index exists or conflicts.
        pass
    except Exception:
        # Also do not crash on unexpected index errors.
        pass

def ensure_indexes():
    # USERS
    _safe_create_index(users_col, [("email", ASCENDING)], unique=True, name="email_1_unique")
    _safe_create_index(users_col, [("user_id", ASCENDING)], unique=True, name="user_id_1_unique")
    _safe_create_index(users_col, [("role", ASCENDING), ("created_at", DESCENDING)], name="role_1_created_-1")
    _safe_create_index(users_col, [("join_code", ASCENDING)], unique=True, name="join_code_1_unique", sparse=True)
    _safe_create_index(users_col, [("instructor_id", ASCENDING)], name="instructor_id_1")

    # INSTITUTE CODES
    _safe_create_index(institute_codes_col, [("code", ASCENDING)], unique=True, name="code_1_unique")
    _safe_create_index(institute_codes_col, [("used", ASCENDING)], name="used_1")

    # TRIPS
    _safe_create_index(trips_col, [("created", DESCENDING)], name="created_-1")
    _safe_create_index(trips_col, [("instructor_id", ASCENDING), ("created", DESCENDING)], name="instructor_id_1_created_-1")
    _safe_create_index(trips_col, [("trainee_id", ASCENDING), ("created", DESCENDING)], name="trainee_id_1_created_-1")

    # FILES / METRICS / EVENTS / RESULTS
    _safe_create_index(files_col, [("trip_id", ASCENDING)], name="files_trip_id_1")
    _safe_create_index(metrics_col, [("trip_id", ASCENDING)], name="metrics_trip_id_1")
    _safe_create_index(events_col, [("trip_id", ASCENDING), ("t", ASCENDING)], name="trip_id_1_t_1")
    _safe_create_index(results_col, [("trip_id", ASCENDING), ("created", DESCENDING)], name="trip_id_1_created_-1")

    # SESSIONS (for frontend screens later)
    _safe_create_index(sessions_col, [("instructor_id", ASCENDING), ("created", DESCENDING)], name="sessions_instructor_id_1_created_-1")
    _safe_create_index(sessions_col, [("trainee_id", ASCENDING), ("created", DESCENDING)], name="sessions_trainee_id_1_created_-1")

    # BOOKING REQUESTS
    _safe_create_index(booking_requests_col, [("instructor_id", ASCENDING), ("created", DESCENDING)], name="booking_instructor_id_1_created_-1")
    _safe_create_index(booking_requests_col, [("trainee_id", ASCENDING), ("created", DESCENDING)], name="booking_trainee_id_1_created_-1")
    _safe_create_index(booking_requests_col, [("status", ASCENDING), ("created", DESCENDING)], name="booking_status_1_created_-1")
