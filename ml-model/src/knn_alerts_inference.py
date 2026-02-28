import numpy as np
import pandas as pd
import joblib
import json


# ============================================================
# Load KNN components
# ============================================================

def load_knn_components(road_type):

    road_type_clean = road_type.strip().lower()

    if road_type_clean in ["motorway", "motor"]:
        knn_model = joblib.load("../models/motor_knn_model.pkl")
        scaler = joblib.load("../models/motor_knn_scaler.pkl")
        threshold_key = "motor"

    elif road_type_clean in ["secondary"]:
        knn_model = joblib.load("../models/secondary_knn_model.pkl")
        scaler = joblib.load("../models/secondary_knn_scaler.pkl")
        threshold_key = "secondary"

    else:
        raise ValueError(f"Unknown road type: {road_type}")

    with open("../models/knn_feature_cols.json", "r") as f:
        knn_feature_cols = json.load(f)

    with open("../models/knn_thresholds.json", "r") as f:
        thresholds = json.load(f)

    threshold = thresholds[threshold_key]

    return knn_model, scaler, knn_feature_cols, threshold


# ============================================================
# Recreate KNN-ready features
# ============================================================

def create_knn_ready_windows_inference(windows, knn_feature_cols):

    rows = []

    for win_idx in range(windows.shape[0]):
        window = windows[win_idx]
        row = {}

        for i, col_name in enumerate(knn_feature_cols):
            row[col_name] = np.mean(window[:, i])

        rows.append(row)

    return pd.DataFrame(rows)


# ============================================================
# Run KNN alert detection + alert types + severity
# ============================================================

def run_knn_alerts(knn_feature_df, road_type):

    knn_model, scaler, knn_feature_cols, threshold = load_knn_components(road_type)

    X = knn_feature_df[knn_feature_cols].copy()
    X_scaled = scaler.transform(X)

    distances, _ = knn_model.kneighbors(X_scaled)
    knn_distance = distances.mean(axis=1)

    window_results = []
    raw_severities = []

    for i in range(len(knn_distance)):

        row = knn_feature_df.iloc[i]

        alert_label = "No alert"
        alert_cause = "None"
        severity = 0.0
        trigger_features = []

        if knn_distance[i] > threshold:

            alert_label = "Abnormal"

            harsh_score = abs(row.get("vert_acc_mean", 0)) + abs(row.get("horiz_acc_mean", 0))
            overspeed_score = row.get("speed_kmh_mean", 0) + row.get("speed_ratio_mean", 0)
            unstable_score = (
                abs(row.get("difcourse_mean", 0)) +
                abs(row.get("horiz_acc_mean", 0)) +
                abs(row.get("course_mean", 0))
            )
            tailgating_score = 0
            if row.get("ttc_front_mean", 10) < 2:
                tailgating_score = 2 - row["ttc_front_mean"]

            scores = {
                "Harsh Driving": harsh_score,
                "Overspeeding": overspeed_score,
                "Unstable Steering": unstable_score,
                "Tailgating": tailgating_score
            }

            alert_cause = max(scores, key=scores.get)
            severity = float(scores[alert_cause])

            # Only include trigger features for that alert type
            if alert_cause == "Overspeeding":
                trigger_features = [
                    {"feature": "Speed (km/h)", "value": row["speed_kmh_mean"], "unit": "km/h"},
                    {"feature": "Speed Ratio", "value": row["speed_ratio_mean"], "unit": "ratio"}
                ]

            elif alert_cause == "Harsh Driving":
                trigger_features = [
                    {"feature": "Vertical Acc", "value": row["vert_acc_mean"], "unit": "m/s²"},
                    {"feature": "Horizontal Acc", "value": row["horiz_acc_mean"], "unit": "m/s²"}
                ]

            elif alert_cause == "Unstable Steering":
                trigger_features = [
                    {"feature": "Course Change", "value": row["difcourse_mean"], "unit": "deg"},
                    {"feature": "Horizontal Acc", "value": row["horiz_acc_mean"], "unit": "m/s²"}
                ]

            elif alert_cause == "Tailgating":
                trigger_features = [
                    {"feature": "TTC Front", "value": row["ttc_front_mean"], "unit": "seconds"}
                ]

        raw_severities.append(severity)

        window_results.append({
            "window_id": int(row["window_id"]),
            "predicted_label": row["predicted_label"],
            "alert": alert_label,
            "alert_cause": alert_cause,
            "severity_raw": severity,
            "knn_distance": float(knn_distance[i]),
            "trigger_features": trigger_features
        })

    # Normalize severity
    min_s = min(raw_severities)
    max_s = max(raw_severities)

    for w in window_results:
        if max_s > min_s:
            w["severity"] = round(((w["severity_raw"] - min_s) / (max_s - min_s)) * 100, 2)
        else:
            w["severity"] = 0
        del w["severity_raw"]

    return window_results


# ============================================================
# Build session-level summary
# ============================================================

def build_session_summary(result_df, road_type, session_id):

    total_windows = len(result_df)
    total_alerts = (result_df["alert"] == "Abnormal").sum()

    dominant_alert = (
        result_df["alert_cause"].value_counts().idxmax()
        if total_alerts > 0 else "None"
    )

    avg_severity = result_df["severity"].mean()
    max_severity = result_df["severity"].max()

    session_risk_score = (
        (total_alerts / total_windows) * 50 +
        (avg_severity / 100) * 50
    )

    summary = {
        "session_id": session_id,
        "road_type": road_type,
        "total_windows": total_windows,
        "total_alerts": int(total_alerts),
        "dominant_alert": dominant_alert,
        "average_severity": round(float(avg_severity), 2),
        "max_severity": round(float(max_severity), 2),
        "session_risk_score": round(float(session_risk_score), 2)
    }

    return summary


# ============================================================
# Full pipeline from sensor_json
# ============================================================

from preprocessing_inference import run_classification
from preprocessing_inference import preprocess_session_from_json
from preprocessing_inference import create_windows_inference


def run_full_knn_pipeline(sensor_json):

    classification_result = run_classification(sensor_json)

    road_type = classification_result["road_type"]
    session_id = classification_result["session_id"]
    predicted_labels = classification_result["predicted_labels"]

    df = preprocess_session_from_json(sensor_json)

    stride = 240 if road_type.lower() == "motorway" else 260
    windows = create_windows_inference(df, 2400, stride)

    if windows.shape[0] == 0:
        raise ValueError("Not enough data for windowing")

    _, _, knn_feature_cols, _ = load_knn_components(road_type)

    knn_feature_df = create_knn_ready_windows_inference(
        windows,
        knn_feature_cols
    )

    knn_feature_df["session_id"] = session_id
    knn_feature_df["window_id"] = list(range(len(knn_feature_df)))
    knn_feature_df["predicted_label"] = predicted_labels

    window_results = run_knn_alerts(knn_feature_df, road_type)

    # Convert to DataFrame for summary calculations
    result_df = pd.DataFrame(window_results)

    session_summary = build_session_summary(
        result_df,
        road_type,
        session_id
    )

    return {
        "session_summary": session_summary,
        "windows": window_results
    }


# ============================================================
# Local Test
# ============================================================

if __name__ == "__main__":

    with open("test_session.json", "r") as f:
        sensor_json = json.load(f)

    result = run_full_knn_pipeline(sensor_json)

    print("\nSESSION SUMMARY:")
    print(result["session_summary"])

    print("\nWINDOW RESULTS:")
import json
print(json.dumps(result["windows"][:5], indent=4))