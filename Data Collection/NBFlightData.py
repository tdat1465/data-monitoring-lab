import requests
import pandas as pd
from bs4 import BeautifulSoup
from pathlib import Path

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

# ==========================================
# CHẠY THỬ CHƯƠNG TRÌNH
# ==========================================

# Chỉ định ngày cần lấy (Định dạng YYYY-MM-DD)
target_date = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh").strftime("%Y-%m-%d")
target_terminal = "T1" # T1 là quốc nội, T2 là quốc tế

df_noibai = get_noibai_all_flights(date=target_date, terminal=target_terminal)

if not df_noibai.empty:
    print("\n" + "="*70)
    print(f"\n=> Tổng cộng thu thập được: {len(df_noibai)} chuyến bay.")

    code_dir = Path(__file__).resolve().parent
    output_path = code_dir / "data" / "raw" / "NB.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Chỉ thêm dữ liệu mới vào cuối file, tránh ghi đè và tránh trùng dữ liệu cũ.
    key_columns = ["Flight Date", "Direction", "Scheduled Time", "Airport", "Flight Number"]

    if output_path.exists():
        try:
            df_existing = pd.read_csv(output_path, encoding="utf-8-sig")
            if all(col in df_existing.columns for col in key_columns):
                existing_keys = set(
                    df_existing[key_columns]
                    .fillna("")
                    .astype(str)
                    .agg("|".join, axis=1)
                )

                incoming_keys = (
                    df_noibai[key_columns]
                    .fillna("")
                    .astype(str)
                    .agg("|".join, axis=1)
                )
                df_to_append = df_noibai[~incoming_keys.isin(existing_keys)]
            else:
                # Nếu file cũ thiếu cột khóa, vẫn append để không mất dữ liệu mới.
                df_to_append = df_noibai
        except Exception as e:
            print(f"Không đọc được file cũ để lọc trùng ({e}), sẽ append toàn bộ dữ liệu mới.")
            df_to_append = df_noibai
    else:
        df_to_append = df_noibai

    if not df_to_append.empty:
        df_to_append.to_csv(
            output_path,
            mode="a",
            header=not output_path.exists(),
            index=False,
            encoding="utf-8-sig"
        )
        print(f"Đã thêm {len(df_to_append)} dòng mới vào file: {output_path}")
    else:
        print(f"Không có dòng mới để thêm. File giữ nguyên: {output_path}")
else:
    print("Không thu thập được dữ liệu nào.")