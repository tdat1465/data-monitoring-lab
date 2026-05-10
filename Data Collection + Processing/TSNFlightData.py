import requests
import pandas as pd
import re

from db_utils import save_dataframe


REQUEST_TIMEOUT = 30
PAGE_SIZE = 15
MAX_PAGES = 30
TSN_TERMINALS = ["T1", "T3"]


def _create_acv_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "Accept": "*/*",
            "Content-Type": "application/json",
            "Accept-Language": "vi;q=0.9",
            "Origin": "https://acv.vn",
            "Referer": "https://acv.vn/vi/chuyen-bay",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/148.0.0.0 Safari/537.36"
            ),
        }
    )
    return session


def _extract_airport_from_route(route: str | None, flight_type: str) -> str | None:
    if not route:
        return None

    parts = re.split(r"\s*-\s*", route, maxsplit=1)
    if len(parts) < 2:
        return route.strip()

    origin, destination = parts[0].strip(), parts[1].strip()
    return destination if flight_type == "departure" else origin


def _fetch_acv_flights_for_terminal(
    session: requests.Session,
    flight_type: str,
    flight_date: str,
    terminal: str,
    station_code: str = "SGN",
    page_size: int = PAGE_SIZE,
    max_pages: int = MAX_PAGES,
) -> list[dict]:
    warmup_params = {"type": flight_type, "flightDate": flight_date, "terminal": terminal}
    if flight_type == "arrival":
        warmup_params["arrivalStation"] = station_code
    else:
        warmup_params["departureStation"] = station_code

    try:
        session.get("https://acv.vn/vi/chuyen-bay", params=warmup_params, timeout=REQUEST_TIMEOUT)
    except requests.exceptions.RequestException as exc:
        print(f"Canh bao: Warm-up that bai (type={flight_type}, terminal={terminal}): {exc}")
        return []

    rows = []
    for page_index in range(1, max_pages + 1):
        payload = {
            "flightDate": flight_date,
            "pageIndex": page_index,
            "pageSize": page_size,
            "langCode": "vi",
            "terminal": terminal,
            "flightNo": "",
            "departureStation": station_code if flight_type == "departure" else "",
            "arrivalStation": station_code if flight_type == "arrival" else "",
            "type": flight_type,
        }

        proxy_body = {
            "url": "/api/flights/search",
            "method": "POST",
            "body": payload,
        }

        try:
            response = session.post("https://acv.vn/api/proxy", json=proxy_body, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json().get("data", [])
        except requests.exceptions.RequestException as exc:
            print(f"Canh bao: API that bai (type={flight_type}, terminal={terminal}, page={page_index}): {exc}")
            break
        except ValueError as exc:
            print(f"Canh bao: JSON khong hop le (type={flight_type}, terminal={terminal}, page={page_index}): {exc}")
            break

        if not data:
            break

        rows.extend(data)

    return rows


def get_tia_flights(flight_type="arrival", max_pages=MAX_PAGES, flight_date: str | None = None):
    session = _create_acv_session()

    if flight_date is None:
        flight_date = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh").strftime("%Y-%m-%d")

    if flight_type == "arrival":
        print("\n🛬 ĐANG LẤY DỮ LIỆU CHIỀU ĐẾN (ARRIVALS) 🛬")
        flight_direction = "Arrival"
    elif flight_type == "departure":
        print("\n🛫 ĐANG LẤY DỮ LIỆU CHIỀU ĐI (DEPARTURES) 🛫")
        flight_direction = "Departure"
    else:
        print("Loại chuyến bay không hợp lệ!")
        return pd.DataFrame()

    all_raw_rows: list[dict] = []
    seen = set()

    for terminal in TSN_TERMINALS:
        print(f"Dang lay du lieu {flight_type.upper()} - Terminal {terminal} - Ngay {flight_date}")
        terminal_rows = _fetch_acv_flights_for_terminal(
            session=session,
            flight_type=flight_type,
            flight_date=flight_date,
            terminal=terminal,
            max_pages=max_pages,
        )
        all_raw_rows.extend(terminal_rows)

    all_flights = []
    for f in all_raw_rows:
        route = f.get("route")
        airport = _extract_airport_from_route(route, flight_type)
        row = {
            "Direction": flight_direction,
            "Scheduled Time": f.get("gioKhoiHanh") if flight_type == "departure" else f.get("gioHaCanh"),
            "Estimated Time": None,
            "Airport": airport,
            "Flight Number": f.get("soHieuChuyenBay"),
            "Status": f.get("trangThai"),
        }
        dedupe_key = (
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

    df_arrivals = get_tia_flights(flight_type="arrival", max_pages=20, flight_date=target_date)
    df_departures = get_tia_flights(flight_type="departure", max_pages=20, flight_date=target_date)

    df_all = pd.concat([df_arrivals, df_departures], ignore_index=True)
    if df_all.empty:
        print("TSN: Không thu thập được dữ liệu chuyến bay.")
        return

    collected_at_vn = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh").strftime("%Y-%m-%d %H:%M:%S")
    flight_date = collected_at_vn.split(" ")[0]
    df_all.insert(0, "Data Retrieved At (VN)", collected_at_vn)
    df_all.insert(1, "Flight Date", flight_date)

    db_df = _to_db_schema(df_all)
    inserted = save_dataframe(
        db_df,
        table_name="flights_tsn",
        unique_cols=["flight_date", "direction", "scheduled_time", "airport", "flight_number", "status"],
    )
    print(f"TSN: Đã ghi {inserted}/{len(db_df)} dòng vào PostgreSQL.")


if __name__ == "__main__":
    main()