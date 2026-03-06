from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException


def now_utc() -> datetime:
    return datetime.utcnow()


def oid(x: str) -> ObjectId:
    try:
        return ObjectId(x)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def to_jsonable(obj):
    """
    Converts MongoDB docs (ObjectId, datetime, numpy) into JSON-safe values.
    Works for dicts, lists, and nested structures.
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()

    if isinstance(obj, list):
        return [to_jsonable(x) for x in obj]

    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}

    # Handle numpy/pandas types that may leak from ML pipeline
    try:
        import numpy as np
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.bool_):
            return bool(obj)
    except ImportError:
        pass

    return obj
