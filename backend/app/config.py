import os
from dotenv import load_dotenv

load_dotenv()

# Mongo
MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DB = os.getenv("MONGO_DB", "driver_behavior")

# JWT
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_SUPER_SECRET")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MIN", "60"))

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Dataset root (optional, used by ingest_service)
DATASETS_ROOT = os.getenv("DATASETS_ROOT", "")

