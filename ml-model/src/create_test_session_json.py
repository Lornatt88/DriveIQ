import pandas as pd  
import json  

folder = "C:\\Users\\lorna\\OneDrive\\Desktop\\DriveIQ\\ml-model\\notebooks\\data\\D5-Aggressive-motor"  

import os

folder_name = os.path.basename(folder).lower()

if "motor" in folder_name:
    road_type = "Motorway"
elif "secondary" in folder_name:
    road_type = "Secondary"
else:
    raise ValueError("Cannot detect road type from folder name")

# Extract session id dynamically (example: D5)
if folder_name.startswith("d"):
    session_id = int(folder_name.split("-")[0][1:])
else:
    session_id = 0

sensor_json = {
    "session_id": session_id,
    "road_type": road_type,
    
    "gps": pd.read_csv(
        f"{folder}/RAW_GPS.txt",
        sep=r"\s+",
        header=None
    ).to_dict(orient="records"),

    "accelerometer": pd.read_csv(
        f"{folder}/RAW_ACCELEROMETERS.txt",
        sep=r"\s+",
        header=None
    ).to_dict(orient="records"),

    "lane": pd.read_csv(
        f"{folder}/PROC_LANE_DETECTION.txt",
        sep=r"\s+",
        header=None
    ).to_dict(orient="records"),

    "vehicle": pd.read_csv(
        f"{folder}/PROC_VEHICLE_DETECTION.txt",
        sep=r"\s+",
        header=None
    ).to_dict(orient="records"),

    "osm": pd.read_csv(
        f"{folder}/PROC_OPENSTREETMAP_DATA.txt",
        sep=r"\s+",
        header=None
    ).to_dict(orient="records"),
}

with open("test_session.json", "w") as f:  
    json.dump(sensor_json, f, indent=4)