import os
import sys
import re
import numpy as np
import pandas as pd
from pathlib import Path

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

DELAY_THRESHOLD_MINUTES = 15
TRAINING_SNAPSHOT_LEAD_MINUTES = 30

def normalize_space(x):
    if pd.isna(x):
        return np.nan
    return re.sub(r"\s+", " ", str(x)).strip()

def normalize_flight_number(x):
    if pd.isna(x):
        return np.nan
    s = normalize_space(x).upper().replace(" ", "")
    s = s.replace("-", "")
    return s

def normalize_route_airport(x):
    if pd.isna(x):
        return np.nan
    s = normalize_space(x).upper()
    accent_map = str.maketrans({
        "À": "A", "Á": "A", "Ả": "A", "Ã": "A", "Ạ": "A",
        "Ă": "A", "Ằ": "A", "Ắ": "A", "Ẳ": "A", "Ẵ": "A", "Ặ": "A",
        "Â": "A", "Ầ": "A", "Ấ": "A", "Ẩ": "A", "Ẫ": "A", "Ậ": "A",
        "Đ": "D",
        "È": "E", "É": "E", "Ẻ": "E", "Ẽ": "E", "Ẹ": "E",
        "Ê": "E", "Ề": "E", "Ế": "E", "Ể": "E", "Ễ": "E", "Ệ": "E",
        "Ì": "I", "Í": "I", "Ỉ": "I", "Ĩ": "I", "Ị": "I",
        "Ò": "O", "Ó": "O", "Ỏ": "O", "Õ": "O", "Ọ": "O",
        "Ô": "O", "Ồ": "O", "Ố": "O", "Ổ": "O", "Ỗ": "O", "Ộ": "O",
        "Ơ": "O", "Ờ": "O", "Ớ": "O", "Ở": "O", "Ỡ": "O", "Ợ": "O",
        "Ù": "U", "Ú": "U", "Ủ": "U", "Ũ": "U", "Ụ": "U",
        "Ư": "U", "Ừ": "U", "Ứ": "U", "Ử": "U", "Ữ": "U", "Ự": "U",
        "Ỳ": "Y", "Ý": "Y", "Ỷ": "Y", "Ỹ": "Y", "Ỵ": "Y",
    })
    s = s.translate(accent_map)
    s = re.sub(r"\s+", " ", s).strip()
    replacements = {
        "TP. HO CHI MINH": "HO CHI MINH",
        "HO CHI MINH": "HO CHI MINH",
        "HA NOI": "HA NOI",
        "DA NANG": "DA NANG",
        "BUON MA THUOT": "BUON MA THUOT",
        "CAN THO": "CAN THO",
        "HAI PHONG": "HAI PHONG",
        "THANH HOA": "THANH HOA",
        "PHU QUOC": "PHU QUOC",
        "CON DAO": "CON DAO",
        "QUY NHON": "QUY NHON",
        "HUE": "HUE",
        "NHA TRANG": "NHA TRANG",
        "PLEIKU": "PLEIKU",
        "CHU LAI": "CHU LAI",
        "CAM RANH": "CAM RANH",
        "VINH": "VINH",
    }
    for old_text, new_text in replacements.items():
        s = s.replace(old_text, new_text)
    s = re.sub(r"\s*\(([^)]+)\)", lambda m: f" ({m.group(1).upper()})", s)
    return s

status_map = {
    "da ha canh": "landed",
    "arrived": "landed",
    "landed": "landed",
    "den tre": "delayed",
    "cham": "delayed",
    "delayed": "delayed",
    "dang bay": "enroute",
    "on time": "on_time",
    "dung gio": "on_time",
    "khoi hanh": "departed",
    "departed": "departed",
    "huy": "cancelled",
    "cancelled": "cancelled",
}

def normalize_status(status_text):
    s = normalize_space(status_text)
    if pd.isna(s) or s == "":
        return "unknown"
    s_ascii = (
        s.lower()
        .replace("đ", "d")
        .replace("á", "a").replace("à", "a").replace("ả", "a").replace("ã", "a").replace("ạ", "a")
        .replace("ă", "a").replace("ắ", "a").replace("ằ", "a").replace("ẳ", "a").replace("ẵ", "a").replace("ặ", "a")
        .replace("â", "a").replace("ấ", "a").replace("ầ", "a").replace("ẩ", "a").replace("ẫ", "a").replace("ậ", "a")
        .replace("é", "e").replace("è", "e").replace("ẻ", "e").replace("ẽ", "e").replace("ẹ", "e")
        .replace("ê", "e").replace("ế", "e").replace("ề", "e").replace("ể", "e").replace("ễ", "e").replace("ệ", "e")
        .replace("í", "i").replace("ì", "i").replace("ỉ", "i").replace("ĩ", "i").replace("ị", "i")
        .replace("ó", "o").replace("ò", "o").replace("ỏ", "o").replace("õ", "o").replace("ọ", "o")
        .replace("ô", "o").replace("ố", "o").replace("ồ", "o").replace("ổ", "o").replace("ỗ", "o").replace("ộ", "o")
        .replace("ơ", "o").replace("ớ", "o").replace("ờ", "o").replace("ở", "o").replace("ỡ", "o").replace("ợ", "o")
        .replace("ú", "u").replace("ù", "u").replace("ủ", "u").replace("ũ", "u").replace("ụ", "u")
        .replace("ư", "u").replace("ứ", "u").replace("ừ", "u").replace("ử", "u").replace("ữ", "u").replace("ự", "u")
        .replace("ý", "y").replace("ỳ", "y").replace("ỷ", "y").replace("ỹ", "y").replace("ỵ", "y")
    )
    for k, v in status_map.items():
        if k in s_ascii:
            return v
    return "other"

