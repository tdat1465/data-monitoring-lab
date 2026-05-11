from curl_cffi import requests
import pandas as pd
import time

from db_utils import save_dataframe


REQUEST_TIMEOUT = 30
MAX_PAGES = 5

VN_AIRPORTS = {
    "HAN": "Hà Nội",
    "SGN": "Hồ Chí Minh",
    "DAD": "Đà Nẵng",
    "PQC": "Phú Quốc",
    "CXR": "Nha Trang",
    "VDO": "Vân Đồn",
    "HPH": "Hải Phòng",
    "VII": "Vinh",
    "HUI": "Huế",
    "VDH": "Đồng Hới",
    "VCL": "Chu Lai",
    "UIH": "Quy Nhơn",
    "TBB": "Tuy Hòa",
    "BMV": "Buôn Ma Thuột",
    "PXU": "Pleiku",
    "DLI": "Đà Lạt",
    "VCS": "Côn Đảo",
    "VKG": "Rạch Giá",
    "CAH": "Cà Mau",
    "VCA": "Cần Thơ",
    "THD": "Thanh Hóa",
    "DIN": "Điện Biên",
}

FR24_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "origin": "https://www.flightradar24.com",
    "referer": "https://www.flightradar24.com/",
    "sec-ch-ua": '"Chromium";v="148", "Brave";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "sec-gpc": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
}


def _ts_to_hhmm(ts: int | None) -> str | None:
    if not ts:
        return None
    return pd.to_datetime(ts, unit='s', utc=True).tz_convert('Asia/Ho_Chi_Minh').strftime('%H:%M')


def _ts_to_yyyy_mm_dd(ts: int | None) -> str | None:
    if not ts:
        return None
    return pd.to_datetime(ts, unit='s', utc=True).tz_convert('Asia/Ho_Chi_Minh').strftime('%Y-%m-%d')


def _fetch_fr24_flights(session: requests.Session, airport_code: str, flight_type: str, timestamp: int, max_pages: int = MAX_PAGES) -> list[dict]:
    rows = []
    
    for page in range(1, max_pages + 1):
        url = (
            f"https://api.flightradar24.com/common/v1/airport.json"
            f"?code={airport_code}&plugin[]=&plugin-setting[schedule][mode]={flight_type}"
            f"&plugin-setting[schedule][timestamp]={timestamp}&page={page}&limit=100&fleet=&token="
        )
        try:
            response = session.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            print(f"Loi khi goi API FlightRadar24 ({flight_type}, page={page}): {exc}")
            break
            
        schedule = data.get("result", {}).get("response", {}).get("airport", {}).get("pluginData", {}).get("schedule", {})
        flight_data = schedule.get(flight_type, {})
        items = flight_data.get("data", [])
        
        if not items:
            break
            
        rows.extend(items)
        
        page_info = flight_data.get("page", {})
        current_page = page_info.get("current", 1)
        total_pages = page_info.get("total", 1)
        if current_page >= total_pages:
            break
            
    return rows


def get_fr24_flights(airport_code="dad", flight_type="arrival", max_pages=MAX_PAGES, flight_date: str | None = None):
    timestamp = int(time.time())
    
    session = requests.Session(impersonate="chrome")
    session.headers.update(FR24_HEADERS)
    
    fr24_mode = "arrivals" if flight_type == "arrival" else "departures"
    flight_direction = "Arrival" if flight_type == "arrival" else "Departure"
    
    print(f"\n[DANG LAY DU LIEU {flight_direction.upper()} TU FLIGHTRADAR24 - {airport_code.upper()}]")
    
    raw_data = _fetch_fr24_flights(session, airport_code, fr24_mode, timestamp, max_pages)
    
    all_flights = []
    seen = set()
    
    for item in raw_data:
        flight = item.get("flight", {})
        if not flight:
            continue
            
        ident = flight.get("identification", {})
        flight_number = ident.get("number", {}).get("default")
        if not flight_number:
            continue
            
        status_obj = flight.get("status", {})
        status = status_obj.get("text")
        
        time_data = flight.get("time", {})
        sched = time_data.get("scheduled", {})
        real = time_data.get("real", {})
        est = time_data.get("estimated", {})
        
        if flight_type == "departure":
            scheduled_ts = sched.get("departure")
            real_ts = real.get("departure")
            est_ts = est.get("departure")
            airport_obj = flight.get("airport", {}).get("destination", {})
        else:
            scheduled_ts = sched.get("arrival")
            real_ts = real.get("arrival")
            est_ts = est.get("arrival")
            airport_obj = flight.get("airport", {}).get("origin", {})
            
        country_code = airport_obj.get("position", {}).get("country", {}).get("code") if airport_obj else None
        if country_code != "VN":
            continue
            
        scheduled_time = _ts_to_hhmm(scheduled_ts)
        estimated_time = _ts_to_hhmm(real_ts) or _ts_to_hhmm(est_ts)
        flight_date_str = _ts_to_yyyy_mm_dd(scheduled_ts)
        
        airport_name = airport_obj.get("name") if airport_obj else None
        airport_iata = airport_obj.get("code", {}).get("iata") if airport_obj else None
        
        if airport_iata in VN_AIRPORTS:
            airport = VN_AIRPORTS[airport_iata]
        elif airport_iata and airport_name:
            airport = f"{airport_iata} - {airport_name}"
        else:
            airport = airport_name or airport_iata
            
        row = {
            "Flight Date": flight_date_str,
            "Direction": flight_direction,
            "Scheduled Time": scheduled_time,
            "Estimated Time": estimated_time,
            "Airport": airport,
            "Flight Number": flight_number,
            "Status": status,
        }
        
        dedupe_key = (
            row["Flight Date"],
            row["Direction"],
            row["Scheduled Time"],
            row["Airport"],
            row["Flight Number"],
            row["Status"],
        )
        
        if dedupe_key not in seen:
            seen.add(dedupe_key)
            all_flights.append(row)

    return pd.DataFrame(all_flights)


def _to_db_schema(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(
        columns={
            "Data Retrieved At (VN)": "data_retrieved_at_vn",
            "Flight Date": "flight_date",
            "Direction": "direction",
            "Scheduled Time": "scheduled_time",
            "Estimated Time": "estimated_time",
            "Airport": "airport",
            "Flight Number": "flight_number",
            "Status": "status",
        }
    )


def main():
    target_date = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh").strftime("%Y-%m-%d")

    df_arrivals = get_fr24_flights(airport_code="dad", flight_type="arrival", max_pages=20, flight_date=target_date)
    df_departures = get_fr24_flights(airport_code="dad", flight_type="departure", max_pages=20, flight_date=target_date)

    df_all = pd.concat([df_arrivals, df_departures], ignore_index=True)
    if df_all.empty:
        print("DN: Khong thu thap duoc du lieu chuyen bay.")
        return

    collected_at_vn = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh").strftime("%Y-%m-%d %H:%M:%S")
    df_all.insert(0, "Data Retrieved At (VN)", collected_at_vn)

    db_df = _to_db_schema(df_all)
    inserted = save_dataframe(
        db_df,
        table_name="flights_dn",
        unique_cols=["flight_date", "direction", "scheduled_time", "airport", "flight_number", "status"],
    )
    print(f"DN: Da ghi {inserted}/{len(db_df)} dong vao PostgreSQL.")


if __name__ == "__main__":
    main()