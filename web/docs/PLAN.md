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
│                              USER'S BROWSER                                  │
│                                                                             │
│   Next.js (Frontend)                                                         │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │  Server Component (ISR) ────► HTML tĩnh (first load < 2s)        │    │
│   │  Client Component (SSE) ────► Real-time UI update (không reload)  │    │
│   │  TanStack Table ───────────► Bảng chuyến bay có filter/sort       │    │
│   │  Recharts ─────────────────► Biểu đồ thống kê                   │    │
│   └───────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTPS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS (Vercel / Node server)                        │
│                                                                             │
│  ┌──────────────────────┐  ┌────────────────────────────────────────┐      │
│  │  Server Components   │  │  API Routes                               │      │
│  │  (ISR, revalidate)   │  │  GET /api/flights                        │      │
│  │                      │  │  GET /api/flights/[key]                   │      │
│  │  Đọc từ PostgreSQL  │  │  GET /api/weather                        │      │
│  │  flights_predictions  │  │  GET /api/stream (SSE)                   │      │
│  │  + current_snapshot   │  └────────────────────────────────────────┘      │
│  └──────────────────────┘                                                  │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL                                      │
│                                                                             │
│  flights_nb ──► flights_dn ──► flights_tsn ──► weather_metar              │
│  flights_current_snapshot ──► flights_predictions ◄── Inference Worker     │
│  training_dataset_labeled ──► (readonly, cho training)                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      PYTHON INFERENCE WORKER                                 │
│  Chạy trong GitHub Actions mỗi 5 phút HOẶC cron trên server               │
│                                                                             │
│  python src/inference.py                                                     │
│    ├── Đọc flights_current_snapshot                                         │
│    ├── Load delay_model_twostage.joblib                                    │
│    ├── model.predict(df) ──► predict_delay_minutes                         │
│    └── INSERT INTO flights_predictions ON CONFLICT UPDATE (flight_key)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Luồng dữ liệu end-to-end

```
GitHub Actions / Cron (mỗi 5 phút)
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  python src/inference.py                                │
│                                                          │
│  ① SELECT * FROM flights_current_snapshot              │
│  ② Load model.joblib                                   │
│  ③ model.predict(df)                                  │
│  ④ INSERT INTO flights_predictions                      │
│     ON CONFLICT (flight_key) DO UPDATE                 │
│     SET predict_delay_minutes = EXCLUDED.predict...    │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │  flights_predictions │  ← Web app đọc từ đây
              │  (flight_key PK)    │
              └──────────┬───────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js API Route                                      │
│                                                          │
│  GET /api/flights                                       │
│    → JOIN flights_predictions + flights_current_snapshot │
│    → Filter, sort, paginate                            │
│    → Response: JSON array (~100-500ms)                │
│                                                          │
│  GET /api/stream (SSE)                                 │
│    → Server-Sent Events                                │
│    → Push: { flight_key, predict_delay_minutes }       │
│    → Client cập nhật UI tức thì                       │
└─────────────────────────────────────────────────────────┘
```

---


## 4. Cấu trúc thư mục

