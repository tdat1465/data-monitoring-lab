import requests
import pandas as pd
from bs4 import BeautifulSoup
from datetime import datetime
import time
import urllib3
from pathlib import Path

# Tắt cảnh báo SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_danang_all_flights_paginated(date, terminal="1"):
    """
    Lấy toàn bộ dữ liệu (bao gồm phân trang) tại sân bay Đà Nẵng.
    :param date: Ngày cần lấy (Định dạng YYYY-MM-DD)
    :param terminal: '1' cho Quốc nội, '2' cho Quốc tế, hoặc '' cho tất cả
    """
    scrape_time = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh").strftime("%Y-%m-%d %H:%M:%S")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest" 
    }

    flight_directions = [
        {"endpoint": "flights-flight-status-arrival/arrival-flight", "label": "Arrival"},
        {"endpoint": "flights-flight-status-departure/departure-flight", "label": "Departure"}
    ]
    
    all_flights = []
    session = requests.Session()
    session.headers.update(headers)

    for direction in flight_directions:
        label = direction["label"]
        endpoint = direction["endpoint"]
        base_url = f"https://danangairport.vn/vn/{endpoint}"
        
        page = 1 
        
        while True:
            print(f"Đang tải Đà Nẵng: Chiều {label} - Trang {page}...")
            
            params = {
                "page": page,
                "f": "1",         
                "q": "",          
                "t": terminal,    
                "date": date,
                "time": "",       
                "isLoadMore": "true"
            }
            
            try:
                # Bỏ qua kiểm tra SSL bằng verify=False
                response = session.get(base_url, params=params, verify=False)
                
                if response.status_code != 200:
                    print(f"Lỗi truy cập: {response.status_code}")
                    break

                soup = BeautifulSoup(response.text, 'html.parser')
                
                # 1. Tìm đúng bảng chứa chuyến bay
                table = soup.find('table', id='flightTable')
                if not table:
                    print(f"-> Không tìm thấy bảng dữ liệu trên trang {page}.")
                    break
                
                # 2. Tìm phần thân bảng (tbody)
                tbody = table.find('tbody')
                if not tbody:
                    print(f"-> Bảng không có thẻ tbody. Dừng quét chiều {label}.")
                    break

                # 3. Quét các dòng dữ liệu Desktop trong tbody
                rows = tbody.find_all('tr', class_=lambda x: x and 'datarows' in x and 'd-lg-table-row' in x)
                
                # CHỐT CHẶN TỐI ƯU: Nếu danh sách rows rỗng (tbody trống), lặp tức dừng lại!
                if len(rows) == 0:
                    print(f"-> Nhận thấy tbody trống ở trang {page}. Đã quét xong chiều {label}!")
                    break

                # Xử lý bóc tách dữ liệu
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) >= 8:
                        # Trích xuất thời gian
                        time_divs = cols[0].find_all('div')
                        if len(time_divs) >= 2:
                            scheduled_time = time_divs[0].text.strip()
                            estimated_time = time_divs[1].text.strip()
                        else:
                            time_col = " ".join(cols[0].text.split())
                            time_parts = [part.strip() for part in time_col.split("/")]
                            scheduled_time = time_parts[0] if len(time_parts) > 0 and time_parts[0] else None
                            estimated_time = time_parts[1] if len(time_parts) > 1 and time_parts[1] else scheduled_time
                        
                        # Hãng và Mã chuyến bay
                        airline = cols[3].text.strip()
                        raw_flight_no = cols[4].text.strip()
                        flight_no = raw_flight_no.replace(airline, '').strip()
                        
                        flight_data = {
                            "Data Retrieved At (VN)": scrape_time,
                            "Direction": label,
                            "Scheduled Time": scheduled_time,
                            "Estimated Time": estimated_time,
                            "Airport": cols[1].text.strip(),
                            "Flight Number": flight_no,
                            "Status": cols[7].text.strip()
                        }

                        all_flights.append(flight_data)
                
                page += 1
                time.sleep(1) # Tránh bị Server chặn

            except Exception as e:
                print(f"Có lỗi xảy ra: {e}")
                break

    df_final = pd.DataFrame(all_flights)
    expected_columns = [
        "Data Retrieved At (VN)",
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

target_date = "2026-04-09"
target_terminal = "1" # Dùng "1" cho Quốc nội, "2" cho Quốc tế, hoặc để "" quét cả hai

df_danang = get_danang_all_flights_paginated(date=target_date, terminal=target_terminal)

if not df_danang.empty:
    print("\n" + "="*70)
    print(f" DỮ LIỆU TỔNG HỢP ĐÀ NẴNG ({target_date}) - HOÀN THIỆN")
    print("="*70)
    print(df_danang.head(10).to_string(index=False))
    print("...")
    print(df_danang.tail(5).to_string(index=False))
    print(f"\n=> Tổng cộng thu thập được: {len(df_danang)} chuyến bay.")

    code_dir = Path(__file__).resolve().parent
    output_path = code_dir / "data" / "raw" / "DN.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_danang.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"Saved file: {output_path}")
else:
    print("Không thu thập được dữ liệu nào.")