def parse_hhmm(s):
    s = normalize_space(s)
    if pd.isna(s) or s == "":
        return pd.NaT
    dt = pd.to_datetime(s, format="%H:%M", errors="coerce")
    return dt

def merge_weather_asof(flight_df: pd.DataFrame, weather_df: pd.DataFrame, tolerance: pd.Timedelta = pd.Timedelta(hours=3)) -> pd.DataFrame:
    left = flight_df.sort_values(["source_airport", "retrieved_at_vn"]).copy()
    right = weather_df.sort_values(["source_airport", "report_time_vn"]).copy()

    merged_parts = []
    for airport_code, g_left in left.groupby("source_airport"):
        g_right = right[right["source_airport"] == airport_code]
        if g_right.empty:
            g_left = g_left.copy()
            for c in ["temperature_c", "dew_point_c", "wind_direction_deg", "wind_speed_kt", "visibility_miles", "cloud_cover", "is_wind_variable", "raw_metar", "report_time_vn"]:
                g_left[c] = np.nan
            g_left["weather_age_minutes"] = np.nan
            merged_parts.append(g_left)
            continue

        g_merged = pd.merge_asof(
            g_left.sort_values("retrieved_at_vn"),
            g_right.sort_values("report_time_vn"),
            left_on="retrieved_at_vn",
            right_on="report_time_vn",
            direction="backward",
            allow_exact_matches=True,
            tolerance=tolerance,
            suffixes=("", "_wx"),
        )

        if "source_airport_wx" in g_merged.columns:
            g_merged = g_merged.drop(columns=["source_airport_wx"])

        g_merged["weather_age_minutes"] = (
            (g_merged["retrieved_at_vn"] - g_merged["report_time_vn"])
            .dt.total_seconds()
            / 60.0
        )

        merged_parts.append(g_merged)

    if not merged_parts:
         return left.copy()
    return pd.concat(merged_parts, ignore_index=True)

def add_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    out["scheduled_hour"] = out["scheduled_dt"].dt.hour
    out["scheduled_dayofweek"] = out["scheduled_dt"].dt.dayofweek
    out["scheduled_month"] = out["scheduled_dt"].dt.month

    out["sin_hour"] = np.sin(2 * np.pi * out["scheduled_hour"] / 24)
    out["cos_hour"] = np.cos(2 * np.pi * out["scheduled_hour"] / 24)

    out["airline_code"] = out["flight_number"].str.extract(r"^([A-Z0-9]{2})", expand=False)
    out["flight_num_only"] = pd.to_numeric(out["flight_number"].str.extract(r"(\d+)", expand=False), errors="coerce")

    out["minutes_to_departure_at_snapshot"] = (out["scheduled_dt"] - out["retrieved_at_vn"]).dt.total_seconds() / 60.0
    out["is_estimated_missing"] = out["estimated_dt"].isna().astype(int)

    out["temperature_c"] = pd.to_numeric(out["temperature_c"], errors="coerce")
    out["dew_point_c"] = pd.to_numeric(out["dew_point_c"], errors="coerce")
    out["visibility_miles"] = pd.to_numeric(out["visibility_miles"], errors="coerce")

    out["visibility_bin"] = pd.cut(
        out["visibility_miles"],
        bins=[-np.inf, 3, 6, np.inf],
        labels=["Bad", "Medium", "Good"]
    ).astype(str)

    out["temp_dew_spread"] = out["temperature_c"] - out["dew_point_c"]
    out["is_low_visibility"] = (out["visibility_miles"] <= 3).astype(float)

    return out