```
web/
├── docs/
│   └── PLAN.md               ← File plan này
│
├── src/
│   │
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx       # Root layout (navbar, footer)
│   │   ├── page.tsx         # Dashboard tổng quan (/)
│   │   ├── globals.css      # Global styles (Tailwind)
│   │   │
│   │   ├── flights/
│   │   │   ├── page.tsx     # Danh sách chuyến bay (/flights)
│   │   │   └── [flightKey]/
│   │   │       └── page.tsx # Chi tiết chuyến bay (/flights/:key)
│   │   │
│   │   ├── weather/
│   │   │   └── page.tsx     # Thời tiết realtime (/weather)
│   │   │
│   │   ├── stats/
│   │   │   └── page.tsx     # Thống kê & biểu đồ (/stats)
│   │   │
│   │   └── api/
│   │       ├── flights/
│   │       │   ├── route.ts     # GET /api/flights
│   │       │   └── [flightKey]/
│   │       │       └── route.ts # GET /api/flights/:key
│   │       ├── weather/
│   │       │   └── route.ts     # GET /api/weather
│   │       └── stream/
│   │           └── route.ts     # GET /api/stream (SSE)
│   │
│   ├── components/           # React components
│   │   ├── ui/              # Primitive UI (Button, Card, Badge...)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Table.tsx    # TanStack Table wrapper
│   │   │   └── Skeleton.tsx # Loading skeleton
│   │   │
│   │   ├── flights/         # Domain-specific components
│   │   │   ├── FlightTable.tsx     # Bảng chuyến bay (Server)
│   │   │   ├── FlightCard.tsx      # Card cho mobile
│   │   │   ├── FlightSearch.tsx    # Search box
│   │   │   ├── FlightFilter.tsx    # Filter panel
│   │   │   ├── FlightTimeline.tsx  # Timeline trạng thái
│   │   │   └── PredictionBadge.tsx # Badge hiển thị delay
│   │   │
│   │   ├── weather/
│   │   │   ├── WeatherCard.tsx     # Card thời tiết 1 sân bay
│   │   │   └── WeatherGrid.tsx     # Lưới 3 card
│   │   │
│   │   ├── stats/
│   │   │   ├── DelayRateChart.tsx      # Pie chart tỷ lệ delay
│   │   │   ├── FlightsByHourChart.tsx   # Bar chart theo giờ
│   │   │   └── DelayDistributionChart.tsx # Histogram
│   │   │
│   │   └── layout/
│   │       ├── Navbar.tsx
│   │       └── Footer.tsx
│   │
│   ├── lib/                 # Shared utilities
│   │   ├── db.ts           # PostgreSQL client (pg)
│   │   ├── eventEmitter.ts  # Node.js EventEmitter (SSE broadcast)
│   │   │
│   │   ├── queries/
│   │   │   ├── getFlights.ts   # Đọc flights_predictions + current_snapshot
│   │   │   ├── getFlightByKey.ts
│   │   │   └── getWeather.ts   # Đọc weather_metar mới nhất
│   │   │
│   │   └── utils/
│   │       ├── formatTime.ts
│   │       ├── formatDelay.ts  # Format phút delay → "Trễ 15 phút"
│   │       └── delayColor.ts   # Màu sắc theo mức độ delay
│   │
│   ├── types/               # TypeScript type definitions
│   │   ├── flight.ts        # Flight, FlightSnapshot, FlightWithPrediction
│   │   ├── weather.ts       # WeatherMETAR
│   │   └── api.ts           # API response types
│   │
│   └── hooks/               # React hooks
│       ├── useFlights.ts    # Fetch flights data
│       ├── useWeather.ts     # Fetch weather data
│       ├── useSSE.ts        # Kết nối SSE, nhận real-time updates
│       └── useFilter.ts     # Quản lý filter state
│
├── tests/                   # Unit + integration tests
│   ├── unit/
│   │   ├── formatDelay.test.ts
│   │   └── delayColor.test.ts
│   ├── integration/
│   │   └── api-flights.test.ts
│   └── e2e/
│       └── dashboard.test.ts # Playwright E2E
│
├── .env.example             # Template biến môi trường
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── Dockerfile               # Container cho Next.js web app
└── vercel.json             # Config cho Vercel deployment

# Inference Worker: Dùng lại Python scripts có sẵn
# ├── src/inference.py     ← Đã có, ghi vào flights_predictions
# ├── src/processing.py    ← Đã có, tạo flights_current_snapshot
# ├── Data Modeling/
# │   └── artifacts/
# │       └── delay_model_twostage.joblib  ← Đã có
```

---

## 5. Thiết kế database schema

### 5.1. Các bảng hiện có (từ ida-data-monitoring)

```sql
-- Bảng chuyến bay sân bay Nội Bài
CREATE TABLE flights_nb (
    id SERIAL PRIMARY KEY,
    data_retrieved_at_vn TIMESTAMPTZ DEFAULT NOW(),
    flight_date DATE NOT NULL,
    direction TEXT,
    scheduled_time TIME,
    estimated_time TIME,
    airport TEXT,
    flight_number TEXT,
    status TEXT,
    UNIQUE(flight_date, direction, scheduled_time, airport, flight_number, status)
);
-- Tương tự cho flights_dn, flights_tsn

-- Bảng thời tiết METAR
CREATE TABLE weather_metar (
    id SERIAL PRIMARY KEY,
    icao_code TEXT,           -- 'VVNB' | 'VVDN' | 'VVTS'
    report_time_utc TIMESTAMPTZ,
    report_time_vn TIMESTAMPTZ,
    temperature_c NUMERIC,
    dew_point_c NUMERIC,
    wind_direction_deg NUMERIC,
    wind_speed_kt NUMERIC,
    visibility_miles NUMERIC,
    cloud_cover TEXT,
    raw_metar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(icao_code, report_time_utc, raw_metar)
);

-- Snapshot chuyến bay mới nhất (tạo bởi src/processing.py)
CREATE TABLE flights_current_snapshot (
    flight_key TEXT PRIMARY KEY,
    retrieved_at_vn TIMESTAMPTZ,
    flight_date DATE,
    direction TEXT,
    scheduled_time TIME,
    estimated_time TIME,
    route_airport_std TEXT,
    flight_number TEXT,
    status_raw TEXT,
    status_group TEXT,
    source_airport TEXT,
    scheduled_dt TIMESTAMPTZ,
    estimated_dt TIMESTAMPTZ,
    delay_minutes NUMERIC,
    label_delay INTEGER,
    temperature_c NUMERIC,
    dew_point_c NUMERIC,
    wind_direction_deg NUMERIC,
    wind_speed_kt NUMERIC,
    visibility_miles NUMERIC,
    cloud_cover TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2. Bảng predictions (đã tồn tại)

```sql
-- Tạo bởi src/inference.py — bảng này DA TON TAI trong DB
-- Web app chi can SELECT tu bang nay

