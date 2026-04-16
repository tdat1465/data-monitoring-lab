import requests
import pandas as pd
from bs4 import BeautifulSoup

from db_utils import save_dataframe

def get_noibai_all_flights(date, terminal="T1"):
    """
    Lấy dữ liệu cả chiều đi và đến tại sân bay Nội Bài.
    """
    # Lấy thời gian thu thập theo giờ Việt Nam
    scrape_time = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh").strftime("%Y-%m-%d %H:%M:%S")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    }

    # Định nghĩa 2 chiều bay cần lấy
    flight_directions = [
        {"endpoint": "arrivals", "label": "Arrival"},
        {"endpoint": "departures", "label": "Departure"}
    ]
    
    all_flights = []

    for direction in flight_directions:
        endpoint = direction["endpoint"]
        label = direction["label"]
        
        url = f"https://noibaiairport.vn/vi/{endpoint}?key=&date={date}&time=0000-2359&ter={terminal}"
        print(f"Đang tải dữ liệu Nội Bài: Chiều {label} ({date} - {terminal})...")
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                print(f"Lỗi truy cập {url}: {response.status_code}")
                continue

            soup = BeautifulSoup(response.text, 'html.parser')
            table = soup.find('table', class_='table table-responsive mt-30 table-hover')
            
            if not table:
                print(f"Không tìm thấy bảng dữ liệu cho chiều {label}!")
                continue

            tbody = table.find('tbody')
            rows = tbody.find_all('tr')
            
            for row in rows:
                cols = row.find_all('td')
                if len(cols) == 6:
                    # 1. Làm sạch và tách cột thời gian (Ví dụ: "05:00 / 05:00")
                    time_col = " ".join(cols[0].text.split())
                    parts = [p.strip() for p in time_col.split('/')]
                    scheduled_time = parts[0] if len(parts) > 0 and parts[0] else None
                    estimated_time = parts[1] if len(parts) > 1 and parts[1] else None

                    # 2. Ghi dữ liệu vào mảng theo format chung
                    all_flights.append({
                        "Data Retrieved At (VN)": scrape_time,
                        "Flight Date": date,
                        "Direction": label,
                        "Scheduled Time": scheduled_time,
                        "Estimated Time": estimated_time,
                        "Airport": cols[1].text.strip(),
                        "Flight Number": cols[3].text.strip(),
                        "Status": cols[5].text.strip()
                    })

        except Exception as e:
            print(f"Có lỗi xảy ra khi xử lý chiều {label}: {e}")

    # Chuyển đổi mảng tổng thành DataFrame theo đúng thứ tự cột chung
    df_final = pd.DataFrame(all_flights)
    expected_columns = [
        "Data Retrieved At (VN)",
        "Flight Date",
        "Direction",
        "Scheduled Time",
        "Estimated Time",
        "Airport",
        "Flight Number",
        "Status",
    ]
    df_final = df_final.reindex(columns=expected_columns)
    return df_final


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
    target_terminal = "T1"

    df_noibai = get_noibai_all_flights(date=target_date, terminal=target_terminal)
    if df_noibai.empty:
        print("NB: Không thu thập được dữ liệu chuyến bay.")
        return

    db_df = _to_db_schema(df_noibai)
    inserted = save_dataframe(
        db_df,
        table_name="flights_nb",
        unique_cols=["flight_date", "direction", "scheduled_time", "airport", "flight_number"],
    )
    print(f"NB: Đã ghi {inserted}/{len(db_df)} dòng vào PostgreSQL.")


if __name__ == "__main__":
    main()