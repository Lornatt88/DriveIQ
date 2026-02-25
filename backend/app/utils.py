from datetime import datetime
from bson import ObjectId

def to_jsonable(obj):
    """
    Converts MongoDB docs (ObjectId, datetime) into JSON-safe values.
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

    return obj