CREATE TABLE flights_predictions (
    flight_key TEXT PRIMARY KEY REFERENCES flights_current_snapshot(flight_key),
    predict_delay_minutes NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nen bo sung them:
ALTER TABLE flights_predictions
    ADD COLUMN IF NOT EXISTS model_version TEXT,
    ADD COLUMN IF NOT EXISTS predicted_at TIMESTAMPTZ DEFAULT NOW();
```

### 5.3. ERD web app

```
flights_nb/dn/tsn --> flights_current_snapshot
                            |
                            v
              +-----------------------+
              |  flights_predictions    | <-- Web app doc tu day
              |  (flight_key PK)      |     JOIN flights_current_snapshot
              +-----------------------+
                            |
                            v
              +-----------------------+
              |  weather_metar          | <-- Lay thoi tiet moi nhat
              |  (3 san bay)         |
              +-----------------------+
```

---

## 6. Database queries - Next.js API

### 6.1. Ket noi PostgreSQL

```typescript
// src/lib/db.ts
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query<T = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return pool.query(text, params);
}
```

### 6.2. Query: danh sach chuyen bay + predictions

```typescript
// src/lib/queries/getFlights.ts
import { query } from '@/lib/db';

export async function getFlightsWithPredictions(date?: string) {
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const sql = `
    SELECT
      s.flight_key,
      s.flight_number,
      s.source_airport,
      s.direction,
      s.route_airport_std,
      s.scheduled_dt AT TIME ZONE 'Asia/Ho_Chi_Minh' AS scheduled_dt,
      s.estimated_dt,
      s.status_raw,
      s.status_group,
      s.temperature_c,
      s.visibility_miles,
      s.wind_speed_kt,
      s.cloud_cover,
      p.predict_delay_minutes,
      p.predicted_at
    FROM flights_current_snapshot s
    LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
    WHERE s.flight_date = $1
      AND s.status_group NOT IN ('landed', 'departed', 'cancelled')
    ORDER BY s.scheduled_dt ASC
  `;

  const result = await query(sql, [targetDate]);
  return result.rows;
}
```

### 6.3. Query: thoi tiet moi nhat

```typescript
// src/lib/queries/getWeather.ts
import { query } from '@/lib/db';

export async function getLatestWeather() {
  const sql = `
    SELECT DISTINCT ON (icao_code)
      icao_code,
      report_time_vn AT TIME ZONE 'Asia/Ho_Chi_Minh' AS report_time_vn,
      temperature_c,
      dew_point_c,
      wind_direction_deg,
      wind_speed_kt,
      visibility_miles,
      cloud_cover,
      raw_metar
    FROM weather_metar
    ORDER BY icao_code, report_time_vn DESC
  `;
  const result = await query(sql);
  return result.rows;
}
```

### 6.4. Query: chi tiet 1 chuyen bay

```typescript
// src/lib/queries/getFlightByKey.ts
import { query } from '@/lib/db';

export async function getFlightByKey(flightKey: string) {
  const sql = `
    SELECT
      s.flight_key, s.flight_number, s.source_airport, s.direction,
      s.route_airport_std, s.scheduled_dt AT TIME ZONE 'Asia/Ho_Chi_Minh' AS scheduled_dt,
      s.estimated_dt, s.status_raw, s.status_group,
      s.temperature_c, s.visibility_miles, s.wind_speed_kt, s.cloud_cover,
      p.predict_delay_minutes, p.predicted_at
    FROM flights_current_snapshot s
    LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
    WHERE s.flight_key = $1
  `;
  const result = await query(sql, [flightKey]);
  return result.rows[0] ?? null;
}

export async function getFlightHistory(flightKey: string) {
  const parts = flightKey.split('|');
  const source = parts[0];
  const tableMap = { NB: 'flights_nb', DN: 'flights_dn', TSN: 'flights_tsn' };
  const table = tableMap[source as keyof typeof tableMap];
  const flight_number = parts[2];

  const sql = `
    SELECT
      data_retrieved_at_vn AT TIME ZONE 'Asia/Ho_Chi_Minh' AS retrieved_at_vn,
      scheduled_time, estimated_time, status
    FROM ${table}
    WHERE flight_number = $1
    ORDER BY data_retrieved_at_vn ASC
  `;
  const result = await query(sql, [flight_number]);
  return result.rows;
}
```

---

## 7. Inference Worker - Python subprocess

### 7.1. Tong quan

Inference worker la script Python da co san: **src/inference.py**. Script nay:

1. Doc flights_current_snapshot tu PostgreSQL
2. Load model delay_model_twostage.joblib
3. Chay model.predict() cho tat ca active flights
4. Ghi ket qua vao bang flights_predictions (INSERT ON CONFLICT UPDATE)

**Luu y:** Khong can goi NOTIFY thu cong. PostgreSQL trigger (section 10.3.1) se auto-NOTIFY `prediction_update` channel ngay khi co INSERT/UPDATE. Chi can dam bao migration da chay la du.

Khong can viet lai logic inference. Chi can goi script qua subprocess tu cron/GitHub Actions.

### 7.2. Two-Stage Model (da hieu)

Model delay_model_twostage la sklearn Pipeline voi 2 stage:

```
Stage 1: Classifier (du doan CO tre hay KHONG)
  -> predict_proba() -> xac suat delay

