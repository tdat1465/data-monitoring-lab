# Flight Delay Monitoring & Prediction

> **Mục tiêu:** Xây dựng mô hình dự báo một chuyến bay cụ thể sẽ bị trễ bao nhiêu phút, dựa trên điều kiện thời tiết tại điểm đi, điểm đến và các trạm trung chuyển.

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Nguồn dữ liệu](#nguồn-dữ-liệu)
- [Quy trình xử lý dữ liệu](#quy-trình-xử-lý-dữ-liệu)
- [Tập dữ liệu huấn luyện](#tập-dữ-liệu-huấn-luyện)
- [Triển khai](#triển-khai)
- [Phát triển tiếp](#phát-triển-tiếp)

---

## Tổng quan

Dự án thu thập dữ liệu **chuyến bay thực tế** từ 3 sân bay lớn nhất Việt Nam và **thời tiết aviation (METAR)** từ NOAA, lưu trữ vào PostgreSQL, xử lý thành tập huấn luyện có nhãn, sẵn sàng cho việc xây dựng mô hình dự báo độ trễ.

### Các sân bay được giám sát

| Mã | Tên | ICAO |
|----|-----|------|
| NB | Nội Bài (Hà Nội) | VVNB |
| DN | Đà Nẵng | VVDN |
| TSN | Tân Sơn Nhất (TP.HCM) | VVTS |

---

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Collection Layer                    │
│  ┌──────────────┐  ┌──────────────┐   ┌──────────────────┐  │
│  │ NBFlightData │  │ DNFlightData │   │  TSNFlightData   │  │
│  │ (Noi Bai)    │  │ (Da Nang)    │   │  (Tan Son Nhat)  │  │
│  └──────┬───────┘  └──────┬───────┘   └────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────┴─────────────────┴────────────────────┴────────┐   │
│  │              weatherData.py (NOAA METAR)             │   │
│  └──────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────┐  │ 
│  │ flights_nb │  │ flights_dn │  │ flights_tsn│  │weather│  │
│  └────────────┘  └────────────┘  └────────────┘  └───────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Data Processing Pipeline (Jupyter)            │
│  B1: Load from DB  →  B2: Normalize  →  B3: Parse datetime  │
│  B4: Snapshot & dedup  →  B5: Weather prep  →  B6: Merge    │
│  B7: Feature engineering  →  B8: Save labeled dataset       │
└─────────────────────────────────────────────────────────────┘
```

Dữ liệu được thu thập **mỗi 30 phút** qua GitHub Actions, đảm bảo luồng dữ liệu liên tục mà không cần server riêng.

---

## Cấu trúc thư mục

```
ida-data-monitoring/
├── .github/workflows/collect-data.yml    # GitHub Actions: chạy collect mỗi 30 phút
├── requirements.txt                       # Python dependencies
├── README.md
│
├── Data Collection + Processing/
│   ├── collect_all.py                     # Entry point: gọi lần lượt 4 collector
│   ├── db_utils.py                        # Tiện ích PostgreSQL (load/save)
│   │
│   ├── NBFlightData.py                   # Scrape noibaiairport.vn (Nội Bài)
│   ├── DNFlightData.py                   # Scrape danangairport.vn (Đà Nẵng)
│   ├── TSNFlightData.py                   # Scrape tia.vietnamairport.vn (Tân Sơn Nhất)
│   ├── weatherData.py                    # Gọi NOAA METAR API (3 sân bay)
│   │
│   ├── dataProcessing.ipynb               # 9 bước xử lý dữ liệu
│   │
│   └── data/
│       ├── raw/                          # Dữ liệu thô (CSV)
│       │   ├── NB.csv    (1340 dòng)
│       │   ├── DN.csv    (691 dòng)
│       │   ├── TSN.csv   (172 dòng)
│       │   └── weather.csv (544 dòng)
│       └── processed/                    # Dữ liệu đã xử lý
│           ├── flights_current_snapshot.csv
│           ├── flights_training_snapshot.csv
│           ├── flights_clean_all_snapshots.csv
│           ├── weather_clean.csv
│           └── training_dataset_labeled.csv  ← Tập huấn luyện (1098 mẫu)
│
└── EDA/
    └── data_exploration.ipynb             # Phân tích khám phá dữ liệu (EDA)
```

---

## Nguồn dữ liệu

### Dữ liệu chuyến bay (Web Scraping)

| Sân bay | Nguồn | API endpoint |
|---------|-------|-------------|
| Nội Bài (NB) | [noibaiairport.vn](https://noibaiairport.vn) | `/vi/arrivals`, `/vi/departures` |
| Đà Nẵng (DN) | [danangairport.vn](https://danangairport.vn) | `/flights-flight-status-arrival/arrival-flight`, `/flights-flight-status-departure/departure-flight` |
| Tân Sơn Nhất (TSN) | [tia.vietnamairport.vn](https://tia.vietnamairport.vn) | `/FlightSchedule/getData` (AJAX) |

Mỗi collector trả về các trường:

| Trường | Mô tả |
|--------|-------|
| `data_retrieved_at_vn` | Thời điểm thu thập (giờ Việt Nam) |
| `flight_date` | Ngày bay |
| `direction` | `Arrival` / `Departure` |
| `scheduled_time` | Giờ cất cánh / hạ cánh theo lịch |
| `estimated_time` | Giờ dự kiến thực tế |
| `route_airport` | Sân bay đối tác (điểm đi / đến) |
| `flight_number` | Mã chuyến bay (VD: VJ1208) |
| `status` | Trạng thái chuyến bay (Tiếng Việt) |

### Dữ liệu thời tiết (METAR - NOAA API)

API: `https://aviationweather.gov/api/data/metar`

| Trường | Mô tả |
|--------|-------|
| `icao_code` | Mã ICAO sân bay (VVNB, VVDN, VVTS) |
| `report_time_vn` | Thời gian bản tin (giờ Việt Nam) |
| `temperature_c` | Nhiệt độ (°C) |
| `dew_point_c` | Điểm sương (°C) |
| `wind_direction_deg` | Hướng gió (độ) |
| `wind_speed_kt` | Tốc độ gió (knots) |
| `visibility_miles` | Tầm nhìn (dặm) |
| `cloud_cover` | Lớp mây (VD: `FEW@1100ft, BKN@2000ft`) |
| `raw_metar` | Bản tin METAR thô |

---

## Quy trình xử lý dữ liệu

`dataProcessing.ipynb` thực hiện 9 bước:

| Bước | Nội dung |
|------|----------|
| **1. Load từ PostgreSQL** | Đọc 4 bảng (`flights_nb`, `flights_dn`, `flights_tsn`, `weather_metar`), hợp nhất thành `flights_raw` |
| **2. Chuẩn hóa schema** | Đổi tên cột về snake_case, làm sạch text (space, dấu tiếng Việt), map trạng thái bay → nhóm (`landed`, `delayed`, `on_time`, `cancelled`, `unknown`) |
| **3. Parse datetime** | Parse giờ `HH:MM`, xử lý trường hợp chuyến bay khuya qua ngày, tính `delay_minutes`, tạo nhãn `label_delay` (trễ ≥ 15 phút = 1, ngược lại = 0) |
| **4. Snapshot & dedup** | Tạo `flight_key` (source + direction + route + flight_number + scheduled_dt), loại trùng lặp, tạo 2 snapshot: **current** (mới nhất) và **training** (bản ghi ≤ 30 phút trước giờ bay, ưu tiên thay đổi status) |
| **5. Tiền xử lý weather** | Map ICAO → mã sân bay, coerce kiểu numeric, xử lý tầm nhìn và gió |
| **6. Merge weather** | Dùng `merge_asof` ghép bản tin thời tiết **gần nhất trước** thời điểm crawl cho từng sân bay |
| **7. Feature engineering** | Tạo features: `scheduled_hour`, `dayofweek`, `month`, `airline_code`, `minutes_to_departure_at_snapshot`, `temp_dew_spread`, `is_low_visibility` |
| **8. Lưu PostgreSQL** | Ghi `training_dataset_labeled` lên database |
| **9. Kiểm tra** | Thống kê tỷ lệ delay và số mẫu theo sân bay |

---

## Tập dữ liệu huấn luyện

| Sân bay | Số mẫu | Tỷ lệ delay | Độ trễ TB (phút) |
|---------|--------|-------------|-----------------|
| Đà Nẵng (DN) | 268 | 11.94% | 4.99 |
| Nội Bài (NB) | 510 | 25.88% | 10.91 |
| Tân Sơn Nhất (TSN) | 320 | 35.62% | 16.33 |
| **Tổng** | **1098** | | |

### Tập feature hiện tại (35 features)

| Nhóm | Features |
|------|----------|
| Thời gian | `scheduled_hour`, `scheduled_dayofweek`, `scheduled_month`, `minutes_to_departure_at_snapshot` |
| Chuyến bay | `source_airport`, `direction`, `route_airport_std`, `flight_number`, `airline_code`, `flight_num_only`, `is_estimated_missing` |
| Thời tiết | `temperature_c`, `dew_point_c`, `wind_direction_deg`, `wind_speed_kt`, `visibility_miles`, `cloud_cover`, `temp_dew_spread`, `is_low_visibility`, `is_wind_variable` |
| Target | `delay_minutes`, `label_delay` |

---

## Triển khai

### 1. Cài đặt

```bash
pip install -r requirements.txt
```

### 2. Cấu hình database

Tạo file `.env` trong thư mục gốc (hoặc `Data Collection + Processing/`):

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### 3. Thu thập dữ liệu (thủ công)

```bash
python "Data Collection + Processing/collect_all.py"
```

Collector chạy theo thứ tự: TSN → NB → DN → Weather. Mỗi collector ghi trực tiếp vào PostgreSQL.

### 4. Chạy pipeline xử lý

Mở và chạy `dataProcessing.ipynb` (các cell từ 1 → 9). Notebook tự động:

- Tìm `DATABASE_URL` trong `.env`
- Load dữ liệu từ PostgreSQL
- Xuất kết quả ra `data/processed/`

### 5. GitHub Actions

Workflow `.github/workflows/collect-data.yml` chạy mỗi **30 phút**, gọi `collect_all.py`. Cần thiết lập secret `DATABASE_URL` trong repository settings.

---

## Phát triển tiếp

- [ ] **Mở rộng sân bay**: Thêm các sân bay khác (Cần Thơ, Phú Quốc, Nha Trang...)
- [ ] **Dữ liệu transit**: Thu thập thêm thời tiết tại các sân bay trung chuyển để cải thiện dự báo cho chuyến bay nối chuyến
- [ ] **Cải thiện nhãn**: Sử dụng `actual_departure_time`/`actual_arrival_time` (sau khi chuyến bay hoàn thành) thay vì `estimated_time`
- [ ] **Mô hình dự báo**: Huấn luyện mô hình hồi quy/ranking để dự báo số phút trễ cụ thể
- [ ] **Dashboard realtime**: Hiển thị trạng thái chuyến bay và dự báo delay trực tiếp
- [ ] **Kiểm thử**: Thêm unit test cho các bước xử lý và collector

---

## Dependencies

```
requests
pandas
beautifulsoup4
psycopg2-binary
tzdata
```
