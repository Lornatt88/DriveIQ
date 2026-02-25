# app/ml/predictor.py

from typing import Dict, Any
import numpy as np
import pandas as pd

from .keras_runtime import load_artifacts
from .feature_builder import make_windows


LABELS = ["Aggressive", "Drowsy", "Normal"]


def predict_from_dataframe(df: pd.DataFrame, road_type: str) -> Dict[str, Any]:

    # ------------------------------------------------
    # LOAD MODELS + SCHEMA
    # ------------------------------------------------
    art = load_artifacts()

    feature_cols = art["feature_order"]
    window_size = int(art["window_length"])

    road = (road_type or "").strip().lower()
    use_motor = road in ["motor", "motorway", "highway"]

    model = art["motor_model"] if use_motor else art["secondary_model"]
    scaler = art["motor_scaler"] if use_motor else art["secondary_scaler"]

    # ------------------------------------------------
    # DROP LABEL COLUMNS (CRITICAL)
    # ------------------------------------------------
    for drop_col in ["behavior_label", "label", "target", "class"]:
        if drop_col in df.columns:
            df = df.drop(columns=[drop_col])

    # ------------------------------------------------
    # STRICT FEATURE ORDER ENFORCEMENT
    # ------------------------------------------------
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0.0

    df = df[feature_cols]

    # ------------------------------------------------
    # CREATE WINDOWS (uses correct stride internally)
    # ------------------------------------------------
    X, _ = make_windows(
        df,
        feature_cols,
        window_size=window_size,
        road_type=road_type
    )

    if X.shape[0] == 0:
        raise ValueError(
            f"Not enough rows for ML window. Need at least {window_size} rows."
        )

    # ------------------------------------------------
    # SCALE EXACTLY LIKE TRAINING
    # ------------------------------------------------
    n, t, f = X.shape

    X2 = X.reshape(n * t, f)
    X2 = scaler.transform(X2)
    X_scaled = X2.reshape(n, t, f)

    # ------------------------------------------------
    # PREDICT
    # ------------------------------------------------
    probs = model.predict(X_scaled, verbose=0)

    # Average probabilities across all windows
    mean_probs = probs.mean(axis=0)

    pred_idx = int(np.argmax(mean_probs))
    confidence = float(mean_probs[pred_idx])
    label = LABELS[pred_idx]

    # ------------------------------------------------
    # OVERALL SCORE LOGIC
    # ------------------------------------------------
    if label == "Normal":
        overall = int(80 + confidence * 20)

    elif label == "Aggressive":
        overall = int(35 + (1 - confidence) * 15)

    else:  # Drowsy
        overall = int(20 + (1 - confidence) * 20)

    overall = max(0, min(100, overall))

    badge = (
        "Excellent"
        if overall >= 85
        else "Improving"
        if overall >= 70
        else "Needs Focus"
    )

    # ------------------------------------------------
    # AI FEEDBACK
    # ------------------------------------------------
    if label == "Aggressive":
        feedback = [{
            "priority": "high",
            "title": "Harsh driving detected",
            "message": (
                f"Model detected aggressive patterns "
                f"({round(confidence * 100)}% confidence). "
                "Focus on smoother acceleration and braking."
            )
        }]

    elif label == "Drowsy":
        feedback = [{
            "priority": "high",
            "title": "Possible fatigue risk",
            "message": (
                f"Model detected drowsiness patterns "
                f"({round(confidence * 100)}% confidence). "
                "Consider taking a break."
            )
        }]

    else:
        feedback = [{
            "priority": "medium",
            "title": "Good control",
            "message": (
                f"Model detected normal driving "
                f"({round(confidence * 100)}% confidence). "
                "Maintain consistency."
            )
        }]

    # ------------------------------------------------
    # FINAL RESPONSE
    # ------------------------------------------------
    return {
        "method": "ml_v1",
        "road_type": "motor" if use_motor else "secondary",
        "windows_used": int(X.shape[0]),
        "label": label,
        "confidence": confidence,
        "overall": overall,
        "badge": badge,
        "probs": {
            LABELS[i]: float(mean_probs[i]) for i in range(3)
        },
        "ai_feedback": feedback,
    }