def ensure_table_has_columns(table_name: str, df: pd.DataFrame) -> None:
    import psycopg2
    from psycopg2 import sql
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("Missing DATABASE_URL environment variable")

    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = %s
                );
                """,
                (table_name,),
            )
            table_exists = cur.fetchone()[0]
            if not table_exists:
                return

            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s;
                """,
                (table_name,),
            )
            existing_cols = {row[0] for row in cur.fetchall()}

            for col in df.columns:
                if col in existing_cols:
                    continue
                alter = sql.SQL("ALTER TABLE {} ADD COLUMN {} TEXT").format(
                    sql.Identifier(table_name),
                    sql.Identifier(col),
                )
                cur.execute(alter)

def pick_training_snapshot(g: pd.DataFrame) -> pd.Series:
    lead = pd.Timedelta(minutes=TRAINING_SNAPSHOT_LEAD_MINUTES)
    g = g.sort_values("retrieved_at_vn")
    scheduled_dt = g["scheduled_dt"].iloc[0]
    target_time = scheduled_dt - lead

    cand = g[g["retrieved_at_vn"].notna() & (g["retrieved_at_vn"] <= target_time)]
    if not cand.empty:
        return cand.iloc[-1]

    cand2 = g[g["retrieved_at_vn"].notna() & (g["retrieved_at_vn"] <= scheduled_dt)]
    if not cand2.empty:
        return cand2.iloc[-1]

    return g.iloc[0]

