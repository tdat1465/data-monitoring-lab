import requests
import time
import pandas as pd
from pathlib import Path

def get_tia_flights(flight_type="arrival", max_pages=2):
    session = requests.Session()
    
    # 1. Xác định URL và Referer dựa trên chiều bay
    if flight_type == "arrival":
        referer_url = "https://tia.vietnamairport.vn/arrivals-vn"
        print("\n🛬 ĐANG LẤY DỮ LIỆU CHIỀU ĐẾN (ARRIVALS) 🛬")
        flight_direction = "Arrival"
    elif flight_type == "departure":
        referer_url = "https://tia.vietnamairport.vn/departures-vn"
        print("\n🛫 ĐANG LẤY DỮ LIỆU CHIỀU ĐI (DEPARTURES) 🛫")
        flight_direction = "Departure"
    else:
        print("Loại chuyến bay không hợp lệ!")
        return pd.DataFrame()

    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "vi;q=0.5",
        "Connection": "keep-alive",
        "Host": "tia.vietnamairport.vn",
        "Origin": "https://tia.vietnamairport.vn",
        "Referer": referer_url, # Cực kỳ quan trọng: Báo cho server biết ta đang ở trang nào
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest"
    }
    session.headers.update(headers)

    url_get_time = "https://tia.vietnamairport.vn/FlightSchedule/getTime"
    url_get_data = "https://tia.vietnamairport.vn/FlightSchedule/getData"

    all_flights = []

    try:
        # 2. BƯỚC MỚI CỰC QUAN TRỌNG: Truy cập trang chủ trước để Server set đúng Cookie cho Chiều đi/đến
        session.get(referer_url) 
        
        # 3. Khởi tạo luồng (Reset biến đếm trang)
        print("Đang khởi tạo kết nối (getTime)...")
        session.post(url_get_time)

        # 4. Vòng lặp quét các trang
        for current_page in range(1, max_pages + 1):
            print(f"--- Lấy dữ liệu TRANG {current_page} ---")
            
            payload_data = {
                "computerName": "T2AOSA01A",
                "page": current_page,
                "LastModifiedDate": "6/22/2021 3:26:21 PM",
                "FlightViewLastModifiedDate": "5/26/2021 8:51:25 AM",
                "FlightViewTemplateLastModifiedDate": "6/17/2021 3:19:52 PM"
            }
            
            response = session.post(url_get_data, data=payload_data)
            
            if response.status_code == 200:
                json_data = response.json() 
                flights = json_data.get("Flights", [])
                
                for f in flights:
                    all_flights.append({
                        "Direction": flight_direction,
                        "Scheduled Time": f.get("Scheduled"),
                        "Estimated Time": f.get("Estimated"),
                        "Airport": f.get("Airport"),
                        "Flight Number": f.get("FlightNo"),
                        "Status": f.get("RemarkVn")
                    })
            else:
                print(f"Lỗi: {response.status_code}")
                break
            
            time.sleep(1) # Nghỉ 1s tránh bị chặn IP

    except Exception as e:
        print(f"Có lỗi xảy ra: {e}")

    # Trả về DataFrame
    return pd.DataFrame(all_flights)

# ==========================================
# CHẠY THỬ VÀ GỘP DỮ LIỆU
# ==========================================

# 1. Lấy dữ liệu 2 trang chiều Đến
df_arrivals = get_tia_flights(flight_type="arrival", max_pages=2)

# 2. Lấy dữ liệu 2 trang chiều Đi
df_departures = get_tia_flights(flight_type="departure", max_pages=2)

# 3. Gộp 2 bảng lại thành 1 tập dữ liệu (Dataset) hoàn chỉnh
# ignore_index=True giúp đánh lại số thứ tự từ 0 cho toàn bộ bảng
df_all = pd.concat([df_arrivals, df_departures], ignore_index=True)
collected_at_vn = pd.Timestamp.now(tz="Asia/Ho_Chi_Minh").strftime("%Y-%m-%d %H:%M:%S")
flight_date = collected_at_vn.split(" ")[0]
df_all.insert(0, "Data Retrieved At (VN)", collected_at_vn)
df_all.insert(1, "Flight Date", flight_date)

print("\n\n" + "="*50)
print(f"\n=> Tổng cộng thu thập được: {len(df_all)} chuyến bay.")

code_dir = Path(__file__).resolve().parent
output_path = code_dir / "data" / "raw" / "TSN.csv"
output_path.parent.mkdir(parents=True, exist_ok=True)
df_all.to_csv(output_path, index=False, encoding="utf-8-sig")
print(f"Saved file: {output_path}")