Stage 2: Regressor (du doan SO PHUT tre, chi khi Stage 1 = 1)
  -> predict() -> so phut delay
```

Khi goi model.predict(X), sklearn tu handle ca 2 stage. Ket qua tra ve la so phut delay.

### 7.3. Chay inference tu cron

```bash
# Tren server hoac GitHub Actions
# Moi 5 phut
*/5 * * * * cd /path/to/ida-data-monitoring && python src/inference.py >> logs/inference.log 2>&1
```

```yaml
# GitHub Actions workflow
# .github/workflows/predict.yml
name: Run Prediction

on:
  schedule:
    - cron: '*/5 * * * *'

jobs:
  predict:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install pandas scikit-learn joblib psycopg2-binary
      - run: python src/inference.py
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## 8. API Layer - Next.js API Routes

### 8.1. GET /api/flights

```typescript
// src/app/api/flights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFlightsWithPredictions } from '@/lib/queries/getFlights';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  const source = searchParams.get('source');
  const direction = searchParams.get('direction');
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const sortBy = searchParams.get('sortBy') ?? 'scheduled_dt';
  const sortOrder = searchParams.get('sortOrder') ?? 'asc';
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '50');

  try {
    let flights = await getFlightsWithPredictions(date);

    if (source) flights = flights.filter(f => f.source_airport === source);
    if (direction) flights = flights.filter(f => f.direction === direction);
    if (status) flights = flights.filter(f => f.status_group === status);
    if (search) flights = flights.filter(f =>
      f.flight_number.toLowerCase().includes(search.toLowerCase())
    );

    flights.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a];
      const bVal = b[sortBy as keyof typeof b];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortOrder === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
    });

    const total = flights.length;
    const offset = (page - 1) * limit;
    const paginated = flights.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginated,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit),
              last_updated: flights[0]?.predicted_at ?? null }
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
    });

  } catch (error) {
    console.error('[API /flights]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 8.2. GET /api/flights/[flightKey]

```typescript
// src/app/api/flights/[flightKey]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFlightByKey, getFlightHistory } from '@/lib/queries/getFlightByKey';

