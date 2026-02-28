"""
Phase 3: Intelligent Driving Alert System
==========================================
Improved version with:
- Separation of behavioral vs contextual features
- Clean JSON output format for application integration
- Enhanced recommendations using context
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
from sklearn.cluster import KMeans
import json
from datetime import datetime

# ============================================================================
# CONFIGURATION
# ============================================================================

NORMAL_LABEL = 2

# Behavioral features - used in the model
BEHAVIORAL_FEATURES = [
    'speed_kmh_mean', 'speed_ratio_mean', 'speed_rel_mean',
    'difcourse_mean',
    'acc_x_mean', 'acc_y_mean', 'acc_z_mean',
    'acc_x_kf_mean', 'acc_y_kf_mean', 'acc_z_kf_mean',
    'pitch_mean', 'roll_mean', 'yaw_mean',
    'dist_front_mean', 'ttc_front_mean', 'num_vehicles_mean',
    'x_lane_mean', 'phi_mean', 'active_mean'
]

# Contextual features - kept for explanations but NOT in model
CONTEXTUAL_FEATURES = [
    'max_speed_mean', 'num_lanes_mean', 'road_width_mean',
    'lat_mean', 'lon_mean', 'alt_mean',
    'lat_osm_mean', 'lon_osm_mean',
    'hdop_mean', 'vdop_mean', 'horiz_acc_mean', 'vert_acc_mean',
    'osm_delay_mean', 'course_mean',
    'gps_speed_mean', 'gps_speed_osm_mean'
]

# Cause groupings for explainability
CAUSE_GROUPS = {
    "Overspeed": ['speed_kmh_mean', 'speed_ratio_mean', 'speed_rel_mean'],
    "Tailgating": ['dist_front_mean', 'ttc_front_mean', 'num_vehicles_mean'],
    "Harsh maneuvers": ['acc_x_mean', 'acc_y_mean', 'acc_z_mean', 
                        'acc_x_kf_mean', 'acc_y_kf_mean', 'acc_z_kf_mean'],
    "Unstable steering": ['difcourse_mean', 'yaw_mean']
}

# Alert messages
ALERT_MESSAGES = {
    "Overspeed": "Reduce speed and maintain safe limits",
    "Tailgating": "Increase following distance for safety",
    "Harsh maneuvers": "Drive more smoothly to avoid sudden movements",
    "Unstable steering": "Maintain steady control and avoid sudden lane changes"
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def filter_available_features(feature_list, available_cols):
    """Return only features that exist in the dataframe"""
    return [f for f in feature_list if f in available_cols]

def filter_data_quality(df, hdop_threshold=5.0, vdop_threshold=5.0):
    """Optional: Filter out windows with poor GPS quality"""
    if 'hdop_mean' in df.columns and 'vdop_mean' in df.columns:
        before = len(df)
        df = df[(df['hdop_mean'] < hdop_threshold) & 
                (df['vdop_mean'] < vdop_threshold)].copy()
        after = len(df)
        print(f"GPS quality filter: {before} -> {after} windows ({before-after} removed)")
    return df

def compute_knn_distance(row, scaler, knn, feature_cols):
    """Compute KNN distance for a single row"""
    row_df = row[feature_cols].to_frame().T
    row_scaled = scaler.transform(row_df)
    distances, _ = knn.kneighbors(row_scaled)
    return distances.mean()

# ============================================================================
# FUZZY LOGIC SYSTEM
# ============================================================================

def triangular_mf(x, a, b, c):
    """Triangular membership function"""
    if x < a or x > c: 
        return 0.0
    if x == b: 
        return 1.0
    if a <= x < b:
        return 0.0 if b == a else (x - a) / (b - a)
    return 0.0 if c == b else (c - x) / (c - b)

def trapezoidal_mf(x, a, b, c, d):
    """Trapezoidal membership function"""
    if x < a or x > d: 
        return 0.0
    if b <= x <= c: 
        return 1.0
    if a <= x < b:
        return 0.0 if b == a else (x - a) / (b - a)
    return 0.0 if d == c else (d - x) / (d - c)

def fuzzify_inputs(severity, percentage):
    """Fuzzify severity and percentage into membership degrees"""
    return {
        "s_low":  trapezoidal_mf(severity, 0.0, 0.0, 0.2, 0.4),
        "s_med":  triangular_mf(severity, 0.3, 0.6, 0.85),
        "s_high": trapezoidal_mf(severity, 0.7, 0.85, 1.0, 1.0),
        "p_small": trapezoidal_mf(percentage, 0.0, 0.0, 0.15, 0.30),
        "p_med":   triangular_mf(percentage, 0.25, 0.45, 0.65),
        "p_dom":   trapezoidal_mf(percentage, 0.45, 0.60, 1.0, 1.0)
    }

def tsk_output(weights, outputs):
    """Takagi-Sugano-Kang defuzzification"""
    w = np.array(weights, dtype=float)
    y = np.array(outputs, dtype=float)
    return float((w*y).sum() / w.sum()) if w.sum() > 0 else 0.0

def compute_intensity(severity, percentage):
    """Compute fuzzy intensity for a cause"""
    m = fuzzify_inputs(severity, percentage)
    w1 = m["s_high"] * m["p_dom"]   # High severity + dominant cause -> 0.95
    w2 = m["s_med"]  * m["p_dom"]   # Medium severity + dominant -> 0.80
    w3 = m["s_high"] * m["p_med"]   # High severity + medium cause -> 0.60
    w4 = m["p_small"]               # Small contribution -> 0.10
    return tsk_output([w1, w2, w3, w4], [0.95, 0.80, 0.60, 0.10])

# ============================================================================
# CORE ANALYSIS FUNCTIONS
# ============================================================================

def train_anomaly_detector(df, feature_cols, label_col='label', n_neighbors=5):
    """Train KNN anomaly detector on NORMAL windows only"""
    normal_df = df[df[label_col] == NORMAL_LABEL].copy()
    print(f"Training on {len(normal_df)} NORMAL windows with {len(feature_cols)} features")
    
    scaler = StandardScaler()
    normal_scaled = scaler.fit_transform(normal_df[feature_cols])
    
    knn = NearestNeighbors(n_neighbors=n_neighbors, metric='euclidean')
    knn.fit(normal_scaled)
    
    return scaler, knn, normal_df

def detect_anomalies(df, scaler, knn, feature_cols):
    """Compute KNN distances and identify anomalies"""
    df = df.copy()
    
    # Compute KNN distance for all windows
    df['knn_distance'] = df.apply(
        lambda row: compute_knn_distance(row, scaler, knn, feature_cols),
        axis=1
    )
    
    # Set threshold based on normal windows
    normal_dist = df[df['label'] == NORMAL_LABEL]['knn_distance']
    threshold = normal_dist.mean() + 2 * normal_dist.std()
    
    # Identify anomalies
    df['is_anomaly'] = df['knn_distance'] > threshold
    
    print(f"Threshold: {threshold:.3f}")
    print(f"Anomalies detected: {df['is_anomaly'].sum()} / {len(df)} windows")
    
    return df, threshold

def cluster_anomalies(df, scaler, feature_cols, n_clusters=3):
    """Cluster anomalous windows to identify behavior types"""
    anomalies = df[df['is_anomaly']].copy()
    
    if len(anomalies) < n_clusters:
        print(f"Warning: Only {len(anomalies)} anomalies, cannot cluster into {n_clusters} groups")
        return df
    
    # Scale and cluster
    X = scaler.transform(anomalies[feature_cols])
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(X)
    
    # Assign clusters back to dataframe
    df['cluster'] = np.nan
    df.loc[anomalies.index, 'cluster'] = clusters
    
    print(f"Clustered into {n_clusters} behavior types")
    return df, kmeans

def label_clusters(df, feature_cols):
    """Assign behavioral labels to clusters"""
    cluster_summary = df[df['cluster'].notna()].groupby('cluster')[feature_cols].mean()
    
    # Compute scores for each cluster
    cluster_summary['overspeed_score'] = (
        cluster_summary['speed_kmh_mean'].rank() +
        cluster_summary['speed_ratio_mean'].rank()
    )
    
    harsh_cols = [c for c in ['acc_x_mean', 'acc_y_mean', 'acc_z_mean'] if c in cluster_summary.columns]
    if harsh_cols:
        cluster_summary['harsh_score'] = cluster_summary[harsh_cols].abs().sum(axis=1).rank()
    else:
        cluster_summary['harsh_score'] = 0
    
    if 'difcourse_mean' in cluster_summary.columns:
        cluster_summary['unstable_score'] = cluster_summary['difcourse_mean'].rank()
    else:
        cluster_summary['unstable_score'] = 0
    
    tailgate_cols = [c for c in ['dist_front_mean', 'ttc_front_mean'] if c in cluster_summary.columns]
    if tailgate_cols:
        cluster_summary['tailgate_score'] = (
            -cluster_summary['dist_front_mean'].rank() +  # Lower distance = worse
            -cluster_summary['ttc_front_mean'].rank()      # Lower TTC = worse
        )
    else:
        cluster_summary['tailgate_score'] = 0
    
    # Assign labels based on dominant score
    cluster_labels = {}
    for cluster_id, row in cluster_summary.iterrows():
        scores = {
            'Overspeed': row['overspeed_score'],
            'Harsh maneuvers': row['harsh_score'],
            'Unstable steering': row['unstable_score'],
            'Tailgating': row['tailgate_score']
        }
        cluster_labels[cluster_id] = max(scores, key=scores.get)
    
    df['alert_type'] = df['cluster'].map(cluster_labels)
    
    return df, cluster_labels

def compute_feature_contributions(df, scaler, feature_cols):
    """Compute how much each feature contributes to anomaly"""
    # Z-scores (standardized deviations from normal)
    Z = pd.DataFrame(
        scaler.transform(df[feature_cols]),
        columns=feature_cols,
        index=df.index
    )
    
    # Squared deviations
    contrib = Z ** 2
    
    # Normalize to percentages per window
    contrib_norm = contrib.div(contrib.sum(axis=1).replace(0, np.nan), axis=0).fillna(0)
    
    return contrib_norm

def compute_cause_contributions(contrib_norm, cause_groups):
    """Group feature contributions into cause categories"""
    causes = []
    
    for idx, row in contrib_norm.iterrows():
        cause_dict = {}
        for cause, features in cause_groups.items():
            available_features = [f for f in features if f in row.index]
            if available_features:
                cause_dict[cause] = float(row[available_features].sum())
        
        # Normalize to sum to 1
        total = sum(cause_dict.values())
        if total > 0:
            cause_dict = {k: v/total for k, v in cause_dict.items()}
        
        causes.append(cause_dict)
    
    return pd.Series(causes, index=contrib_norm.index)

def normalize_severity(knn_distance, q95, q99):
    """Normalize KNN distance to 0-1 severity scale"""
    if knn_distance <= q95:
        return 0.0
    if knn_distance >= q99:
        return 1.0
    return float((knn_distance - q95) / (q99 - q95))

# ============================================================================
# ALERT GENERATION
# ============================================================================

def generate_alert(row, threshold, q95, q99, cause_contributions, top_features):
    """Generate structured alert for a single window"""
    
    # Basic info
    knn_dist = float(row['knn_distance'])
    is_anomaly = knn_dist > threshold
    
    if not is_anomaly:
        return {
            'window_id': int(row.name),
            'alert_level': 'normal',
            'severity': 0.0,
            'knn_distance': round(knn_dist, 3),
            'message': 'Normal driving behavior',
            'causes': [],
            'recommendations': []
        }
    
    # Compute severity
    severity = normalize_severity(knn_dist, q95, q99)
    
    # Get cause contributions for this window
    causes_dict = cause_contributions.loc[row.name]
    
    # Compute fuzzy intensity for each cause
    cause_analysis = []
    for cause, percentage in causes_dict.items():
        intensity = compute_intensity(severity, percentage)
        cause_analysis.append({
            'cause': cause,
            'contribution': round(percentage * 100, 1),
            'intensity': round(intensity, 3)
        })
    
    # Sort by intensity
    cause_analysis.sort(key=lambda x: x['intensity'], reverse=True)
    top_causes = cause_analysis[:2]  # Top 2
    
    # Generate recommendations
    recommendations = []
    for c in top_causes:
        if c['intensity'] > 0.5:  # Only recommend for significant causes
            msg = ALERT_MESSAGES.get(c['cause'], f"Address {c['cause']}")
            recommendations.append({
                'cause': c['cause'],
                'message': msg,
                'priority': 'high' if c['intensity'] > 0.75 else 'medium'
            })
    
    # Add context-specific details
    context = {}
    if 'max_speed_mean' in row.index and pd.notna(row['max_speed_mean']):
        context['speed_limit'] = round(row['max_speed_mean'], 0)
        context['actual_speed'] = round(row['speed_kmh_mean'], 0)
        if context['actual_speed'] > context['speed_limit']:
            context['speed_excess'] = round(context['actual_speed'] - context['speed_limit'], 0)
    
    if 'num_lanes_mean' in row.index and pd.notna(row['num_lanes_mean']):
        context['num_lanes'] = round(row['num_lanes_mean'], 0)
    
    if 'dist_front_mean' in row.index and pd.notna(row['dist_front_mean']):
        context['following_distance'] = round(row['dist_front_mean'], 1)
    
    # Determine alert level
    if severity > 0.7:
        alert_level = 'critical'
    elif severity > 0.4:
        alert_level = 'warning'
    else:
        alert_level = 'caution'
    
    # Get top contributing features
    top_feat = top_features.loc[row.name].nlargest(6)
    top_features_list = [
        {'feature': feat, 'contribution': round(val * 100, 1)}
        for feat, val in top_feat.items()
    ]
    
    return {
        'window_id': int(row.name),
        'alert_level': alert_level,
        'severity': round(severity, 3),
        'knn_distance': round(knn_dist, 3),
        'primary_cause': top_causes[0]['cause'] if top_causes else 'Unknown',
        'causes': top_causes,
        'top_features': top_features_list,
        'recommendations': recommendations,
        'context': context,
        'timestamp': datetime.now().isoformat()
    }

# ============================================================================
# MAIN PIPELINE
# ============================================================================

def run_phase3_pipeline(df, road_type='motor', filter_gps=False):
    """
    Complete Phase 3 pipeline
    
    Args:
        df: DataFrame with features and labels
        road_type: 'motor' or 'secondary'
        filter_gps: Whether to filter poor GPS quality data
    
    Returns:
        df: Augmented dataframe
        alerts: List of alert dictionaries
        summary: Pipeline summary statistics
    """
    print(f"\n{'='*60}")
    print(f"Phase 3 Pipeline: {road_type.upper()} roads")
    print(f"{'='*60}\n")
    
    # Step 1: Filter features
    available_cols = df.columns.tolist()
    feature_cols = filter_available_features(BEHAVIORAL_FEATURES, available_cols)
    print(f"Using {len(feature_cols)} behavioral features (from {len(BEHAVIORAL_FEATURES)} requested)")
    
    # Step 2: Optional GPS quality filter
    if filter_gps:
        df = filter_data_quality(df)
    
    # Step 3: Train anomaly detector
    scaler, knn, normal_df = train_anomaly_detector(df, feature_cols)
    
    # Step 4: Detect anomalies
    df, threshold = detect_anomalies(df, scaler, knn, feature_cols)
    
    # Step 5: Cluster anomalies
    df, kmeans = cluster_anomalies(df, scaler, feature_cols, n_clusters=3)
    
    # Step 6: Label clusters
    df, cluster_labels = label_clusters(df, feature_cols)
    
    # Step 7: Compute feature contributions
    contrib_norm = compute_feature_contributions(df, scaler, feature_cols)
    
    # Step 8: Compute cause contributions
    filtered_cause_groups = {
        cause: [f for f in features if f in feature_cols]
        for cause, features in CAUSE_GROUPS.items()
    }
    filtered_cause_groups = {k: v for k, v in filtered_cause_groups.items() if v}
    
    cause_contributions = compute_cause_contributions(contrib_norm, filtered_cause_groups)
    
    # Step 9: Compute quantiles for severity normalization
    normal_dist = df[df['label'] == NORMAL_LABEL]['knn_distance']
    q95 = normal_dist.quantile(0.95)
    q99 = normal_dist.quantile(0.99)
    
    # Step 10: Generate alerts for all windows
    alerts = []
    for idx, row in df.iterrows():
        alert = generate_alert(row, threshold, q95, q99, cause_contributions, contrib_norm)
        alerts.append(alert)
    
    # Summary statistics
    summary = {
        'road_type': road_type,
        'total_windows': len(df),
        'normal_windows': int((~df['is_anomaly']).sum()),
        'anomalous_windows': int(df['is_anomaly'].sum()),
        'threshold': round(threshold, 3),
        'alert_distribution': {
            'normal': len([a for a in alerts if a['alert_level'] == 'normal']),
            'caution': len([a for a in alerts if a['alert_level'] == 'caution']),
            'warning': len([a for a in alerts if a['alert_level'] == 'warning']),
            'critical': len([a for a in alerts if a['alert_level'] == 'critical'])
        },
        'behavioral_features_used': feature_cols,
        'cluster_labels': cluster_labels
    }
    
    print(f"\n{'='*60}")
    print("Pipeline Complete")
    print(f"{'='*60}")
    print(f"Total windows: {summary['total_windows']}")
    print(f"Normal: {summary['normal_windows']}")
    print(f"Anomalies: {summary['anomalous_windows']}")
    print(f"Alert distribution: {summary['alert_distribution']}")
    
    return df, alerts, summary

# ============================================================================
# OUTPUT FORMATTING
# ============================================================================

def save_alerts_json(alerts, output_path):
    """Save alerts to JSON file"""
    with open(output_path, 'w') as f:
        json.dump(alerts, f, indent=2)
    print(f"\nAlerts saved to: {output_path}")

def print_alert_summary(alerts, top_n=10):
    """Print human-readable summary of alerts"""
    print(f"\n{'='*60}")
    print(f"ALERT SUMMARY (Top {top_n} Critical/Warning)")
    print(f"{'='*60}\n")
    
    # Filter and sort
    critical_alerts = [a for a in alerts if a['alert_level'] in ['critical', 'warning']]
    critical_alerts.sort(key=lambda x: x['severity'], reverse=True)
    
    for alert in critical_alerts[:top_n]:
        print(f"Window #{alert['window_id']} - {alert['alert_level'].upper()}")
        print(f"  Severity: {alert['severity']:.3f} | KNN Distance: {alert['knn_distance']:.3f}")
        print(f"  Primary Cause: {alert['primary_cause']}")
        
        if alert.get('context'):
            ctx = alert['context']
            if 'speed_excess' in ctx:
                print(f"  Context: {ctx['actual_speed']:.0f} km/h in {ctx['speed_limit']:.0f} km/h zone (+{ctx['speed_excess']:.0f} km/h)")
            if 'following_distance' in ctx:
                print(f"  Following Distance: {ctx['following_distance']:.1f} m")
        
        print("  Top Causes:")
        for cause in alert['causes']:
            print(f"    - {cause['cause']}: {cause['contribution']}% (intensity: {cause['intensity']:.3f})")
        
        print("  Recommendations:")
        for rec in alert['recommendations']:
            priority_icon = "🔴" if rec['priority'] == 'high' else "🟡"
            print(f"    {priority_icon} {rec['message']}")
        print()

# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    # Load data
    print("Loading data...")
    motor_df = pd.read_csv("data/motor_window_features.csv")
    secondary_df = pd.read_csv("data/secondary_window_features.csv")
    
    # Process motor roads
    motor_df, motor_alerts, motor_summary = run_phase3_pipeline(
        motor_df, 
        road_type='motor',
        filter_gps=False
    )
    
    # Process secondary roads
    secondary_df, secondary_alerts, secondary_summary = run_phase3_pipeline(
        secondary_df,
        road_type='secondary', 
        filter_gps=False
    )
    
    # Save outputs
    save_alerts_json(motor_alerts, 'motor_alerts.json')
    save_alerts_json(secondary_alerts, 'secondary_alerts.json')
    
    # Print summaries
    print_alert_summary(motor_alerts, top_n=10)
    print_alert_summary(secondary_alerts, top_n=10)
    
    # Save summary
    combined_summary = {
        'motor': motor_summary,
        'secondary': secondary_summary,
        'generated_at': datetime.now().isoformat()
    }
    with open('pipeline_summary.json', 'w') as f:
        json.dump(combined_summary, f, indent=2)
    
    print("\n✅ Phase 3 pipeline complete!")
    print("Generated files:")
    print("  - motor_alerts.json")
    print("  - secondary_alerts.json")
    print("  - pipeline_summary.json")
