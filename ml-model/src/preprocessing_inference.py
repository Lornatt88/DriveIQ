import json
import pandas as pd
import numpy as np
from sklearn.impute import KNNImputer


# =====================================================
# STEP 1: Build unified 10Hz timeline (paper-compliant)
# =====================================================

def build_10hz_timebase(max_timestamp_sec):
    """
    Creates a 10Hz timeline from t=0 to t=max_timestamp_sec
    """
    t_10hz = pd.DataFrame({
        "t_10hz": range(0, int(max_timestamp_sec * 10) + 1)
    })
    t_10hz["timestamp"] = t_10hz["t_10hz"] / 10.0
    return t_10hz


# =====================================================
# STEP 2: Preprocess ONE session from JSON
# =====================================================

def preprocess_session_from_json(sensor_json):
    """
    Preprocess one driving session from JSON input.
    This is the function your backend will call.
    """

    # =====================================================
    # RAW_GPS (1 Hz → 10 Hz)
    # =====================================================
    gps = pd.DataFrame(sensor_json["gps"])
    gps.columns = [
        "timestamp", "speed_kmh", "lat", "lon", "alt",
        "vert_acc", "horiz_acc", "course", "difcourse",
        "hdop", "vdop", "pdop"
    ]

    # Ensure numeric timestamps
    gps["timestamp"] = pd.to_numeric(gps["timestamp"], errors="coerce")

    max_time = gps["timestamp"].max()
    timebase_10hz = build_10hz_timebase(max_time)

    # Sort before merge_asof
    gps = gps.sort_values("timestamp")
    timebase_10hz = timebase_10hz.sort_values("timestamp")

    gps_10hz = pd.merge_asof(
        timebase_10hz,
        gps,
        on="timestamp",
        direction="backward"
    )

    # =====================================================
    # RAW_ACCELEROMETERS (already 10 Hz)
    # =====================================================
    acc = pd.DataFrame(sensor_json["accelerometer"])
    acc.columns = [
        "timestamp", "active",
        "acc_x", "acc_y", "acc_z",
        "acc_x_kf", "acc_y_kf", "acc_z_kf",
        "roll", "pitch", "yaw"
    ]

    acc["timestamp"] = pd.to_numeric(acc["timestamp"], errors="coerce")
    acc = acc.sort_values("timestamp")

    acc_10hz = pd.merge_asof(
        timebase_10hz,
        acc,
        on="timestamp",
        direction="nearest"
    )

    # =====================================================
    # PROC_LANE_DETECTION (~30 Hz → 10 Hz)
    # =====================================================
    lane = pd.DataFrame(sensor_json["lane"])
    lane.columns = [
        "timestamp", "x_lane", "phi", "road_width", "lane_state"
    ]

    lane["timestamp"] = pd.to_numeric(lane["timestamp"], errors="coerce")
    lane = lane.sort_values("timestamp")

    lane_10hz = pd.merge_asof(
        timebase_10hz,
        lane,
        on="timestamp",
        direction="nearest"
    )

    # =====================================================
    # PROC_VEHICLE_DETECTION (~10 Hz)
    # =====================================================
    veh = pd.DataFrame(sensor_json["vehicle"])
    veh.columns = [
        "timestamp", "dist_front", "ttc_front",
        "num_vehicles", "gps_speed"
    ]

    veh["timestamp"] = pd.to_numeric(veh["timestamp"], errors="coerce")
    veh = veh.sort_values("timestamp")

    veh_10hz = pd.merge_asof(
        timebase_10hz,
        veh,
        on="timestamp",
        direction="nearest"
    )

    # =====================================================
    # PROC_OPENSTREETMAP_DATA (~1 Hz → 10 Hz)
    # =====================================================
    osm = pd.DataFrame(sensor_json["osm"])
    osm.columns = [
        "timestamp", "max_speed", "speed_rel",
        "road_type_osm", "num_lanes", "lane_id",
        "lat_osm", "lon_osm", "osm_delay", "gps_speed_osm"
    ]

    osm["timestamp"] = pd.to_numeric(osm["timestamp"], errors="coerce")
    osm = osm.sort_values("timestamp")

    osm_10hz = pd.merge_asof(
        timebase_10hz,
        osm,
        on="timestamp",
        direction="backward"
    )

    # =====================================================
    # MERGE ALL STREAMS (10 Hz aligned)
    # =====================================================
    data = gps_10hz.copy()

    for df in [acc_10hz, lane_10hz, veh_10hz, osm_10hz]:
        data = data.merge(df, on=["timestamp", "t_10hz"], how="left")

    # Keep time columns first
    cols = ["t_10hz", "timestamp"] + [
        c for c in data.columns if c not in ["t_10hz", "timestamp"]
    ]
    data = data[cols]

    # =====================================================
    # FEATURE ENGINEERING (must match training)
    # =====================================================

    # Avoid division by zero
    data["speed_ratio"] = np.where(
        data["max_speed"] > 0,
        data["speed_kmh"] / data["max_speed"],
        0
    )

    # =====================================================
    # KNN IMPUTATION (paper-compliant)
    # =====================================================

    exclude_cols = [
        "t_10hz",
        "timestamp",
        "road_type_osm"  # categorical
    ]

    feature_cols = [c for c in data.columns if c not in exclude_cols]

    X = data[feature_cols]

    print("NaNs before KNN:")
    print(X.isna().sum().sort_values(ascending=False).head(10))

    imputer = KNNImputer(
        n_neighbors=5,
        weights="distance"
    )

    X_imputed = pd.DataFrame(
        imputer.fit_transform(X),
        columns=feature_cols
    )

    # Put imputed values back
    data_imputed = data.copy()
    data_imputed[feature_cols] = X_imputed

    print("\nNaNs after KNN:")
    print(data_imputed[feature_cols].isna().sum().sum())

    # =====================================================
    # ENFORCE TRAINING FEATURE ORDER
    # =====================================================

    with open("../models/feature_schema.json", "r") as f:        schema = json.load(f)

    feature_order = schema["feature_order"]

    data_final = data_imputed[feature_order]

    print("Final shape:", data_final.shape)
    return data_final


