import os
import json
import joblib
from functools import lru_cache


def _lazy_import_keras():
    try:
        from tensorflow import keras
        return keras
    except Exception as e:
        raise RuntimeError(
            "TensorFlow is not installed or not working. "
            "Install: pip install tensorflow"
        ) from e


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")


@lru_cache(maxsize=1)
def load_artifacts():
    schema_path = os.path.join(ARTIFACTS_DIR, "feature_schema.json")

    motor_model_path = os.path.join(ARTIFACTS_DIR, "motor", "motor_model.keras")
    secondary_model_path = os.path.join(ARTIFACTS_DIR, "secondary", "secondary_model.keras")

    motor_scaler_path = os.path.join(ARTIFACTS_DIR, "motor", "motor_scaler.pkl")
    secondary_scaler_path = os.path.join(ARTIFACTS_DIR, "secondary", "secondary_scaler.pkl")

    missing = []
    for p in [
        schema_path,
        motor_model_path,
        secondary_model_path,
        motor_scaler_path,
        secondary_scaler_path,
    ]:
        if not os.path.exists(p):
            missing.append(p)

    if missing:
        raise FileNotFoundError(
            "Missing ML artifact files:\n" + "\n".join(missing)
        )

    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    feature_order = schema.get("feature_order", [])
    window_length = int(schema.get("window_length", 2400))
    num_features = int(schema.get("num_features", len(feature_order)))

    keras = _lazy_import_keras()
    motor_model = keras.models.load_model(motor_model_path, compile=False)
    secondary_model = keras.models.load_model(secondary_model_path, compile=False)

    motor_scaler = joblib.load(motor_scaler_path)
    secondary_scaler = joblib.load(secondary_scaler_path)

    return {
        "schema": schema,
        "feature_order": feature_order,
        "window_length": window_length,
        "num_features": num_features,
        "motor_model": motor_model,
        "secondary_model": secondary_model,
        "motor_scaler": motor_scaler,
        "secondary_scaler": secondary_scaler,
    }