def process_data():
    flight_tables = {
        "NB": "flights_nb",
        "DN": "flights_dn",
        "TSN": "flights_tsn",
    }

    flight_frames = []
    for airport_code, table_name in flight_tables.items():
        df_flights = load_table(table_name)
        if df_flights.empty:
            continue
        df_flights = df_flights.drop(columns=["created_at"], errors="ignore")
        df_flights["source_airport"] = airport_code
        flight_frames.append(df_flights)

    if not flight_frames:
        print("No flight data found.")
        return None

    flights_raw = pd.concat(flight_frames, ignore_index=True)
    weather_raw = load_table("weather_metar").drop(columns=["created_at"], errors="ignore")

    col_rename_db = {
        "data_retrieved_at_vn": "retrieved_at_vn",
        "airport": "route_airport",
        "status": "status_raw",
    }
    flights = flights_raw.rename(columns=col_rename_db).copy()

    for c in ["source_airport", "direction", "route_airport", "status_raw", "flight_number", "scheduled_time", "estimated_time"]:
        flights[c] = flights[c].apply(normalize_space)

    flights["flight_number"] = flights["flight_number"].apply(normalize_flight_number)
    flights["direction"] = flights["direction"].str.title()
    flights["route_airport_std"] = flights["route_airport"].apply(normalize_route_airport)
    flights["status_group"] = flights["status_raw"].apply(normalize_status)

    flights["retrieved_at_vn"] = pd.to_datetime(flights["retrieved_at_vn"], errors="coerce")
    flights["flight_date"] = pd.to_datetime(flights["flight_date"], errors="coerce").dt.date

    sched_parsed = flights["scheduled_time"].apply(parse_hhmm)
    est_parsed = flights["estimated_time"].apply(parse_hhmm)

    flights["scheduled_dt"] = pd.to_datetime(flights["flight_date"].astype(str) + " " + sched_parsed.dt.strftime("%H:%M"), errors="coerce")
    flights["estimated_dt"] = pd.to_datetime(flights["flight_date"].astype(str) + " " + est_parsed.dt.strftime("%H:%M"), errors="coerce")

    sched_hour = flights["scheduled_dt"].dt.hour
    est_hour = flights["estimated_dt"].dt.hour
    cross_day_mask = (
        flights["estimated_dt"].notna()
        & flights["scheduled_dt"].notna()
        & (flights["estimated_dt"] < flights["scheduled_dt"])
        & (sched_hour >= 18)
        & (est_hour <= 6)
    )
    flights.loc[cross_day_mask, "estimated_dt"] = flights.loc[cross_day_mask, "estimated_dt"] + pd.Timedelta(days=1)

    flights["delay_minutes"] = (flights["estimated_dt"] - flights["scheduled_dt"]).dt.total_seconds() / 60.0
    flights.loc[flights["delay_minutes"].abs() > 600, "delay_minutes"] = np.nan

    flights["label_delay"] = np.where(
        flights["delay_minutes"].notna(),
        (flights["delay_minutes"] >= DELAY_THRESHOLD_MINUTES).astype(int),
        np.nan,
    )

    status_delay_mask = flights["status_group"].eq("delayed") & flights["label_delay"].isna()
    status_non_delay_mask = flights["status_group"].isin(["on_time", "landed", "departed"]) & flights["label_delay"].isna()
    flights.loc[status_delay_mask, "label_delay"] = 1
    flights.loc[status_non_delay_mask, "label_delay"] = 0

    flights = flights.drop_duplicates().copy()

    required_non_null = [
        "source_airport",
        "direction",
        "route_airport_std",
        "flight_number",
        "scheduled_dt",
        "retrieved_at_vn",
        "status_raw",
        "status_group",
    ]
    missing_required_mask = flights[required_non_null].isna().any(axis=1)
    flights = flights.loc[~missing_required_mask].copy()

    valid_directions = {"Arrival", "Departure"}
    invalid_dir_mask = ~flights["direction"].isin(valid_directions)
    flights = flights.loc[~invalid_dir_mask].copy()

    flight_number_blank_mask = flights["flight_number"].astype(str).str.strip().eq("")
    flights = flights.loc[~flight_number_blank_mask].copy()

    key_cols = ["source_airport", "direction", "route_airport_std", "flight_number", "scheduled_dt"]
    flights["flight_key"] = flights[key_cols].astype(str).agg("|".join, axis=1)

    flights = flights.sort_values(["flight_key", "retrieved_at_vn"]).reset_index(drop=True)
    flights_dedup = flights.drop_duplicates(subset=["flight_key", "retrieved_at_vn"], keep="last").copy()

    flights_current = (
        flights_dedup.sort_values(["flight_key", "retrieved_at_vn"])
        .groupby("flight_key", as_index=False)
        .tail(1)
        .reset_index(drop=True)
    )

    status_now = flights_dedup["status_raw"].fillna("").astype(str).str.strip()
    status_prev = (
        flights_dedup.groupby("flight_key")["status_raw"]
        .shift(1)
        .fillna("")
        .astype(str)
        .str.strip()
    )
    flights_for_train = flights_dedup[status_now.ne("") & status_now.ne(status_prev)].copy()

    flights_training_snapshot = (
        flights_for_train.groupby("flight_key", group_keys=False)
        .apply(pick_training_snapshot)
        .reset_index(drop=True)
    )

    weather = weather_raw.rename(
        columns={
            "icao_code": "icao_code",
            "report_time_utc": "report_time_utc",
            "report_time_vn": "report_time_vn",
            "temperature_c": "temperature_c",
            "dew_point_c": "dew_point_c",
            "wind_direction_deg": "wind_direction_deg",
            "wind_speed_kt": "wind_speed_kt",
            "visibility_miles": "visibility_miles",
            "cloud_cover": "cloud_cover",
            "raw_metar": "raw_metar",
        },
    ).copy()

    icao_map = {
        "VVNB": "NB",
        "VVDN": "DN",
        "VVTS": "TSN",
    }
    weather["source_airport"] = weather["icao_code"].map(icao_map)
    weather["report_time_vn"] = pd.to_datetime(weather["report_time_vn"], errors="coerce")

    for c in ["temperature_c", "dew_point_c", "wind_speed_kt"]:
        if c in weather.columns:
            weather[c] = pd.to_numeric(weather[c], errors="coerce")

    weather["visibility_miles"] = (
        weather["visibility_miles"]
        .astype(str)
        .str.replace("+", "", regex=False)
    )
    weather["visibility_miles"] = pd.to_numeric(weather["visibility_miles"], errors="coerce")

    weather["wind_direction_deg"] = weather["wind_direction_deg"].replace({"VRB": np.nan})
    weather["wind_direction_deg"] = pd.to_numeric(weather["wind_direction_deg"], errors="coerce")
    weather["is_wind_variable"] = weather_raw["wind_direction_deg"].astype(str).eq("VRB").astype(int)

    weather = weather.dropna(subset=["source_airport", "report_time_vn"]).sort_values(["source_airport", "report_time_vn"])
    weather = weather.drop_duplicates(subset=["source_airport", "report_time_vn", "raw_metar"], keep="last")

    current_with_weather = merge_weather_asof(flights_current, weather)
    train_with_weather = merge_weather_asof(flights_training_snapshot, weather)

    current_features = add_features(current_with_weather)
    training_features = add_features(train_with_weather)

    training_dataset = training_features[training_features["label_delay"].isin([0, 1])].copy()
    training_dataset["label_delay"] = training_dataset["label_delay"].astype(int)

    training_dataset = training_dataset[training_dataset["minutes_to_departure_at_snapshot"] >= 0].copy()

    training_dataset_to_save = training_dataset.copy()
    if "flight_key" not in training_dataset_to_save.columns:
        training_dataset_to_save["flight_key"] = training_dataset_to_save[key_cols].astype(str).agg("|".join, axis=1)

    outputs = {
        "training_dataset_labeled": (training_dataset_to_save, ["flight_key"]),
        "flights_current_snapshot": (current_features, ["flight_key"]),
    }

    for table_name, (df_out, unique_cols) in outputs.items():
        if df_out.empty:
            continue
        ensure_table_has_columns(table_name, df_out)
        inserted = save_dataframe(df_out, table_name=table_name, unique_cols=unique_cols)
        print(f"Saved table: {table_name} | inserted={inserted} | shape={df_out.shape}")

    return current_features

if __name__ == "__main__":
    process_data()
