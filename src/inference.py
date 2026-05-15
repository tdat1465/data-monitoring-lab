import os
import sys
import pandas as pd
from pathlib import Path
import joblib

def find_project_dir() -> Path:
    candidates = [
        Path.cwd(),
        Path.cwd() / "Data Collection + Processing",
        Path.cwd().parent / "Data Collection + Processing",
    ]
    for candidate in candidates:
        if (candidate / "db_utils.py").exists():
            if str(candidate) not in sys.path:
                sys.path.insert(0, str(candidate))
            return candidate
    
    if Path.cwd().name == "src":
        p = Path.cwd().parent / "Data Collection + Processing"
        if (p / "db_utils.py").exists():
            if str(p) not in sys.path:
                sys.path.insert(0, str(p))
            return p
            
    raise FileNotFoundError("Khong tim thay db_utils.py")

def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        existing = os.environ.get(key)
        if existing is None or existing.strip() == "":
            os.environ[key] = value

project_dir = find_project_dir()
load_env_file(project_dir.parent / ".env")

from db_utils import load_table, save_dataframe
from processing import ensure_table_has_columns

def run_inference():
    print("Loading current snapshot data...")
    try:
        flights_current = load_table("flights_current_snapshot")
    except Exception as e:
        print(f"Error loading flights_current_snapshot. Make sure processing.py has run successfully. Error: {e}")
        return
    
    if flights_current.empty:
        print("No flights data available for inference.")
        return

    # Filter out flights that have already completed or cancelled to avoid unnecessary predictions
    # Actually, we can predict for all and just update the dashboard. 
    # But let's only predict for active/upcoming flights.
    active_mask = flights_current["status_group"].isin(["unknown", "enroute", "on_time", "delayed", "other"])
    df_to_predict = flights_current[active_mask].copy()

    if df_to_predict.empty:
        print("No active flights to predict.")
        return

    # Ensure correct types for numeric columns that might have been loaded as string
    numeric_cols = [
        "temperature_c", "dew_point_c", "wind_direction_deg", "wind_speed_kt", 
        "visibility_miles", "scheduled_hour", "scheduled_dayofweek", "scheduled_month", 
        "minutes_to_departure_at_snapshot", "temp_dew_spread", "is_low_visibility", 
        "is_wind_variable", "is_estimated_missing", "flight_num_only",
        "is_high_wind", "fog_risk", "cloud_severity",
        "weather_severity_index", "airport_hourly_congestion", "is_rush_hour",
        "is_trunk_route",
        "route_delay_rate", "airline_historical_delay_rate", 
        "airport_congestion_2h", "rolling_delay_rate_2h",
        "sin_hour", "cos_hour"
    ]
    for col in numeric_cols:
        if col in df_to_predict.columns:
            df_to_predict[col] = pd.to_numeric(df_to_predict[col], errors="coerce")

    print(f"Running inference for {len(df_to_predict)} flights...")

    model_path = project_dir.parent / "Data Modeling" / "artifacts" / "delay_model.joblib"
    if not model_path.exists():
        print(f"Model file not found at {model_path}")
        return
        
    try:
        artifact = joblib.load(model_path)
    except Exception as e:
        print(f"Failed to load model: {e}")
        return

    is_two_stage = False
    model = None
    feature_cols = None

    if isinstance(artifact, dict):
        if "classifier" in artifact and "regressor" in artifact:
            is_two_stage = True
            clf = artifact["classifier"]
            reg = artifact["regressor"]
            threshold = artifact.get("threshold", 0.5)
            feature_cols = artifact.get("feature_cols")
        else:
            model = (
                artifact.get("model")
                or artifact.get("best_pipe")
                or artifact.get("pipeline")
                or artifact.get("estimator")
            )
            feature_cols = (
                artifact.get("feature_cols")
                or artifact.get("features")
                or artifact.get("columns")
            )
            if model is None:
                for value in artifact.values():
                    if hasattr(value, "predict"):
                        model = value
                        break
    else:
        model = artifact

    if not is_two_stage and model is None:
        if isinstance(artifact, dict):
            print(f"Model artifact has no model-like object. Keys: {list(artifact.keys())}")
        else:
            print("Model artifact is not a valid model object.")
        return

    if feature_cols:
        missing_cols = [c for c in feature_cols if c not in df_to_predict.columns]
        for col in missing_cols:
            df_to_predict[col] = pd.NA
        predict_frame = df_to_predict[feature_cols].copy()
    else:
        predict_frame = df_to_predict

    try:
        if is_two_stage:
            import numpy as np
            prob = clf.predict_proba(predict_frame)[:, 1]
            reg_pred = reg.predict(predict_frame)
            predictions = np.where(prob >= threshold, reg_pred, 0.0)
        else:
            predictions = model.predict(predict_frame)
    except Exception as e:
        print(f"Error during model prediction: {e}")
        return

    df_to_predict["predict_delay_minutes"] = predictions

    predictions_table = df_to_predict[["flight_key", "predict_delay_minutes"]].copy()
    
    ensure_table_has_columns("flights_predictions", predictions_table)
    
    # Save predictions to PostgreSQL
    inserted = save_dataframe(predictions_table, table_name="flights_predictions", unique_cols=["flight_key"])
    
    print(f"Saved {inserted} predictions to flights_predictions table.")

if __name__ == "__main__":
    run_inference()