export async function GET(req: NextRequest, { params }: { params: { flightKey: string } }) {
  try {
    const flight = await getFlightByKey(params.flightKey);
    if (!flight) return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    const history = await getFlightHistory(params.flightKey);
    return NextResponse.json({ ...flight, history });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 8.3. GET /api/weather

```typescript
// src/app/api/weather/route.ts
import { NextResponse } from 'next/server';
import { getLatestWeather } from '@/lib/queries/getWeather';

export async function GET() {
  try {
    const weather = await getLatestWeather();
    return NextResponse.json({
      data: weather,
      meta: { count: weather.length, last_updated: weather[0]?.report_time_vn ?? null }
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 8.4. Response schema

```typescript
// src/types/flight.ts

interface FlightWithPrediction {
  flight_key: string;
  flight_number: string;
  source_airport: 'NB' | 'DN' | 'TSN';
  direction: 'Arrival' | 'Departure';
  route_airport_std: string;
  scheduled_dt: string;
  estimated_dt: string | null;
  status_raw: string;
  status_group: string;
  temperature_c: number | null;
  visibility_miles: number | null;
  wind_speed_kt: number | null;
  cloud_cover: string | null;
  predict_delay_minutes: number | null;
  predicted_at: string | null;
}

interface FlightDetailResponse extends FlightWithPrediction {
  history: FlightStatusHistory[];
}

interface FlightStatusHistory {
  retrieved_at_vn: string;
  scheduled_time: string;
  estimated_time: string | null;
  status: string;
}
```

---

## 9. Frontend - Next.js Pages & Components

### 9.1. Root Layout

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'Flight Delay Monitor - Du bao tre chuyen bay Viet Nam',
  description: 'Theo doi va du bao do tre chuyen bay tai 3 san bay lon nhat Viet Nam.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen bg-gray-50">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

### 9.2. Dashboard Page (Server Component + ISR)

```tsx
// src/app/page.tsx
import { Suspense } from 'react';
import { getFlightsWithPredictions } from '@/lib/queries/getFlights';
import { getLatestWeather } from '@/lib/queries/getWeather';
import { FlightTable } from '@/components/flights/FlightTable';
import { WeatherGrid } from '@/components/weather/WeatherGrid';
import { SSEProvider } from '@/hooks/useSSE';

export const revalidate = 300; // ISR: revalidate moi 5 phut

export default async function DashboardPage() {
  const [flights, weather] = await Promise.all([
    getFlightsWithPredictions(),
    getLatestWeather(),
  ]);

  const delayRate = flights.length > 0
    ? (flights.filter(f => (f.predict_delay_minutes ?? 0) >= 15).length / flights.length * 100).toFixed(1)
    : '0';

  return (
    <SSEProvider>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Theo doi chuyen bay</h1>
          <p className="text-gray-500 mt-1">
            Cap nhat: {new Date().toLocaleString('vi-VN')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Tong chuyen" value={flights.length} />
          <StatCard label="Tre (>=15p)" value={flights.filter(f => (f.predict_delay_minutes ?? 0) >= 15).length} color="red" />
          <StatCard label="Dung gio" value={flights.filter(f => (f.predict_delay_minutes ?? 0) < 15).length} color="green" />
          <StatCard label="Ty le tre" value={`${delayRate}%`} color={parseFloat(delayRate) > 30 ? 'red' : 'yellow'} />
        </div>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Thoi tiet hien tai</h2>
          <WeatherGrid weather={weather} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Danh sach chuyen bay hom nay</h2>
          <Suspense fallback={<div>Dang tai...</div>}>
            <FlightTable initialFlights={flights} />
          </Suspense>
        </section>
      </div>
    </SSEProvider>
  );
}

function StatCard({ label, value, color = 'gray' }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <div className={`rounded-lg p-4 ${colors[color]}`}>
      <div className="text-sm">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
```

### 9.3. FlightTable voi TanStack Table

```tsx
// src/components/flights/FlightTable.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, flexRender, ColumnDef, SortingState,
} from '@tanstack/react-table';
import { FlightWithPrediction } from '@/types/flight';
import { PredictionBadge } from './PredictionBadge';

const AIRPORT_NAMES: Record<string, string> = {
  NB: 'Noi Bai', DN: 'Da Nang', TSN: 'Tan Son Nhat',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function FlightTable({ initialFlights }: { initialFlights: FlightWithPrediction[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'scheduled_dt', desc: false }]);
  const [filters, setFilters] = useState({ source: '', direction: '', status: '', search: '' });

  const { flights } = useFlights(initialFlights);

  const columns = useMemo<ColumnDef<FlightWithPrediction>[]>(() => [
    {
      accessorKey: 'flight_number',
      header: 'Ma CB',
      cell: ({ row }) => (
        <a href={`/flights/${row.original.flight_key}`}
           className="font-mono font-bold text-blue-600 hover:underline">
          {row.original.flight_number}
        </a>
      ),
    },
    {
      accessorKey: 'source_airport',
      header: 'San bay',
      cell: ({ row }) => AIRPORT_NAMES[row.original.source_airport] ?? row.original.source_airport,
    },
    { accessorKey: 'direction', header: 'Chieu' },
    { accessorKey: 'route_airport_std', header: 'Diem den' },
    {
      accessorKey: 'scheduled_dt',
      header: 'Gio bay',
      cell: ({ row }) => formatTime(row.original.scheduled_dt),
    },
    { accessorKey: 'status_group', header: 'Trang thai' },
    {
      accessorKey: 'predict_delay_minutes',
      header: 'Du bao',
      cell: ({ row }) => (
        <PredictionBadge delayMinutes={row.original.predict_delay_minutes ?? 0} />
      ),
    },
    {
      accessorKey: 'visibility_miles',
      header: 'Tam nhin',
      cell: ({ row }) => row.original.visibility_miles ? `${row.original.visibility_miles} mi` : '-',
    },
  ], []);

  const filtered = useMemo(() => flights.filter(f => {
    if (filters.source && f.source_airport !== filters.source) return false;
    if (filters.direction && f.direction !== filters.direction) return false;
    if (filters.status && f.status_group !== filters.status) return false;
    if (filters.search && !f.flight_number.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  }), [flights, filters]);

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Tim ma chuyen bay..."
          className="border rounded px-3 py-1 text-sm"
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}>
          <option value="">Tat ca san bay</option>
          <option value="NB">Noi Bai</option>
          <option value="DN">Da Nang</option>
          <option value="TSN">Tan Son Nhat</option>
        </select>
        <select onChange={e => setFilters(f => ({ ...f, direction: e.target.value }))}>
          <option value="">Chieu</option>
          <option value="Arrival">Den</option>
          <option value="Departure">Di</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th key={header.id}
                      className="px-4 py-3 text-left font-medium cursor-pointer"
                      onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ^', desc: ' v' }[header.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-t hover:bg-gray-50">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <span className="text-sm text-gray-500">Tong: {table.getFilteredRowModel().rows.length} chuyen</span>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                className="px-3 py-1 border rounded disabled:opacity-50">← Truoc</button>
        <span>Trang {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                className="px-3 py-1 border rounded disabled:opacity-50">Sau →</button>
      </div>
    </div>
  );
}
```

### 9.4. PredictionBadge

```tsx
// src/components/flights/PredictionBadge.tsx
function formatDelay(minutes: number): string {
  if (minutes < 0) return `Som ${Math.abs(minutes)} phut`;
  if (minutes === 0) return 'Dung gio';
  if (minutes < 15) return `+${minutes} phut`;
  return `Tre ${minutes} phut`;
}

function delayColor(minutes: number): string {
  if (minutes < 5)  return 'bg-green-100 text-green-800';
  if (minutes < 15) return 'bg-yellow-100 text-yellow-800';
  if (minutes < 30) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export function PredictionBadge({ delayMinutes }: { delayMinutes: number }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${delayColor(delayMinutes)}`}>
      {formatDelay(delayMinutes)}
    </span>
  );
}
```

---

## 10. Real-time: Server-Sent Events (SSE)

### 10.1. Bai toan that su: Inference khong cung process voi Next.js

Inference chay tren **GitHub Actions** (moi 5 phut) hoac tren **server rieng**, khong phai cung process voi Next.js. Dieu nay co nghia:

- `eventEmitter.emit()` trong Python khong the gui truc tiep sang SSE endpoint cua Next.js
- Can mot co che trung gian de Next.js biet khi nao DB co thay doi

**Giai phap: PostgreSQL LISTEN/NOTIFY**

Thay vi dung Redis hay polling, ta dung chinh PostgreSQL lam message broker:

```
GitHub Actions (inference.py)          PostgreSQL                     Next.js (SSE endpoint)
         │                                 │                                │
         │  INSERT flights_predictions     │                                │
         │ ──────────────────────────────►│                                │
         │                                 │                                │
         │  SELECT pg_notify(...)         │                                │
         │ ──────────────────────────────►│                                │
         │                                 │◄─── LISTEN "prediction_update"──┤
         │                                 │                                │
         │                                 │  NOTIFY "prediction_update" ────┼──► SSE push
         │                                 │                                │      to clients
```

**Tai sao dung LISTEN/NOTIFY?**

- Khong can them service (khong can Redis, khong can Supabase)
- Mien phi, chi dung PostgreSQL da co
- Do tre ~0 — ngay khi inference ghi xong DB, client nhan duoc SSE event
- Chi phi them: 1 dong SQL trong inference.py + 1 module Node.js lang nghe

### 10.2. 3 phuong an real-time

| Phuong an | Do tre | Do phuc tap | Chi phi | De xuat |
|-----------|--------|------------|---------|---------|
| **PostgreSQL LISTEN/NOTIFY** | ~0 | Trung binh | $0 | **Dang trien khai** |
| Redis pub/sub | ~0 | Trung binh | ~$5/thang | Thay the nuoc ngoai |
| Polling 30s | 0-5 phut | Rat thap | $0 | Da loai bo |

**Khuyen nghi:** Dung **PostgreSQL LISTEN/NOTIFY** — mien phi, khong can them service, do tre ~0, phu hop voi local dev va production.

### 10.3. Phuong an: PostgreSQL LISTEN/NOTIFY

SSE endpoint lang nghe NOTIFY tu PostgreSQL, broadcast tat ca SSE clients ngay khi co thay doi.

#### 10.3.1. PostgreSQL: Them trigger va function NOTIFY

Tao function va trigger de auto-NOTIFY moi khi co INSERT/UPDATE tren bang predictions:

```sql
-- src/db/migrations/002_add_notify_trigger.sql

-- Function gui NOTIFY khi co thay doi
CREATE OR REPLACE FUNCTION notify_prediction_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'prediction_update',
    json_build_object(
      'action', TG_OP,
      'flight_key', NEW.flight_key,
      'predict_delay_minutes', NEW.predict_delay_minutes,
      'predicted_at', NEW.predicted_at,
      'updated_at', NOW()::text
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger tren flights_predictions
DROP TRIGGER IF EXISTS trg_prediction_update ON flights_predictions;
CREATE TRIGGER trg_prediction_update
  AFTER INSERT OR UPDATE OF predict_delay_minutes
  ON flights_predictions
  FOR EACH ROW EXECUTE FUNCTION notify_prediction_update();

-- Trigger tren flights_current_snapshot (cap nhat trang thai chuyen bay)
DROP TRIGGER IF EXISTS trg_snapshot_update ON flights_current_snapshot;
CREATE TRIGGER trg_snapshot_update
  AFTER INSERT OR UPDATE OF status_group
  ON flights_current_snapshot
  FOR EACH ROW EXECUTE FUNCTION notify_prediction_update();
```

Chay migration:

```bash
psql $DATABASE_URL -f src/db/migrations/002_add_notify_trigger.sql
```

#### 10.3.2. Module DB Listener (Node.js)

```typescript
// src/lib/dbListener.ts
import pg from 'pg';

const { Client } = pg;

export type DBListenerCallback = (payload: PredictionNotifyPayload) => void;

export interface PredictionNotifyPayload {
  action: 'INSERT' | 'UPDATE';
  flight_key: string;
  predict_delay_minutes: number | null;
  predicted_at: string;
  updated_at: string;
}

let sharedListener: pg.Client | null = null;
const callbacks = new Set<DBListenerCallback>();

export function startDBListener(): void {
  if (sharedListener) return;

  const client = new Client({
    connectionString: process.env.DATABASE_URL!,
  });

  client.connect();
  client.query('LISTEN prediction_update');

  client.on('notification', (msg) => {
    if (msg.channel !== 'prediction_update') return;
    try {
      const payload: PredictionNotifyPayload = JSON.parse(msg.payload ?? '{}');
      callbacks.forEach((cb) => cb(payload));
    } catch {
      // ignore parse errors
    }
  });

  client.on('error', (err) => {
    console.error('DB listener error:', err);
    sharedListener = null;
    setTimeout(startDBListener, 5000);
  });

  sharedListener = client;
}

export function onPredictionUpdate(cb: DBListenerCallback): () => void {
  callbacks.add(cb);
  return () => callbacks.delete(cb);
}
```

#### 10.3.3. SSE Endpoint (LISTEN + push that su)

```typescript
// src/app/api/stream/route.ts
import { NextRequest } from 'next/server';
import { startDBListener, onPredictionUpdate, type PredictionNotifyPayload } from '@/lib/dbListener';
import { getFlightsWithPredictions } from '@/lib/queries/getFlights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Khoi dong listener neu chua co
      startDBListener();

      // Gui connected event
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'connected', at: new Date().toISOString() })}\n\n`
      ));

      // Lang nghe DB update -> push SSE event
      const unsubscribe = onPredictionUpdate(async (payload: PredictionNotifyPayload) => {
        if (isClosed) return;
        try {
          const flights = await getFlightsWithPredictions();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'predictions_updated',
              payload,
              flights,
              at: new Date().toISOString(),
            })}\n\n`)
          );
        } catch {
          // Client da ngat, cleanup tu dong
        }
      });

      // Heartbeat de giu connection song (ngat sau 30s khong co event)
      const heartbeat = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

#### 10.3.4. SSE Hook (Client Component)

```typescript
// src/hooks/useSSE.ts
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { FlightWithPrediction } from '@/types/flight';

interface SSEContextValue {
  flights: FlightWithPrediction[];
  isConnected: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
}

const SSEContext = createContext<SSEContextValue | null>(null);

export function SSEProvider({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<FlightWithPrediction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refresh = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/flights?date=${today}`);
      const data = await res.json();
      if (data.data) {
        setFlights(data.data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  useEffect(() => {
    refresh();

    const eventSource = new EventSource('/api/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = () => {
      setIsConnected(false);
      // Auto reconnect mac dinh cua EventSource
    };

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'connected') {
          setIsConnected(true);
          return;
        }

        if (msg.type === 'predictions_updated' && msg.flights) {
          setFlights(msg.flights);
          setLastUpdated(new Date());
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  return (
    <SSEContext.Provider value={{ flights, isConnected, lastUpdated, refresh }}>
      {children}
    </SSEContext.Provider>
  );
}

export function useSSE() {
  const ctx = useContext(SSEContext);
  if (!ctx) throw new Error('useSSE must be used within SSEProvider');
  return ctx;
}
```

#### 10.3.5. Connection Status Indicator

```tsx
// src/components/layout/ConnectionStatus.tsx
'use client';
import { useSSE } from '@/hooks/useSSE';

export function ConnectionStatus() {
  const { isConnected, lastUpdated, refresh } = useSSE();

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-gray-500">
        {isConnected
          ? lastUpdated
            ? `Cap nhat: ${lastUpdated.toLocaleTimeString('vi-VN')}`
            : 'Dang ket noi...'
          : 'Mat ket noi'}
      </span>
      <button onClick={refresh} className="text-blue-500 hover:underline text-xs">
        Lam moi
      </button>
    </div>
  );
}
```

#### 10.3.6. Luu y khi deploy

**Vercel (serverless):** SSE endpoint voi persistent LISTEN connection **khong hoat dong tren Vercel** vi serverless functions co timeout. Neu deploy len Vercel, can chuyen sang phuong an **Webhook** (section 10.4) hoac **Railway + persistent process**.

**Local dev / Railway / VPS:** LISTEN/NOTIFY hoat dong tot, khong co gioi han.

**Redis la phuong an thay the tot neu can** — chi phi ~$5/thang tren Upstash, hoat dong tren Vercel serverless.

---

*Lan cap nhat: 2026-05-08 — Chuyen sang PostgreSQL LISTEN/NOTIFY cho real-time that su. Bo polling 30s, bo Redis pub/sub. Inference chi can ghi DB, trigger auto-NOTIFY, SSE push ngay den client.*


### 11.1. Phan loai user

| Loai | Mo ta | Can auth? |
|------|-------|-----------|
| Guest | Xem dashboard cong khai | Khong |
| Subscriber | Theo doi chuyen bay, nhan thong bao | Co (email) |
| Admin | Quan ly model, xem logs | Co (password) |

### 11.2. Guest (mac dinh)

Xem dashboard, bang chuyen bay, thoi tiet, thong ke - khong can dang nhap.

### 11.3. Admin (NextAuth.js)

Trang /admin: quan ly model, trigger manual inference, xem logs.

---

## 12. Deployment

### 12.1. Docker Compose (development)

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: flight_delay
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/flight_delay
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
```

### 12.2. Production (Vercel + Railway)

| Component | Nen tang | Chi phi |
|-----------|---------|---------|
| Web (Next.js) | Vercel | Mien phi |
| PostgreSQL | Railway / Supabase | ~$5/thang |
| Inference Worker | Railway / GitHub Actions | Mien phi - $5/thang |

```bash
# Deploy web len Vercel
vercel deploy

# Inference chay tren GitHub Actions (mien phi, moi 5 phut)
```

### 12.3. Environment variables

```bash
# .env.example
DATABASE_URL=postgresql://postgres:password@host:5432/flight_delay
NEXT_PUBLIC_API_URL=https://your-domain.com
```

---

## 13. Monitoring & Observability

### 13.1. Health check

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const checks = { postgres: false };
  try {
    await query('SELECT 1');
    checks.postgres = true;
  } catch {}

  const healthy = checks.postgres;
  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: healthy ? 200 : 503 });
}
```

### 13.2. Logging

Dung console.log trong Next.js. Logs hien thi trong Vercel dashboard hoac stdout khi chay local.

---

## 14. Roadmap

### Phase 1: Foundation (Tuan 1-2)
- [ ] Setup Next.js project: npx create-next-app@latest web
- [ ] Ket noi PostgreSQL (DATABASE_URL)
- [ ] Implement 3 query functions: getFlightsWithPredictions, getLatestWeather, getFlightByKey
- [ ] Implement 3 API routes: /api/flights, /api/weather, /api/flights/[key]
- [ ] Dashboard page voi flight table (ISR, filter, sort, pagination)

### Phase 2: UI Components (Tuan 3)
- [ ] PredictionBadge, WeatherCard, WeatherGrid
- [ ] FlightTable voi TanStack Table
- [ ] Trang chi tiet chuyen bay /flights/[key]
- [ ] FlightTimeline (lich su trang thai)
- [ ] Trang thoi tiet /weather
- [ ] Trang thong ke /stats voi Recharts

### Phase 3: Real-time + Worker (Tuan 4)
- [ ] Chay migration: `src/db/migrations/002_add_notify_trigger.sql` (PostgreSQL trigger)
- [ ] Module `src/lib/dbListener.ts` (LISTEN handler)
- [ ] SSE endpoint `/api/stream` + SSE hook frontend
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
| Vercel | Next.js hosting | Mien phi |
| Railway / Supabase | PostgreSQL | ~$5/thang |
| GitHub Actions | CI/CD + Inference Worker | Mien phi |

### Development

| Tool | Muc dich |
|------|---------|
| ESLint + Prettier | Code style |
| Vitest | Unit tests |
| Playwright | E2E tests |
| Docker | Development environment |

---

*Lan cap nhat: 2026-05-08 — Cap nhat theo thuc te project: bo Redis/ONNX, dung lai inference.py + flights_predictions co san, Python subprocess thay vi Node.js worker.*

});

// Usage
logger.info({ flight_key, delay_minutes_predicted }, 'Prediction computed');
logger.error({ err }, 'Model inference failed');
```

### 14.2. Health check

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { db } from '@/lib/db';

export async function GET() {
  const checks = {
    redis: false,
    postgres: false,
    model: false,
  };

  try {
    await redis.ping();
    checks.redis = true;
  } catch {}

  try {
    await db.query('SELECT 1');
    checks.postgres = true;
  } catch {}

  const healthy = Object.values(checks).every(Boolean);
  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }, { status: healthy ? 200 : 503 });
}
```

### 14.3. Metrics (tùy chọn)

Dùng Prometheus client cho Node.js để thu thập metrics:

- `prediction_latency_ms`: Thời gian inference model
- `sse_client_count`: Số lượng SSE client đang kết nối
- `cache_hit_rate`: Tỷ lệ cache hit Redis
- `flights_processed_total`: Tổng số chuyến bay đã xử lý

---


*Lần cập nhật: 2026-05-08*
