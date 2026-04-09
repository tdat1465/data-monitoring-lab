import requests
import pandas as pd
from pathlib import Path


def parse_cloud_layers(clouds):
    # NOAA can return clouds as a list of layers, e.g. [{cover: FEW, base: 1000}, ...].
    # If no layer is returned, treat it as clear sky.
    if not clouds:
        return "clear"

    parsed_layers = []
    for layer in clouds:
        cover = layer.get("cover") if isinstance(layer, dict) else None
        base = layer.get("base") if isinstance(layer, dict) else None

        if cover and base is not None:
            parsed_layers.append(f"{cover}@{base}ft")
        elif cover:
            parsed_layers.append(str(cover))

    return ", ".join(parsed_layers) if parsed_layers else "clear"


def to_vietnam_time(obs_time_utc):
    if obs_time_utc is None:
        return None

    # API time can be ISO text or Unix timestamp.
    if isinstance(obs_time_utc, (int, float)):
        dt_utc = pd.to_datetime(obs_time_utc, unit="s", utc=True, errors="coerce")
    else:
        dt_utc = pd.to_datetime(obs_time_utc, utc=True, errors="coerce")

    if pd.isna(dt_utc):
        return None

    return dt_utc.tz_convert("Asia/Ho_Chi_Minh").strftime("%Y-%m-%d %H:%M:%S")

def get_aviation_weather():
    # NOAA API URL (returns JSON)
    icao_codes = "VVTS,VVNB,VVDN"
    url = f"https://aviationweather.gov/api/data/metar?ids={icao_codes}&format=json&hours=24"
    
    # Fake User-Agent to avoid connection rejection
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        parsed_data = []
        
        for item in data:
            report_time = item.get('reportTime')
            parsed_data.append({
                "ICAO Code": item.get('icaoId'),
                "Report Time (UTC)": report_time,
                "Report Time (VN)": to_vietnam_time(report_time),
                "Temperature (°C)": item.get('temp'),
                "Dew Point (°C)": item.get('dewp'),
                "Wind Direction (Degrees)": item.get('wdir'),
                "Wind Speed (Knots)": item.get('wspd'),
                "Visibility (Miles)": item.get('visib'),
                "Cloud Cover": parse_cloud_layers(item.get('clouds')),
                "Raw METAR": item.get('rawOb')
            })
            
        return pd.DataFrame(parsed_data)
    else:
        print(f"Error retrieving data: {response.status_code}")
        return None

# Run and print results
df_metar = get_aviation_weather()
if df_metar is not None:
    code_dir = Path(__file__).resolve().parent
    output_path = code_dir / "data" / "raw" / "weather.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_metar.to_csv(output_path, index=False, encoding="utf-8-sig")
    
    print(f"Saved file: {output_path}")