from datetime import datetime, timedelta
import bcrypt

try:
    from jose import jwt
except Exception:
    jwt = None

from app.config import JWT_SECRET, JWT_ALG, JWT_EXPIRE_MIN

def hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    hashed = bcrypt.hashpw(pw, bcrypt.gensalt())
    return hashed.decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False

def create_access_token(subject: str, extra: dict | None = None) -> str:
    if jwt is None:
        raise RuntimeError("Missing dependency: python-jose. Install with: pip install python-jose")

    now = datetime.utcnow()
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MIN)).timestamp()),
    }
    if extra:
        payload.update(extra)

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict:
    if jwt is None:
        raise RuntimeError("Missing dependency: python-jose. Install with: pip install python-jose")
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
