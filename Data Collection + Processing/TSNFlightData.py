import requests
import time
import pandas as pd
import re
import urllib3

from db_utils import save_dataframe


# ACV currently serves flight data via Next.js API proxy endpoints.
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CONNECT_TIMEOUT = 12
READ_TIMEOUT = 30
REQUEST_RETRIES = 3


def _request_with_ssl_fallback(session: requests.Session, method: str, url: str, **kwargs) -> requests.Response:
    last_exc: Exception | None = None
    cert_expired_markers = [
        "CERTIFICATE_VERIFY_FAILED",
        "certificate verify failed",
        "certificate has expired",
    ]

    for attempt in range(1, REQUEST_RETRIES + 1):
        try:
            return session.request(method, url, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT), **kwargs)
        except requests.exceptions.SSLError as exc:
            error_text = str(exc)
            if any(marker in error_text for marker in cert_expired_markers):
                try:
                    print("Canh bao: SSL certificate cua nguon da het han. Thu lai voi verify=False...")
                    return session.request(
                        method,
                        url,
                        timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
                        verify=False,
                        **kwargs,
                    )
                except requests.exceptions.RequestException as ssl_retry_exc:
                    last_exc = ssl_retry_exc
            else:
                raise
        except (
            requests.exceptions.ConnectTimeout,
            requests.exceptions.ReadTimeout,
            requests.exceptions.ConnectionError,
        ) as exc:
            last_exc = exc

        if attempt < REQUEST_RETRIES:
            wait_seconds = min(2 ** (attempt - 1), 4)
            print(f"Canh bao: Loi ket noi den ACV (lan {attempt}/{REQUEST_RETRIES}). Thu lai sau {wait_seconds}s...")
            time.sleep(wait_seconds)

    if last_exc is not None:
        raise last_exc
    raise RuntimeError("Yeu cau den API that bai nhung khong co thong tin loi cu the.")


def _search_acv_flights(
    session: requests.Session,
    flight_type: str,
    flight_date: str,
    terminal: str,
    page_index: int,
    page_size: int = 15,
) -> list[dict]:
    payload = {
        "flightDate": flight_date,
        "pageIndex": page_index,
        "pageSize": page_size,
        "langCode": "vi",
        "terminal": terminal,
        "flightNo": "",
        "departureStation": "SGN" if flight_type == "departure" else "",
        "arrivalStation": "SGN" if flight_type == "arrival" else "",
        "type": flight_type,
    }
    proxy_body = {
        "url": "/api/flights/search",
        "method": "POST",
        "body": payload,
    }
    try:
        response = _request_with_ssl_fallback(
            session,
            "POST",
            "https://acv.vn/api/proxy",
            json=proxy_body,
        )
    except requests.exceptions.RequestException as exc:
        print(
            "ACV API loi ket noi "
            f"(type={flight_type}, terminal={terminal}, page={page_index}): {exc}"
        )
        return []
    if response.status_code != 200:
        print(f"ACV API loi status={response.status_code} (type={flight_type}, terminal={terminal}, page={page_index})")
        return []

    try:
        json_data = response.json()
    except ValueError:
        print(f"ACV API khong tra JSON hop le (type={flight_type}, terminal={terminal}, page={page_index})")
        return []

    data = json_data.get("data")
    return data if isinstance(data, list) else []


def _extract_airport_from_route(route: str | None, flight_type: str) -> str | None:
    if not route:
        return None

    parts = re.split(r"\s*-\s*", route, maxsplit=1)
    if len(parts) < 2:
        return route.strip()

    origin, destination = parts[0].strip(), parts[1].strip()
    return destination if flight_type == "departure" else origin


def get_tia_flights(flight_type="arrival", max_pages=20, flight_date: str | None = None):
    session = requests.Session()

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

    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/json",
        "Accept-Language": "vi;q=0.5",
        "Connection": "keep-alive",
        "Host": "acv.vn",
        "Origin": "https://acv.vn",
        "Referer": "https://acv.vn/vi/chuyen-bay",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest"
    }
    session.headers.update(headers)

    all_flights = []
    terminals = ["T1", "T3"]
    seen = set()

    try:
        for terminal in terminals:
            print(f"Dang lay du lieu {flight_type.upper()} - Terminal {terminal} - Ngay {flight_date}")
            for current_page in range(1, max_pages + 1):
                flights = _search_acv_flights(
                    session=session,
                    flight_type=flight_type,
                    flight_date=flight_date,
                    terminal=terminal,
                    page_index=current_page,
                )

                if not flights:
                    break

                for f in flights:
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

                time.sleep(0.2)

    except Exception as e:
        print(f"Có lỗi xảy ra: {e}")

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