from typing import List, Tuple
import numpy as np
import pandas as pd


def make_windows(
    df: pd.DataFrame,
    feature_cols: List[str],
    window_size: int,
    road_type: str
) -> Tuple[np.ndarray, List[int]]:
    """
    Builds windows for inference.

    Returns:
      X: (num_windows, window_size, num_features)
      idxs: window start indices
    """

    # ---------------------------------------
    # STRIDE MUST MATCH TRAINING
    # ---------------------------------------
    road = (road_type or "").strip().lower()

    if road in ["motor", "motorway", "highway"]:
        stride = 240
    else:
        stride = 260

    # Ensure required feature columns exist
    for c in feature_cols:
        if c not in df.columns:
            df[c] = 0.0

    x = df[feature_cols].astype("float32").to_numpy()
    n = len(x)

    windows = []
    idxs = []

    for start in range(0, n - window_size + 1, stride):
        end = start + window_size
        windows.append(x[start:end])
        idxs.append(start)

    if not windows:
        return np.zeros((0, window_size, len(feature_cols)), dtype="float32"), []

    return np.stack(windows, axis=0), idxs