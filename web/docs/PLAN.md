# Flight Delay Prediction — Web Application Plan

> **Project:** Trang web hiển thị kết quả dự báo độ trễ chuyến bay theo thời gian thực (runtime).
>
> **Parent project:** `ida-data-monitoring` — hệ thống thu thập dữ liệu chuyến bay và thời tiết từ 3 sân bay lớn nhất Việt Nam (Nội Bài, Đà Nẵng, Tân Sơn Nhất) vào PostgreSQL.
>
> **Stack đề xuất:** Next.js (frontend + API routes) + Python (inference worker) + PostgreSQL.
>
> **Kiến trúc áp dụng:** ISR + PostgreSQL (không Redis) + Server-Sent Events (SSE).

---

## Mục lục

- [1. Tổng quan bài toán](#1-tổng-quan-bài-toán)
- [2. Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
- [3. Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
- [4. Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
- [5. Thiết kế database schema](#5-thiết-kế-database-schema)
- [6. Database queries — Next.js API](#6-database-queries--nextjs-api)
- [7. Inference Worker — Python subprocess](#7-inference-worker--python-subprocess)
- [8. API Layer — Next.js API Routes](#8-api-layer--nextjs-api-routes)
- [9. Frontend — Next.js Pages & Components](#9-frontend--nextjs-pages--components)
- [10. Real-time: Server-Sent Events (SSE)](#10-real-time-server-sent-events-sse)
- [11. Authentication & Authorization](#11-authentication--authorization)
- [12. Deployment](#12-deployment)
- [13. Monitoring & Observability](#13-monitoring--observability)
- [14. Roadmap](#14-roadmap)
- [15. Tech stack tổng hợp](#15-tech-stack-tổng-hợp)

---

## 1. Tổng quan bài toán

### 1.1. Bối cảnh

Hệ thống hiện tại (`ida-data-monitoring`) đã xây dựng xong:

- **Thu thập dữ liệu** từ 3 sân bay + thời tiết METAR từ NOAA, lưu vào PostgreSQL mỗi 30 phút qua GitHub Actions.
- **Xử lý dữ liệu** qua `src/processing.py`, tạo bảng `flights_current_snapshot` với 35 features.
- **Huấn luyện model** Two-Stage (Classifier + Regressor) bằng scikit-learn, lưu tại `Data Modeling/artifacts/delay_model_twostage.joblib`.
- **Inference** qua `src/inference.py`, ghi kết quả vào bảng `flights_predictions` trong PostgreSQL.

**Trạ thái hiện tại:** Toàn bộ pipeline Python đã hoạt động. Bước tiếp theo là xây dựng trang web Next.js để hiển thị kết quả dự báo runtime.

### 1.2. Mục tiêu trang web

Trang web cần đạt các mục tiêu sau:

1. **Hiển thị danh sách chuyến bay hôm nay** tại 3 sân bay với trạng thái realtime.
2. **Dự báo độ trễ** (số phút) cho mỗi chuyến bay dựa trên mô hình ML và thời tiết hiện tại.
3. **Cập nhật tự động** khi có chuyến bay mới hoặc khi dự báo thay đổi (không cần reload trang).
4. **Cho phép tra cứu** theo mã chuyến bay, sân bay đi/đến, hãng bay.
5. **Hiển thị thời tiết** tại các sân bay liên quan (nhiệt độ, tầm nhìn, gió, mây).

### 1.3. Ràng buộc kỹ thuật

| Ràng buộc | Mô tả |
|-----------|--------|
| **Latency** | First Contentful Paint < 2s |
| **Data freshness** | Prediction cập nhật mỗi 3-5 phút (mỗi khi inference worker chạy) |
| **Concurrency** | Hỗ trợ tối thiểu 50-100 user đồng thời |
| **Không polling liên tục** | Dùng SSE thay vì polling |
| **SEO-friendly** | Trang chính render HTML đầy đủ (Server Components) |
| **Inference** | Chạy bằng Python subprocess (không cần ONNX) |

---

## 2. Yêu cầu hệ thống

### 2.1. Chức năng chính

#### F1: Dashboard tổng quan
- Hiển thị tất cả chuyến bay hôm nay tại 3 sân bay.
- Bảng với các cột: Mã chuyến bay, Sân bay đi, Sân bay đến, Giờ bay, Giờ dự kiến, Trạng thái, Dự đoán delay (phút), Độ tin cậy.
- Filter theo: sân bay gốc, sân bay đích, hãng bay, trạng thái (on-time / delayed / cancelled).
- Sort theo: giờ bay, mức độ delay dự đoán, trạng thái.
- Tổng số chuyến bay, tỷ lệ delay hiện tại, thời gian cập nhật gần nhất.

#### F2: Tra cứu chuyến bay cụ thể
- Search box: nhập mã chuyến bay (VD: `VJ1208`) → hiển thị thông tin chi tiết.
- Trang chi tiết cho từng chuyến bay: lịch sử trạng thái, timeline thay đổi, thời tiết tại điểm đi/đến, dự đoán delay theo thời gian.

#### F3: Thời tiết realtime
- Hiển thị thời tiết hiện tại tại 3 sân bay (Nội Bài, Đà Nẵng, Tân Sơn Nhất).
- Card cho mỗi sân bay: ICAO, nhiệt độ, điểm sương, hướng/tốc độ gió, tầm nhìn, lớp mây, thời gian bản tin.
- Chỉ báo màu: xanh (tầm nhìn > 5 dặm), vàng (3-5 dặm), đỏ (< 3 dặm).

#### F4: Thống kê & Biểu đồ
- Tỷ lệ delay theo sân bay (pie chart).
- Số chuyến bay theo giờ trong ngày (bar chart).
- Phân bố độ trễ dự đoán (histogram).
- Xu hướng delay 7 ngày gần nhất (line chart).

#### F5: Thông báo
- Cảnh báo khi chuyến bay có dự đoán delay > 30 phút.
- SSE notification cho user đang theo dõi chuyến bay cụ thể.

### 2.2. Các trang (pages)

| Route | Mô tả | Loại |
|-------|--------|------|
| `/` | Dashboard tổng quan, tất cả chuyến bay hôm nay | Server Component (ISR) |
| `/flights/[flightKey]` | Chi tiết chuyến bay cụ thể | Server Component |
| `/weather` | Thời tiết realtime 3 sân bay | Server Component |
| `/stats` | Thống kê & biểu đồ | Client Component |
| `/api/flights` | API: danh sách chuyến bay + predictions | API Route |
| `/api/flights/[flightKey]` | API: chi tiết 1 chuyến bay | API Route |
| `/api/weather` | API: thời tiết realtime | API Route |
| `/api/stream` | SSE stream: real-time updates | API Route (SSE) |

---

## 3. Kiến trúc hệ thống

### 3.1. Sơ đồ kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IDA Data Monitoring System                           │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │  flights_nb  │    │  flights_dn  │    │ flights_tsn  │    │  weather │ │
│  │   (raw)     │    │   (raw)      │    │   (raw)      │    │  _metar  │ │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └────┬─────┘ │
│         └──────────────────┼──────────────────┼──────────────────┘        │
│                            ▼                                              │
│                   ┌────────────────┐                                     │
│                   │  PostgreSQL    │◄──── GitHub Actions (30 phút)       │
│                   │  Supabase      │                                     │
│                   └───────┬────────┘                                     │
│                           │                                              │
│         ┌─────────────────┼─────────────────┐                          │
│         ▼                 ▼                 ▼                          │
│  ┌─────────────┐  ┌────────────────┐  ┌─────────────────┐              │
│  │ processing   │  │flights_current │  │ training_dataset │              │
│  │ .py         │─►│_snapshot      │  │ _labeled        │              │
│  └─────────────┘  └───────┬────────┘  └─────────────────┘              │
│                            │                                             │
│                            ▼                                             │
│                   ┌────────────────┐     ┌─────────────┐                 │
│                   │ inference.py    │────►│flights_     │                 │
│                   │                │     │predictions │                 │
│                   └───────┬────────┘     └──────┬──────┘                 │
│                           │                     │                          │
└───────────────────────────┼─────────────────────┼──────────────────────────┘
                            │                     │
                            ▼                     ▼
                   ┌────────────────────────────────┐
                   │       Next.js Web App          │
                   │                                │
                   │  /           /flights          │
                   │  /weather    /stats            │
                   │  /api/*                         │
                   └────────────────────────────────┘
```

### 3.2. Luồng dữ liệu end-to-end

```
Data Source ──► PostgreSQL ──► Processing ──► Inference ──► Web Dashboard
(crawl/NOAA)     (Supabase)    (Python)     (Python)      (Next.js)
    │                                  │
    └──────────────────────────────────┘
              (Database tables)
```

---

### 3.3. Luồng dữ liệu đầy đủ (4 giai đoạn) + Latency

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 1: THU THẬP (Collect)                                              │
│  Latency: ~30 phút (GitHub Actions cron)                                      │
│─────────────────────────────────────────────────────────────────────────────────────│
│                                                                                    │
│  GitHub Actions (mỗi 30 phút)                                                    │
│       │                                                                          │
│       ▼                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  flights_nb  │  flights_dn  │  flights_tsn  │  weather_metar                 │  │
│  │  (Nội Bài) │  (Đà Nẵng)  │  (Tân Sơn)   │  (METAR - NOAA)              │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼  ~30 phút
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 2: XỬ LÝ (Processing) — processing.py                               │
│  Latency: Manual / ~2-5 phút (nếu auto)                                     │
│─────────────────────────────────────────────────────────────────────────────────────│
│                                                                                    │
│  Step 1: Load raw data          (17,868 flights, 3,285 weather records)            │
│      │                                                                          │
│      ▼                                                                          │
│  Step 2: Normalize columns & text                                                │
│      │  - Rename columns to snake_case                                          │
│      │  - Map status: "Đã đến" → "landed", "Đúng giờ" → "on_time"...           │
│      │  - Standardize flight numbers & airport codes                            │
│      ▼                                                                          │
│  Step 3: Parse datetime & calculate delay                                        │
│      │  - Handle cross-day flights (late night flights)                          │
│      │  - Calculate delay_minutes = estimated - scheduled                       │
│      │  - Create label_delay: ≥15min = 1, <15min = 0                           │
│      ▼                                                                          │
│  Step 4: Create snapshots & deduplication                                        │
│      │  - Create flight_key = source|dir|route|flight|scheduled_dt              │
│      │  - Deduplicate by flight_key + retrieved_at_vn                          │
│      │  - flights_current_snapshot (10,262 rows) - latest status                │
│      │  - flights_training_snapshot (9,802 rows) - status changes only          │
│      ▼                                                                          │
│  Step 5: Normalize weather data                                                 │
│      │  - Map ICAO codes: VVNB→NB, VVDN→DN, VVTS→TSN                         │
│      │  - Coerce numeric columns (temp, wind, visibility)                       │
│      │  - Handle variable wind direction (VRB)                                 │
│      ▼                                                                          │
│  Step 6: Merge weather via ASOF join                                           │
│      │  - Match weather report closest BEFORE flight retrieval time             │
│      │  - Tolerance: 3 hours                                                  │
│      │  - Weather match rate: 100%                                           │
│      ▼                                                                          │
│  Step 7: Feature engineering                                                   │
│      │  - Time features: hour, dayofweek, month (with cyclical encoding)       │
│      │  - Flight features: airline_code, flight_num_only                      │
│      │  - Weather features: visibility_bin, is_low_visibility,                │
│      │                      temp_dew_spread                                    │
│      │  - Fix data leakage: drop rows where snapshot_time > scheduled_time    │
│      ▼                                                                          │
│  OUTPUT:                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  flights_current_snapshot (10,262 rows)                                   │ │
│  │  training_dataset_labeled (3,358 rows)                                    │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼  ~2-5 phút
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 3: DỰ BÁO (Inference) — inference.py                               │
│  Latency: ~5-30 giây (phụ thuộc số lượng flights)                          │
│─────────────────────────────────────────────────────────────────────────────────────│
│                                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  Load: flights_current_snapshot                                          │ │
│  └─────────────────────────────┬────────────────────────────────────────────┘ │
│                                │                                               │
│                                ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  Load Model: delay_model_twostage.joblib                                  │ │
│  │  Two-Stage Pipeline:                                                     │ │
│  │    Stage 1: Classifier (delay vs on-time)                               │ │
│  │    Stage 2: Regressor (predict minutes)                                 │ │
│  └─────────────────────────────┬────────────────────────────────────────────┘ │
│                                │                                               │
│                                ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  model.predict(X) ──► predict_delay_minutes                              │ │
│  └─────────────────────────────┬────────────────────────────────────────────┘ │
│                                │                                               │
│                                ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  INSERT ON CONFLICT UPDATE: flights_predictions                          │ │
│  │  │                                                                          │ │
│  │  │  ⏱️ ~0ms (internal PostgreSQL)                                       │ │
│  │  │                                                                          │ │
│  │  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  │  PostgreSQL TRIGGER fires → pg_notify('prediction_update', ...)    │ │ │
│  │  │  │     ⏱️ ~0ms (same transaction)                                      │ │ │
│  │  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼  ~0ms (NOTIFY)
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 4: HIỂN THỊ (Web) — Next.js + SSE                                 │
│  Latency: ~50ms - 26 giây (real-time với short listen pattern)              │
│─────────────────────────────────────────────────────────────────────────────────────│
│                                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  SSE Endpoint (/api/stream)                                              │ │
│  │  │                                                                          │ │
│  │  │  DbListener receives pg_notify()                                        │ │
│  │  │  ⏱️ ~0ms                                                               │ │
│  │  │                                                                          │ │
│  │  ▼                                                                          │ │
│  │  controller.enqueue() ──► SSE event: notification                        │ │
│  │  ⏱️ ~0-25ms (network latency)                                            │ │
│  └─────────────────────────────┬────────────────────────────────────────────┘ │
│                                │                                               │
│                                ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  Client (useSSE hook)                                                    │ │
│  │  │                                                                          │ │
│  │  │  onNotification callback triggered                                    │ │
│  │  │  ⏱️ ~16ms (React re-render)                                          │ │
│  │  │                                                                          │ │
│  │  ▼                                                                          │ │
│  │  setState() ──► UI updates                                               │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │  SHORT LISTEN PATTERN (Option B) — Serverless Compatible                 │ │
│  │                                                                          │ │
│  │  Listen 25s ──► Reconnect 1s ──► Listen 25s ──► Reconnect 2s ──► ... │ │
│  │       │              │              │              │                    │ │
│  │       │              │              │              │                    │ │
│  │       └──────────────┴──────────────┴──────────────┘                    │ │
│  │                    Auto-reconnect (exponential backoff)                   │ │
│  │                                                                          │ │
│  │  ✓ Best case latency:  ~50ms (NOTIFY → UI update)                       │ │
│  │  ✓ Worst case latency: ~26 giây (vừa reconnect xong)                 │ │
│  │  ✓ Average latency:     ~0-2 giây                                       │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Latency Summary:**

| Giai đoạn | Thành phần | Best Case | Worst Case | Average |
|-----------|------------|-----------|------------|---------|
| 1. Thu thập | GitHub Actions → DB | 30 phút | 30 phút | 30 phút |
| 2. Xử lý | processing.py → DB | Manual | ~5 phút | Manual |
| 3. Dự báo | inference.py → DB | ~5 giây | ~30 giây | ~10 giây |
| 4. Hiển thị | NOTIFY → UI | ~50ms | ~26 giây | ~0-2 giây |
| **Tổng (sau crawl)** | Raw → UI | **~10 giây** | **~5 phút** | **~2-3 phút** |

**So sánh: Trước vs Sau khi có SSE**

| Metric | Trước (ISR) | Sau (SSE + LISTEN/NOTIFY) |
|--------|-------------|---------------------------|
| Latency Inference → UI | 60-180 giây | ~50ms - 26 giây |
| Cơ chế | Cache refresh | Real-time push |
| Tương thích serverless | ✅ | ✅ (short listen) |

**Training Dataset Stats:**

| Sân bay | Mẫu | Delay rate | Avg delay |
|---------|------|------------|-----------|
| DN (Đà Nẵng) | 3,145 | 0.45% | 0.49 phút |
| NB (Nội Bài) | 138 | 10.14% | -18.66 phút (sớm!) |
| TSN (Tân Sơn) | 75 | 32.00% | 6.69 phút |

**Trạng thái hiện tại từng giai đoạn:**

| Giai đoạn | Trạng thái | Tự động? |
|-----------|-----------|---------|
| 1. Thu thập (collect) | Hoạt động | GitHub Actions mỗi 30 phút |
| 2. Xử lý (processing) | Có code | Chạy thủ công |
| 3. Dự báo (inference) | Có code | Chạy thủ công |
| 4. Hiển thị (web) | Hoạt động | Next.js |

**Thứ tự chạy để cập nhật dữ liệu:**

```bash
# 1. GitHub Actions tự động crawl dữ liệu (mỗi 30 phút)
#    → flights_nb, flights_dn, flights_tsn, weather_metar

# 2. Chạy processing để tạo snapshot
python src/processing.py
#    → flights_current_snapshot, training_dataset_labeled

# 3. Chạy inference để tạo predictions
python src/inference.py
#    → flights_predictions

# 4. Dashboard tự động hiển thị dữ liệu mới
```

---

## 4. Cấu trúc thư mục

Thư mục `web/` chứa toàn bộ mã nguồn Next.js cho ứng dụng web.

Cấu trúc chính:
- `docs/PLAN.md` — File plan này
- `src/app/` — Next.js App Router với các trang và API routes
- `src/components/` — React components (UI primitives và domain-specific components)
- `src/lib/` — Shared utilities (database queries, utilities)
- `src/types/` — TypeScript type definitions
- `src/hooks/` — React hooks (useFlights, useWeather, useSSE)
- `tests/` — Unit, integration, và E2E tests

Inference Worker sử dụng lại các scripts Python có sẵn: `src/inference.py`, `src/processing.py`, và model tại `Data Modeling/artifacts/delay_model_twostage.joblib`.

---

## 5. Thiết kế database schema

### 5.1. Các bảng hiện có (từ ida-data-monitoring)

Hệ thống hiện tại bao gồm các bảng sau:

- **Bảng chuyến bay theo sân bay:** `flights_nb`, `flights_dn`, `flights_tsn` — lưu dữ liệu thô từ các trang web sân bay
- **Bảng thời tiết:** `weather_metar` — lưu dữ liệu METAR từ NOAA
- **Bảng snapshot:** `flights_current_snapshot` — bản ghi mới nhất của mỗi chuyến bay với features đã chuẩn hóa
- **Bảng training:** `training_dataset_labeled` — dữ liệu đã gán nhãn cho huấn luyện model

### 5.2. Bảng predictions (đã tồn tại)

Bảng `flights_predictions` được tạo bởi `src/inference.py` — bảng này đã tồn tại trong DB. Web app chỉ cần SELECT từ bảng này.

Cấu trúc bảng:
- `flight_key TEXT PRIMARY KEY` — khóa ghép từ thông tin chuyến bay
- `predict_delay_minutes NUMERIC` — số phút dự đoán delay
- `model_version TEXT` — phiên bản model đã sử dụng
- `predicted_at TIMESTAMPTZ` — thời điểm dự đoán

### 5.3. ERD web app



---

## 6. Database queries - Next.js API

### 6.1. Ket noi PostgreSQL

Kết nối PostgreSQL sử dụng thư viện `pg` với connection pooling. Cấu hình:
- Số connection tối đa: 20
- Idle timeout: 30 giây
- Connection timeout: 2 giây

### 6.2. Query: danh sach chuyen bay + predictions

Query này lấy danh sách chuyến bay hôm nay kèm dự đoán, bao gồm:
- Thông tin chuyến bay từ `flights_current_snapshot`
- Dự đoán từ `flights_predictions`
- Thời tiết liên quan (temperature, visibility, wind, cloud)
- Filter: chỉ lấy active flights (không bao gồm đã hạ cánh, đã cất cánh, đã hủy)

### 6.3. Query: thoi tiet moi nhat

Query lấy thời tiết mới nhất cho 3 sân bay (VVNB, VVDN, VVTS) từ bảng `weather_metar`.

### 6.4. Query: chi tiet 1 chuyen bay

Query lấy chi tiết một chuyến bay theo `flight_key`, bao gồm:
- Thông tin chuyến bay hiện tại
- Dự đoán delay
- Lịch sử trạng thái từ bảng gốc (flights_nb/dn/tsn)

---

## 7. Inference Worker - Python subprocess

### 7.1. Tong quan

Inference worker là script Python đã có sẵn: **src/inference.py**. Script này:

1. Đọc `flights_current_snapshot` từ PostgreSQL
2. Load model `delay_model_twostage.joblib`
3. Chạy `model.predict()` cho tất cả active flights
4. Ghi kết quả vào bảng `flights_predictions` (INSERT ON CONFLICT UPDATE)

**Luu y:** Không cần gọi NOTIFY thủ công. PostgreSQL trigger (section 10.3.1) sẽ auto-NOTIFY `prediction_update` channel ngay khi có INSERT/UPDATE.

Không cần viết lại logic inference. Chỉ cần gọi script qua subprocess từ cron/GitHub Actions.

### 7.2. Two-Stage Model (da hieu)

Model `delay_model_twostage` là sklearn Pipeline với 2 stage:



Khi gọi `model.predict(X)`, sklearn tự handle cả 2 stage. Kết quả trả về là số phút delay.

### 7.3. Chay inference tu cron

Inference worker có thể chạy từ:
- Cron trên server mỗi 5 phút
- GitHub Actions với schedule `*/5 * * * *`

---

## 8. API Layer - Next.js API Routes

### 8.1. GET /api/flights

API trả về danh sách chuyến bay với các tham số:
- `date` — ngày cần tra cứu (mặc định: hôm nay)
- `source` — lọc theo sân bay gốc (NB, DN, TSN)
- `direction` — lọc theo hướng bay (Arrival, Departure)
- `status` — lọc theo trạng thái
- `search` — tìm kiếm theo mã chuyến bay
- `sortBy`, `sortOrder` — sắp xếp
- `page`, `limit` — phân trang

Response bao gồm:
- `data` — mảng chuyến bay
- `meta` — thông tin phân trang và thời gian cập nhật cuối

### 8.2. GET /api/flights/[flightKey]

API trả về chi tiết một chuyến bay theo `flightKey`, bao gồm lịch sử trạng thái.

### 8.3. GET /api/weather

API trả về thời tiết mới nhất của 3 sân bay.

### 8.4. Response schema

Response có cấu trúc `FlightWithPrediction` với các trường:
- Thông tin chuyến bay: `flight_key`, `flight_number`, `source_airport`, `direction`, `route_airport_std`, `scheduled_dt`, `estimated_dt`, `status_raw`, `status_group`
- Thời tiết: `temperature_c`, `visibility_miles`, `wind_speed_kt`, `cloud_cover`
- Dự đoán: `predict_delay_minutes`, `predicted_at`

---

## 9. Frontend - Next.js Pages & Components

### 9.1. Root Layout

Root layout bao gồm:
- Font Inter (hỗ trợ tiếng Việt)
- Navbar và Footer
- Metadata cho SEO

### 9.2. Dashboard Page (Server Component + ISR)

Trang chủ sử dụng ISR với `revalidate = 300` (5 phút):
- Hiển thị thống kê tổng quan (tổng chuyến, chuyến trễ, tỷ lệ trễ)
- Hiển thị thời tiết 3 sân bay
- Hiển thị danh sách chuyến bay với filter/sort

### 9.3. FlightTable voi TanStack Table

Component `FlightTable` cung cấp:
- Bảng với sorting và pagination
- Filter theo sân bay, hướng bay, trạng thái
- Search theo mã chuyến bay
- Link đến trang chi tiết từng chuyến bay

### 9.4. PredictionBadge

Component hiển thị dự đoán delay với màu sắc:
- Xanh: đúng giờ hoặc sớm < 5 phút
- Vàng: trễ 5-15 phút
- Cam: trễ 15-30 phút
- Đỏ: trễ > 30 phút

---

## 10. Real-time: Server-Sent Events (SSE)

### 10.1. Bai toan that su: Inference khong cung process voi Next.js

Inference chạy trên **GitHub Actions** (mỗi 5 phút) hoặc trên **server riêng**, không phải cùng process với Next.js. Điều này có nghĩa:

- `eventEmitter.emit()` trong Python không thể gửi trực tiếp sang SSE endpoint của Next.js
- Cần một cơ chế trung gian để Next.js biết khi nào DB có thay đổi

**Giai phap: PostgreSQL LISTEN/NOTIFY**

Thay vì dùng Redis hay polling, ta dùng chính PostgreSQL làm message broker:



**Tai sao dung LISTEN/NOTIFY?**

- Không cần thêm service (không cần Redis, không cần Supabase)
- Miễn phí, chỉ dùng PostgreSQL đã có
- Độ trễ ~0 — ngay khi inference ghi xong DB, client nhận được SSE event
- Chi phí thêm: 1 dòng SQL trong inference.py + 1 module Node.js lắng nghe

### 10.2. 3 phuong an real-time

| Phuong an | Do tre | Do phuc tap | Chi phi | De xuat |
|-----------|--------|------------|---------|---------|
| **PostgreSQL LISTEN/NOTIFY** | ~0 | Trung binh | $0 | **Dang trien khai** |
| Redis pub/sub | ~0 | Trung binh | ~$5/thang | Thay the nuoc ngoai |
| Polling 30s | 0-5 phut | Rat thap | $0 | Da loai bo |

**Khuyen nghi:** Dung **PostgreSQL LISTEN/NOTIFY** — miễn phí, không cần thêm service, độ trễ ~0, phù hợp với local dev và production.

### 10.3. Phuong an: PostgreSQL LISTEN/NOTIFY

SSE endpoint lắng nghe NOTIFY từ PostgreSQL, broadcast tất cả SSE clients ngay khi có thay đổi.

#### 10.3.1. PostgreSQL: Them trigger va function NOTIFY

Tạo function và trigger để auto-NOTIFY mỗi khi có INSERT/UPDATE trên bảng predictions.

Trigger hoạt động trên:
- `flights_predictions` — khi có INSERT hoặc UPDATE `predict_delay_minutes`
- `flights_current_snapshot` — khi có UPDATE `status_group`

#### 10.3.2. Module DB Listener (Node.js)

Module `dbListener` quản lý:
- Kết nối PostgreSQL riêng để LISTEN
- Callback pattern để thông báo cho SSE endpoint
- Auto-reconnect khi mất kết nối

#### 10.3.3. SSE Endpoint (Short Listen + Reconnect Pattern)

Endpoint `/api/stream` sử dụng pattern **short listen + reconnect** để tương thích serverless:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Short Listen Pattern (Option B)                                            │
│                                                                              │
│  ┌─────────────┐    Listen 25s    ┌─────────────┐    Listen 25s           │
│  │ SSE Client │◄─────────────────►│ SSE Endpoint│◄─────────────────►│ PG │  │
│  └─────────────┘                  └─────────────┘                        │
│         │                               │                                   │
│         │  reconnect                    │  reconnect                       │
│         ▼                               ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Listen 25s ──► Reconnect 1s ──► Listen 25s ──► Reconnect 2s ──►...│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ✓ Hoạt động trên Vercel serverless                                        │
│  ✓ Gap latency: 0-25s (tùy reconnect timing)                              │
│  ✓ Auto-reconnect với exponential backoff                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Cấu hình:
- `LISTEN_DURATION_MS = 25000` (25 giây)
- `HEARTBEAT_INTERVAL_MS = 20000` (20 giây)
- `MAX_RECONNECT_ATTEMPTS = 5`
- Exponential backoff: 1s → 2s → 4s → 8s → 16s

#### 10.3.4. SSE Hook (Client Component)

**Đã implement!** Hook `useSSE` cung cấp:

- State: `isConnected`, `lastUpdated`, `notifications`, `reconnectAttempt`, `error`
- Auto-reconnect với exponential backoff (max 10 attempts)
- Buffers last 50 notifications
- Methods: `connect()`, `disconnect()`, `clearNotifications()`

Hooks bổ sung:
- `useFlightUpdates(flightKey)` - theo dõi 1 chuyến bay cụ thể
- `useRealtimeFlights(flightKeys)` - theo dõi nhiều chuyến bay

#### 10.3.5. Connection Status Indicator

**Đã implement!** Component `ConnectionStatus` hiển thị:
- Chỉ báo kết nối (xanh/đỏ/vàng)
- Thời gian cập nhật cuối
- Số lần reconnect
- Nút làm mới thủ công
- Mode compact cho sidebar

#### 10.3.6. Cấu hình triển khai

**Files đã tạo:**

| File | Mục đích |
|------|-----------|
| `src/db/migrations/001_add_notify_trigger.sql` | PostgreSQL trigger + function |
| `src/lib/dbListener.ts` | DbListener class cho LISTEN/NOTIFY |
| `src/app/api/stream/route.ts` | SSE endpoint |
| `src/hooks/useSSE.ts` | useSSE hook + helpers |
| `src/components/ConnectionStatus.tsx` | Connection status UI |

**Cách chạy migration:**

```bash
# Chạy migration để tạo trigger
psql $DATABASE_URL -f src/db/migrations/001_add_notify_trigger.sql
```

#### 10.3.7. Lưu ý khi deploy

**Vercel (serverless):** ✅ Hoạt động với short listen pattern (Option B)

**Local dev / Railway / VPS:** ✅ Hoạt động tốt, có thể tăng LISTEN_DURATION_MS lên 60s

**Redis là phương án thay thế tốt nếu cần** — chi phí ~$5/tháng trên Upstash, hoạt động trên Vercel serverless

---

*Lần cập nhật: 2026-05-09 — Implement SSE + LISTEN/NOTIFY với short listen pattern (Option B) cho serverless compatibility.*


### 11.1. Phan loai user

| Loai | Mo ta | Can auth? |
|------|-------|-----------|
| Guest | Xem dashboard công khai | Không |
| Subscriber | Theo dõi chuyến bay, nhận thông báo | Có (email) |
| Admin | Quản lý model, xem logs | Có (password) |

### 11.2. Guest (mac dinh)

Xem dashboard, bảng chuyến bay, thời tiết, thống kê - không cần đăng nhập.

### 11.3. Admin (NextAuth.js)

Trang /admin: quản lý model, trigger manual inference, xem logs.

---

## 12. Deployment

### 12.1. Docker Compose (development)

Cấu hình development với Docker Compose bao gồm:
- PostgreSQL 16 (port 5432)
- Next.js web app (port 3000)
- Volume cho persistent data

### 12.2. Production (Vercel + Railway)

| Component | Nền tảng | Chi phi |
|-----------|---------|---------|
| Web (Next.js) | Vercel | Miễn phí |
| PostgreSQL | Railway / Supabase | ~$5/thang |
| Inference Worker | Railway / GitHub Actions | Miễn phí - $5/thang |

### 12.3. Environment variables

Các biến môi trường cần thiết:
- `DATABASE_URL` — connection string PostgreSQL
- `NEXT_PUBLIC_API_URL` — URL của web app

---

## 13. Monitoring & Observability

### 13.1. Health check

Endpoint `/api/health` kiểm tra:
- Kết nối PostgreSQL
- Trả về status: healthy (200) hoặc degraded (503)

### 13.2. Logging

Sử dụng `console.log` trong Next.js. Logs hiển thị trong Vercel dashboard hoặc stdout khi chạy local.

---

## 14. Roadmap

### Phase 1: Foundation (Tuan 1-2)
- [ ] Setup Next.js project: npx create-next-app@latest web
- [ ] Kết nối PostgreSQL (DATABASE_URL)
- [ ] Implement 3 query functions: getFlightsWithPredictions, getLatestWeather, getFlightByKey
- [ ] Implement 3 API routes: /api/flights, /api/weather, /api/flights/[key]
- [ ] Dashboard page với flight table (ISR, filter, sort, pagination)

### Phase 2: UI Components (Tuan 3)
- [ ] PredictionBadge, WeatherCard, WeatherGrid
- [ ] FlightTable với TanStack Table
- [ ] Trang chi tiết chuyến bay /flights/[key]
- [ ] FlightTimeline (lịch sử trạng thái)
- [ ] Trang thời tiết /weather
- [ ] Trang thống kê /stats với Recharts

### Phase 3: Real-time + Worker (Tuan 4)
- [x] Chạy migration: `src/db/migrations/001_add_notify_trigger.sql` (PostgreSQL trigger)
- [x] Module `src/lib/dbListener.ts` (LISTEN handler)
- [x] SSE endpoint `/api/stream` + SSE hook frontend
- [ ] Inference worker: GitHub Actions workflow (*/5 * * * *)

### Phase 4: Polish + Production (Tuan 5-6)
- [ ] Mobile responsive
- [ ] Error boundary + loading states
- [ ] Unit tests + E2E (Playwright)
- [ ] Deploy: Vercel + Railway
- [ ] Domain + SSL

---

## 15. Tech stack tổng hợp

### Frontend

| Thu vien | Muc dich | Version |
|---------|---------|---------|
| Next.js 14 | Framework, SSR + ISR | ^14.2 |
| TypeScript | Type safety | ^5.4 |
| Tailwind CSS | Styling | ^3.4 |
| TanStack Table | Bang co filter/sort/pagination | ^8 |
| Recharts | Bieu do thong ke | ^2.12 |
| Lucide React | Icons | ^0.400 |
| date-fns | Format ngay gio | ^3.6 |

### Backend

| Thu vien | Muc dich | Version |
|---------|---------|---------|
| pg | PostgreSQL client | ^8.12 |
| zod | Schema validation | ^3.23 |

### Infrastructure

| Dich vu | Muc dich | Chi phi |
|---------|---------|---------|
| Vercel | Next.js hosting | Miễn phí |
| Railway / Supabase | PostgreSQL | ~$5/thang |
| GitHub Actions | CI/CD + Inference Worker | Miễn phí |

### Development

| Tool | Muc dich |
|------|---------|
| ESLint + Prettier | Code style |
| Vitest | Unit tests |
| Playwright | E2E tests |
| Docker | Development environment |

---

*Lần cập nhật: 2026-05-08 — Cập nhật theo thực tế project: bỏ Redis/ONNX, dùng lại inference.py + flights_predictions có sẵn, Python subprocess thay vì Node.js worker.*

## Chú ý

### Những điểm cần lưu ý khi vận hành

**1. GitHub Actions chỉ thu thập dữ liệu thô**
- File `.github/workflows/collect-data.yml` chạy mỗi 30 phút và ghi vào 4 bảng: `flights_nb`, `flights_dn`, `flights_tsn`, `weather_metar`
- **Không tự động** chạy `processing.py` hay `inference.py`
- Muốn tự động hóa hoàn toàn → thêm job `python src/processing.py` và `python src/inference.py` vào workflow

**2. `processing.py` và `inference.py` hiện chạy thủ công**
- Sau khi collector chạy xong, cần chạy thủ công `python src/processing.py` để tạo snapshot và features
- Sau đó chạy `python src/inference.py` để sinh dự đoán vào `flights_predictions`
- Thứ tự: **collect → processing → inference → web hiển thị**

**3. Web app đọc từ 2 bảng**
- `flights_current_snapshot` — dữ liệu chuyến bay hiện tại + features
- `flights_predictions` — kết quả dự đoán từ model
- Web query ghép 2 bảng qua `LEFT JOIN flight_key` trong `src/lib/queries/getFlights.ts`

**4. Hạn chế của GitHub Actions**
- Timeout 20 phút mỗi job, không phù hợp cho tác vụ chạy dài
- Không lưu trữ trạng thái giữa các lần chạy
- Không hỗ trợ persistent connection (SSE, LISTEN/NOTIFY)

**5. Real-time SSE trên Vercel**
- SSE endpoint (`/api/stream`) sử dụng PostgreSQL `LISTEN/NOTIFY`
- **Không hoạt động** trên Vercel serverless (bị timeout 30s)
- Cần deploy trên Railway, VPS, hoặc dùng polling thay thế

**6. Cập nhật model mới**
- Khi có model mới, copy file `.joblib` vào `Data Modeling/artifacts/`
- Đảm bảo feature columns giữ nguyên thứ tự với lúc training
- Chạy lại `inference.py` sau khi thay model

**7. Threshold trễ 15 phút**
- Trong `processing.py` có `DELAY_THRESHOLD_MINUTES = 15` — chuyến bay trễ ≥ 15 phút mới được gắn nhãn `label_delay = 1`
- Có thể điều chỉnh threshold này tùy nghiệp vụ

**8. Cơ chế dedup**
- Dùng `flight_key = source|dir|route|flight_num|scheduled_dt` để deduplicate
- Với mỗi chuyến bay, chỉ giữ bản ghi mới nhất trong `flights_current_snapshot`

**9. METAR weather code mapping**
- `VVNB` → `NB` (Nội Bài)
- `VVDN` → `DN` (Đà Nẵng)
- `VVTS` → `TSN` (Tân Sơn Nhất)
- Các sân bay khác ngoài 3 mã này sẽ bị bỏ qua trong weather merge

**10. Database connection pool**
- `db.ts` cấu hình `max: 20` connections — đủ cho ~50-100 user đồng thời
- Tăng `max` nếu cần hỗ trợ nhiều user hơn
- Có thể cấu hình `DATABASE_URL` trỏ đến Supabase, Railway, hoặc local PostgreSQL

*Lần cập nhật: 2026-05-08 — Thêm sơ đồ luồng dữ liệu 4 giai đoạn và phần Chú ý.*