# =====================================================
# WINDOWING FOR INFERENCE
# =====================================================

import numpy as np

def create_windows_inference(df, window_size=2400, stride=240):
    data = df.values
    n_rows = data.shape[0]

    windows = []

    for start in range(0, n_rows - window_size + 1, stride):
        end = start + window_size
        window = data[start:end]
        windows.append(window)

    if len(windows) == 0:
        return np.empty((0, window_size, df.shape[1]))

    return np.array(windows)




import joblib

def scale_windows(windows, scaler_path):
    """
    Scale 3D window array using saved scaler.
    """
    if windows.shape[0] == 0:
        return windows

    original_shape = windows.shape  # (n_windows, 2400, 39)

    # reshape to 2D
    reshaped = windows.reshape(-1, original_shape[-1])

    # load scaler
    scaler = joblib.load(scaler_path)

    # transform
    scaled = scaler.transform(reshaped)

    # reshape back
    scaled = scaled.reshape(original_shape)

    return scaled


from tensorflow.keras.models import load_model

def predict_windows(windows, model_path):
    """
    Run model prediction on 3D windows.
    """
    if windows.shape[0] == 0:
        return None

    model = load_model(model_path)

    preds = model.predict(windows)

    return preds


import numpy as np

def get_predicted_classes(predictions):
    """
    Convert softmax probabilities to class indices.
    """
    if predictions is None:
        return None

    class_indices = np.argmax(predictions, axis=1)

    return class_indices





from collections import Counter

def map_classes_to_labels(class_indices):
    """
    Map numeric class indices to behavior labels.
    Make sure order matches training.
    """
    label_map = {
        0: "Aggressive",
        1: "Normal",
        2: "Drowsy"
    }

    return [label_map[int(i)] for i in class_indices]


def run_classification(sensor_json):
    """
    Full classification pipeline.
    Backend will call this function.
    """

    road_type = sensor_json.get("road_type")
    session_id = sensor_json.get("session_id")

    # 1️⃣ Preprocess
    df = preprocess_session_from_json(sensor_json)

    # 2️⃣ Choose correct model & scaler
    if road_type == "Motorway":
        stride = 240
        model_path = "../models/motor_model.keras"
        scaler_path = "../models/motor_scaler.pkl"
    elif road_type == "Secondary":
        stride = 260
        model_path = "../models/secondary_model.keras"
        scaler_path = "../models/secondary_scaler.pkl"
    else:
        raise ValueError("Unknown road type")

    # 3️⃣ Windowing
    windows = create_windows_inference(df, 2400, stride)

    if windows.shape[0] == 0:
        return {
            "session_id": session_id,
            "error": "Not enough data for windowing"
        }

    # 4️⃣ Scaling
    scaled_windows = scale_windows(windows, scaler_path)

    # 5️⃣ Predict
    predictions = predict_windows(scaled_windows, model_path)

    # 6️⃣ Convert to labels
    class_indices = get_predicted_classes(predictions)
    predicted_labels = map_classes_to_labels(class_indices)

    # 7️⃣ Session summary
    counts = Counter(predicted_labels)

    return {
        "session_id": session_id,
        "road_type": road_type,
        "scaled_windows": scaled_windows,
        "predicted_labels": predicted_labels
    }


# =====================================================
# LOCAL TEST BLOCK (SAFE TO KEEP)
# =====================================================

if __name__ == "__main__":
    with open("test_session.json", "r") as f:
        sensor_json = json.load(f)

    result = run_classification(sensor_json)

    print("\nFinal Classification Output:")
    print(result)