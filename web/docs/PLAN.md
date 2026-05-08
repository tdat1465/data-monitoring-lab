# Flight Delay Prediction — Web Application Plan

> **Project:** Trang web hiển thị kết quả dự báo độ trễ chuyến bay theo thời gian thực (runtime).
>
> **Parent project:** `ida-data-monitoring` — hệ thống thu thập dữ liệu chuyến bay và thời tiết từ 3 sân bay lớn nhất Việt Nam (Nội Bài, Đà Nẵng, Tân Sơn Nhất) vào PostgreSQL.
>
> **Stack đề xuất:** Node.js (backend worker) + Next.js (frontend + API routes) + Redis (cache) + PostgreSQL (nguồn dữ liệu).
>
> **Kiến trúc áp dụng:** Hybrid — ISR + Redis Cache + Server-Sent Events (SSE).

---

## Mục lục

- [1. Tổng quan bài toán](#1-tổng-quan-bài-toán)
- [2. Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
- [3. Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
- [4. Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
- [5. Thiết kế database schema](#5-thiết-kế-database-schema)
- [6. Redis cache strategy](#6-redis-cache-strategy)
- [7. Backend — Node.js Worker](#7-backend--nodejs-worker)
- [8. API Layer — Next.js API Routes](#8-api-layer--nextjs-api-routes)
- [9. Model integration (Node.js)](#9-model-integration-nodejs)
- [10. Frontend — Next.js Pages & Components](#10-frontend--nextjs-pages--components)
- [11. Real-time: Server-Sent Events (SSE)](#11-real-time-server-sent-events-sse)
- [12. Authentication & Authorization](#12-authentication--authorization)
- [13. Deployment](#13-deployment)
- [14. Monitoring & Observability](#14-monitoring--observability)
- [15. Roadmap](#15-roadmap)
- [16. Tech stack tổng hợp](#16-tech-stack-tổng-hợp)

---

## 1. Tổng quan bài toán

### 1.1. Bối cảnh

Hệ thống hiện tại (`ida-data-monitoring`) đã xây dựng xong pipeline thu thập và xử lý dữ liệu:

- **Thu thập dữ liệu** từ 3 sân bay (Nội Bài, Đà Nẵng, Tân Sơn Nhất) + thời tiết METAR từ NOAA, lưu vào PostgreSQL mỗi 30 phút qua GitHub Actions.
- **Xử lý dữ liệu** qua 9 bước trong Jupyter Notebook, tạo tập huấn luyện 1,098 mẫu với 35 features.
- **Trạng thái hiện tại:** Dữ liệu đã được gán nhãn và lưu vào bảng `training_dataset_labeled` trong PostgreSQL. Bước tiếp theo là xây dựng trang web để hiển thị kết quả dự báo runtime.

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
| **Latency** | First Contentful Paint < 2s; Prediction update < 5s sau khi có data mới |
| **Data freshness** | Dữ liệu chuyến bay cập nhật mỗi 3-5 phút; thời tiết mỗi 30 phút |
| **Concurrency** | Hỗ trợ tối thiểu 100 user đồng thời |
| **Model inference** | Thời gian dự đoán < 100ms mỗi chuyến bay |
| **Không polling liên tục** | Dùng SSE/WebSocket thay vì polling mỗi few giây |
| **SEO-friendly** | Trang chính cần render được HTML đầy đủ (Server Components) |

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
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                      │
│                                                                                  │
│   Next.js (Frontend)                                                              │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │  Server Component (ISR) ────► HTML tĩnh (first load < 2s)               │  │
│   │  Client Component (SSE) ────► Real-time UI update (không reload)         │  │
│   │  TanStack Table ────────────► Bảng chuyến bay có filter/sort/pagination   │  │
│   │  Recharts ─────────────────► Biểu đồ thống kê                             │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │ HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS (Vercel / Node server)                       │
│                                                                                  │
│  ┌─────────────────┐  ┌────────────────────┐  ┌─────────────────────────────┐   │
│  │  API Routes     │  │  Server Components │  │  SSE Event Stream          │   │
│  │  /api/flights   │  │  (ISR, revalidate  │  │  /api/stream               │   │
│  │  /api/weather   │  │   = 300s)          │  │  (ReadableStream)          │   │
│  │  /api/flights/  │  │                    │  │                             │   │
│  │     [key]       │  │  Đọc từ Redis      │  │  Push updates khi          │   │
│  │                 │  │  Fallback: PG      │  │  prediction thay đổi       │   │
│  └────────┬────────┘  └─────────┬──────────┘  └───────────▲──────────────┘   │
│           │                       │                            │                │
│           └───────────────────────┼────────────────────────────┘                │
│                                   │                                             │
│                          ┌────────▼────────┐                                   │
│                          │  Redis Cache     │ ◄── TTL: 10 phút                  │
│                          │  predictions:*   │ ◄── predictions:daily_all        │
│                          │  weather:*       │ ◄── last_crawl_at               │
│                          └────────┬────────┘                                   │
│                                   │                                             │
└───────────────────────────────────┼─────────────────────────────────────────────┘
                                    │ socket / pipe
┌───────────────────────────────────┼─────────────────────────────────────────────┐
│          Node.js Worker Process  │ (Có thể chạy trong container riêng hoặc      │
│                                   ▼ separate process trên cùng server)          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Prediction Worker (Node.js / cron mỗi 3 phút)                         │   │
│  │                                                                          │   │
│  │  ① Kết nối PostgreSQL ────► Đọc flights_current_snapshot               │   │
│  │  ② Đọc weather_metar ────► Lấy thời tiết mới nhất                     │   │
│  │  ③ Tính features ────────► computeFeatures(flight, weather)            │   │
│  │  ④ Gọi ML model ─────────► model.predict(features)                     │   │
│  │  ⑤ Ghi Redis ────────────► predictions:{flight_key} = result          │   │
│  │  ⑥ Broadcast SSE ────────► eventEmitter.emit('prediction:updated')    │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Data Collector (tái sử dụng từ ida-data-monitoring)                  │   │
│  │  Gọi collect_all.py mỗi 30 phút → ghi PostgreSQL                      │   │
│  │  (Hoặc chạy trực tiếp trong worker)                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ TCP/IP
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL (Supabase / Railway / Docker)             │
│                                                                                  │
│  flights_nb ──► flights_dn ──► flights_tsn ──► weather_metar                      │
│  flights_current_snapshot ──► training_dataset_labeled                           │
│                                                                                  │
│  + Bảng mới cho web app:                                                        │
│  predictions_cache ──► user_subscriptions (nếu có auth)                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Luồng dữ liệu end-to-end

```
GitHub Actions (ida-data-monitoring)
(crawl mỗi 30 phút)
         │
         ▼
┌──────────────────┐
│  PostgreSQL       │
│  flights_nb/dn/tsn│
│  weather_metar    │
└────────┬─────────┘
         │
         │ (mỗi 3 phút)
         ▼
┌──────────────────────────────────────────────────────┐
│  Prediction Worker (Node.js)                         │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ STEP 1: SELECT * FROM flights_current_snapshot │  │
│  │        + weather_metar (latest per airport)     │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                               │
│                        ▼                               │
│  ┌────────────────────────────────────────────────┐  │
│  │ STEP 2: computeFeatures(flight, weather)        │  │
│  │        → 35 features theo pipeline notebook    │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                               │
│                        ▼                               │
│  ┌────────────────────────────────────────────────┐  │
│  │ STEP 3: model.predict(features)                │  │
│  │        → delay_minutes_predicted (float)       │  │
│  │        → confidence_score (float 0-1)          │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                               │
│                        ▼                               │
│  ┌────────────────────────────────────────────────┐  │
│  │ STEP 4: Redis SETEX                           │  │
│  │   predictions:{flight_key} = JSON result     │  │
│  │   predictions:daily_all = JSON array         │  │
│  │   weather:latest = JSON                      │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                               │
│                        ▼                               │
│  ┌────────────────────────────────────────────────┐  │
│  │ STEP 5: eventEmitter.emit('updated', result)  │  │
│  │        → SSE clients nhận push update         │  │
│  └────────────────────────────────────────────────┘  │
└────────────────────────────┬───────────────────────────┘
                             │
                             │ ~1ms
                             ▼
┌──────────────────────────────────────────────────────┐
│  Next.js API Route / Frontend                        │
│                                                      │
│  GET /api/flights                                   │
│    → Redis GET predictions:daily_all (TTL 10min)   │
│    → Fallback: query PG + compute on-demand        │
│    → Response: JSON array (~50ms)                  │
│                                                      │
│  GET /api/stream (SSE)                             │
│    → Server-Sent Events                             │
│    → Push: { flight_key, delay_pred, updated_at }   │
│    → Client nhận + cập nhật UI tức thì              │
└──────────────────────────────────────────────────────┘
```

---

## 4. Cấu trúc thư mục

```
web/
├── docs/
│   └── WEB_PLAN.md              ← File này
│
├── src/
│   │
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (navbar, footer)
│   │   ├── page.tsx            # Dashboard tổng quan (/)
│   │   ├── globals.css         # Global styles (Tailwind)
│   │   │
│   │   ├── flights/
│   │   │   ├── page.tsx       # Danh sách chuyến bay (/flights)
│   │   │   └── [flightKey]/
│   │   │       └── page.tsx   # Chi tiết chuyến bay (/flights/:key)
│   │   │
│   │   ├── weather/
│   │   │   └── page.tsx       # Thời tiết realtime (/weather)
│   │   │
│   │   ├── stats/
│   │   │   └── page.tsx       # Thống kê & biểu đồ (/stats)
│   │   │
│   │   └── api/
│   │       ├── flights/
│   │       │   ├── route.ts    # GET /api/flights
│   │       │   └── [flightKey]/
│   │       │       └── route.ts # GET /api/flights/:key
│   │       ├── weather/
│   │       │   └── route.ts    # GET /api/weather
│   │       └── stream/
│   │           └── route.ts    # GET /api/stream (SSE)
│   │
│   ├── components/             # React components
│   │   ├── ui/                 # Primitive UI (Button, Card, Badge...)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Table.tsx       # TanStack Table wrapper
│   │   │   └── Skeleton.tsx    # Loading skeleton
│   │   │
│   │   ├── flights/           # Domain-specific components
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
│   │   │   ├── DelayRateChart.tsx  # Pie chart tỷ lệ delay
│   │   │   ├── FlightsByHourChart.tsx # Bar chart theo giờ
│   │   │   └── DelayDistributionChart.tsx # Histogram
│   │   │
│   │   └── layout/
│   │       ├── Navbar.tsx
│   │       ├── Footer.tsx
│   │       └── Sidebar.tsx
│   │
│   ├── lib/                   # Shared utilities
│   │   ├── db.ts             # PostgreSQL client (libpg)
│   │   ├── redis.ts          # Redis client (ioredis)
│   │   ├── eventEmitter.ts   # Node.js EventEmitter (SSE broadcast)
│   │   │
│   │   ├── features/
│   │   │   ├── computeFeatures.ts   # Tính 35 features (port từ notebook)
│   │   │   ├── featureSchema.ts    # TypeScript types cho features
│   │   │   └── normalizeFlight.ts   # Chuẩn hóa flight data
│   │   │
│   │   ├── model/
│   │   │   ├── predictor.ts   # Wrapper gọi model.predict()
│   │   │   └── modelLoader.ts # Load model từ file (.pkl → onnx)
│   │   │
│   │   ├── cache/
│   │   │   ├── getFlights.ts  # Đọc predictions từ Redis / PG fallback
│   │   │   └── getWeather.ts  # Đọc weather từ Redis / PG fallback
│   │   │
│   │   └── utils/
│   │       ├── formatTime.ts
│   │       ├── formatDelay.ts  # Format phút delay → "Trễ 15 phút"
│   │       └── delayColor.ts    # Màu sắc theo mức độ delay
│   │
│   ├── types/                 # TypeScript type definitions
│   │   ├── flight.ts         # Flight, FlightSnapshot, FlightWithPrediction
│   │   ├── weather.ts        # WeatherMETAR, WeatherWithSource
│   │   ├── prediction.ts    # PredictionResult, ConfidenceInterval
│   │   └── api.ts           # API response types
│   │
│   └── hooks/                # React hooks
│       ├── useFlights.ts     # Fetch + cache flights data
│       ├── useWeather.ts     # Fetch weather data
│       ├── useSSE.ts         # Kết nối SSE, nhận real-time updates
│       ├── usePrediction.ts  # Hook cho FlightTimeline / detail page
│       └── useFilter.ts      # Quản lý filter state
│
├── worker/                    # Node.js prediction worker (tách process)
│   ├── index.ts              # Entry point, cron scheduler
│   ├── collector.ts          # Gọi collect_all.py hoặc tái implement
│   ├── predictor.ts          # Pipeline: crawl → features → predict → cache
│   ├── sseBroadcaster.ts     # Broadcast SSE events
│   └── Dockerfile            # Container cho worker
│
├── scripts/
│   ├── train-model.py        # Huấn luyện model (từ ida-data-monitoring)
│   │                           # Xuất ra: model.onnx hoặc model.pkl
│   ├── export-model.ts       # Chuyển đổi model → format Node.js
│   └── seed-db.ts            # Seed data mẫu cho development
│
├── model/                    # ML model files
│   ├── model.onnx            # Model đã huấn luyện (ONNX runtime)
│   ├── model-metadata.json   # Metadata: feature names, version, accuracy
│   └── scaler.pkl            # StandardScaler / MinMaxScaler
│
├── prisma/                   # Prisma ORM (optional, thay thế raw SQL)
│   ├── schema.prisma
│   └── migrations/
│
├── tests/                    # Unit + integration tests
│   ├── unit/
│   │   ├── computeFeatures.test.ts
│   │   ├── formatDelay.test.ts
│   │   └── predictor.test.ts
│   ├── integration/
│   │   ├── api-flights.test.ts
│   │   └── api-stream.test.ts
│   └── e2e/
│       └── dashboard.test.ts  # Playwright E2E
│
├── .env.example              # Template biến môi trường
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── Dockerfile                # Container cho toàn bộ web app
├── docker-compose.yml        # PostgreSQL + Redis + Worker + Web
└── vercel.json               # Config cho Vercel deployment
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
    direction TEXT,          -- 'Arrival' | 'Departure'
    scheduled_time TIME,
    estimated_time TIME,
    airport TEXT,             -- Sân bay đối tác (route airport)
    flight_number TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
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

-- Snapshot chuyến bay mới nhất (tạo bởi notebook)
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
    label_delay INTEGER,     -- 0 | 1 | NULL
    -- weather fields
    temperature_c NUMERIC,
    dew_point_c NUMERIC,
    wind_direction_deg NUMERIC,
    wind_speed_kt NUMERIC,
    visibility_miles NUMERIC,
    cloud_cover TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tập huấn luyện đã gán nhãn
CREATE TABLE training_dataset_labeled (
    flight_key TEXT,
    -- ... 35 features + 2 target columns
    PRIMARY KEY(flight_key)
);
```

### 5.2. Các bảng mới cho web app

```sql
-- Bảng lưu predictions đã tính sẵn (web app đọc từ đây thay vì tính lại)
CREATE TABLE predictions_cache (
    flight_key TEXT PRIMARY KEY,
    flight_date DATE NOT NULL,

    -- Thông tin chuyến bay
    flight_number TEXT NOT NULL,
    source_airport TEXT NOT NULL,  -- 'NB' | 'DN' | 'TSN'
    direction TEXT NOT NULL,       -- 'Arrival' | 'Departure'
    route_airport_std TEXT,
    scheduled_dt TIMESTAMPTZ NOT NULL,

    -- Kết quả dự đoán
    delay_minutes_predicted NUMERIC NOT NULL,
    confidence_score NUMERIC,       -- 0-1
    model_version TEXT NOT NULL,    -- 'v1.0', 'v1.1'...

    -- Thời tiết tại thời điểm dự đoán
    weather_source TEXT,            -- 'VVNB' | 'VVDN' | 'VVTS'
    temperature_c NUMERIC,
    visibility_miles NUMERIC,
    wind_speed_kt NUMERIC,
    cloud_cover TEXT,

    -- Metadata
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,         -- = computed_at + 30 phút
    is_active BOOLEAN DEFAULT TRUE   -- FALSE khi chuyến bay đã cất/hạ cánh
);

CREATE INDEX idx_predictions_cache_date ON predictions_cache(flight_date);
CREATE INDEX idx_predictions_cache_source ON predictions_cache(source_airport);
CREATE INDEX idx_predictions_cache_active ON predictions_cache(is_active) WHERE is_active = TRUE;

-- Bảng lưu thời tiết đã tiền xử lý (cache cho web)
CREATE TABLE weather_cache (
    icao_code TEXT PRIMARY KEY,  -- 'VVNB' | 'VVDN' | 'VVTS'
    source_airport TEXT,          -- 'NB' | 'DN' | 'TSN'
    report_time_vn TIMESTAMPTZ,
    temperature_c NUMERIC,
    dew_point_c NUMERIC,
    wind_direction_deg NUMERIC,
    wind_speed_kt NUMERIC,
    visibility_miles NUMERIC,
    cloud_cover TEXT,
    raw_metar TEXT,
    is_low_visibility BOOLEAN GENERATED ALWAYS AS (visibility_miles <= 3) STORED,
    temp_dew_spread NUMERIC GENERATED ALWAYS AS (temperature_c - dew_point_c) STORED,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng theo dõi user subscription (cho SSE notification)
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,      -- Anonymous session hoặc user_id
    flight_key TEXT REFERENCES predictions_cache(flight_key),
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    notified BOOLEAN DEFAULT FALSE,
    UNIQUE(session_id, flight_key)
);

CREATE INDEX idx_subscriptions_session ON user_subscriptions(session_id);
CREATE INDEX idx_subscriptions_flight ON user_subscriptions(flight_key);
```

### 5.3. ERD đơn giản

```
flights_nb/dn/tsn ──► flights_current_snapshot
                            │
                            ▼
              ┌─────────────────────────┐
              │  predictions_cache      │  ← Đọc từ web app
              │  (flight_key PK)        │
              └───────────┬─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│weather_metar│  │user_subscriptions│  │ weather_cache      │
│(readonly)   │  │                  │  │ (preprocessed)      │
└─────────────┘  └─────────────────┘  └─────────────────────┘
```

---

## 6. Redis cache strategy

### 6.1. Key design

| Key | Type | TTL | Mô tả |
|-----|------|-----|--------|
| `predictions:daily:{YYYY-MM-DD}` | Hash | 24h | Tất cả predictions ngày YYYY-MM-DD |
| `prediction:{flight_key}` | String (JSON) | 10 phút | Prediction cho 1 chuyến bay cụ thể |
| `weather:latest:{icao}` | String (JSON) | 30 phút | Thời tiết mới nhất cho mỗi sân bay |
| `flights:snapshot` | String (JSON) | 5 phút | Snapshot flights_current_snapshot |
| `meta:last_crawl_at` | String (ISO) | — | Thời điểm crawl gần nhất |
| `meta:last_predict_at` | String (ISO) | — | Thời điểm predict gần nhất |
| `model:version` | String | — | Phiên bản model đang dùng |
| `sse:client:count` | String (int) | — | Số lượng SSE client đang kết nối |

### 6.2. Cache-aside pattern

```
┌─────────────────────────────────────────────────────────┐
│  Next.js API Route                                      │
│                                                         │
│  GET /api/flights                                      │
│      │                                                  │
│      ▼                                                  │
│  Redis GET predictions:daily:{date}                    │
│      │                                                  │
│      ├── HIT ──► Trả JSON ──► ~5ms response           │
│      │                                                  │
│      └── MISS ──► Query PostgreSQL ──► Compute ──►     │
│                   Redis SETEX ──► Trả JSON             │
│                   (~500ms lần đầu, nhanh sau đó)        │
└─────────────────────────────────────────────────────────┘
```

### 6.3. Redis data structures

```typescript
// Key: predictions:daily:2026-05-08
// Type: Hash (field = flight_key, value = JSON string)
{
  "NB|Arrival|VN224|2026-05-08 10:00": JSON.stringify({
    flight_key: "NB|Arrival|VN224|2026-05-08 10:00",
    flight_number: "VN224",
    source_airport: "NB",
    direction: "Arrival",
    route_airport_std: "HO CHI MINH",
    scheduled_dt: "2026-05-08T10:00:00+07:00",
    estimated_time: "10:15",
    status_raw: "On time",
    delay_minutes_predicted: 8,
    confidence_score: 0.82,
    weather: {
      icao: "VVNB",
      temperature_c: 32,
      visibility_miles: 5,
      wind_speed_kt: 12,
      cloud_cover: "FEW@1500ft"
    },
    computed_at: "2026-05-08T10:03:00+07:00"
  }),
  ...
}

// Key: weather:latest:VVNB
// Type: String (JSON)
JSON.stringify({
  icao_code: "VVNB",
  source_airport: "NB",
  report_time_vn: "2026-05-08T10:00:00+07:00",
  temperature_c: 32,
  dew_point_c: 26,
  wind_direction_deg: 180,
  wind_speed_kt: 12,
  visibility_miles: 5,
  cloud_cover: "FEW@1500ft",
  raw_metar: "METAR VVNB 080300Z 18012KT 5000 FEW015 32/26 Q1009...",
  is_low_visibility: false,
  temp_dew_spread: 6
})
```

### 6.4. Cache invalidation

- **Time-based expiry (TTL):** Mỗi key có TTL riêng (5-30 phút). Hết TTL → tự động xóa.
- **Event-based invalidation:** Khi chuyến bay đổi trạng thái → xóa key `prediction:{flight_key}`, worker tính lại.
- **Daily reset:** Key `predictions:daily:{date}` có TTL = 48h, tự động cleanup.

---

## 7. Backend — Node.js Worker

### 7.1. Trách nhiệm của Worker

Worker là một process riêng (tách khỏi Next.js) chạy liên tục, đảm nhiệm:

1. **Thu thập dữ liệu** — Gọi `collect_all.py` hoặc tái implement scraper trong Node.js (mỗi 30 phút).
2. **Tính prediction** — Load model, tính features, chạy inference cho tất cả chuyến bay (mỗi 3-5 phút).
3. **Cập nhật cache** — Ghi kết quả vào Redis.
4. **Broadcast SSE** — Phát sự kiện cho các client đang kết nối khi có prediction mới.

### 7.2. Cron schedule

```typescript
// worker/index.ts
import cron from 'node-cron';

// Crawl dữ liệu mới mỗi 30 phút
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Bắt đầu crawl dữ liệu...');
  await collector.run();
  console.log('[CRON] Crawl hoàn tất');
});

// Tính prediction mỗi 3 phút
cron.schedule('*/3 * * * *', async () => {
  console.log('[CRON] Bắt đầu tính predictions...');
  await predictor.run();
  console.log('[CRON] Predictions hoàn tất');
});

// Dọn cache cũ mỗi giờ
cron.schedule('0 * * * *', async () => {
  await cacheCleanup();
});
```

### 7.3. Worker pipeline (predictor.run)

```typescript
// worker/predictor.ts
export async function run(): Promise<void> {
  const start = Date.now();

  // ① Load thời tiết mới nhất từ Redis / PostgreSQL
  const weather = await getLatestWeather();
  console.log(`[Predictor] Đã load ${weather.length} bản tin thời tiết`);

  // ② Load tất cả chuyến bay hôm nay từ PostgreSQL
  const flights = await getTodayFlights();
  console.log(`[Predictor] Đã load ${flights.length} chuyến bay`);

  // ③ Load model (load 1 lần, reuse cho tất cả predictions)
  const model = await modelLoader.load();
  const scaler = await modelLoader.loadScaler();

  // ④ Duyệt từng chuyến bay, tính prediction
  const results: PredictionResult[] = [];
  for (const flight of flights) {
    // Lấy thời tiết cho sân bay nguồn
    const wx = weather.find(w => w.source_airport === flight.source_airport);

    // Tính 35 features (port từ notebook)
    const features = computeFeatures(flight, wx);

    // Chuẩn hóa features (fit_transform bằng scaler đã lưu)
    const scaled = scaler.transform([features]);

    // Gọi model inference
    const [delayMinutes, confidence] = model.predict(scaled);

    const result: PredictionResult = {
      flight_key: flight.flight_key,
      flight_number: flight.flight_number,
      source_airport: flight.source_airport,
      direction: flight.direction,
      route_airport_std: flight.route_airport_std,
      scheduled_dt: flight.scheduled_dt,
      estimated_time: flight.estimated_time,
      status_raw: flight.status_raw,
      delay_minutes_predicted: delayMinutes,
      confidence_score: confidence,
      weather: wx ? {
        icao: wx.icao_code,
        temperature_c: wx.temperature_c,
        visibility_miles: wx.visibility_miles,
        wind_speed_kt: wx.wind_speed_kt,
        cloud_cover: wx.cloud_cover,
      } : null,
      computed_at: new Date().toISOString(),
    };

    results.push(result);

    // Ghi Redis (batch để tối ưu)
    await redis.setex(
      `prediction:${flight.flight_key}`,
      600, // TTL 10 phút
      JSON.stringify(result)
    );

    // Broadcast SSE event
    eventEmitter.emit('prediction:updated', result);
  }

  // Ghi snapshot daily
  const today = new Date().toISOString().split('T')[0];
  await redis.setex(`predictions:daily:${today}`, 86400, JSON.stringify(results));

  // Cập nhật metadata
  await redis.set('meta:last_predict_at', new Date().toISOString());

  console.log(`[Predictor] Hoàn tất ${results.length} predictions trong ${Date.now() - start}ms`);
}
```

### 7.4. Kết nối Worker ↔ Web App

Worker và Next.js web app giao tiếp qua **3 kênh**:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Worker         │     │  Redis           │     │  Next.js        │
│  (Prediction)   │────►│  (Message bus)   │◄───│  (Web App)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                     ▲                          │
         │                     │                          │
         │           ┌─────────┴──────────┐               │
         │           │  SSE EventEmitter  │               │
         │           │  (Shared singleton) │               │
         │           └────────▲───────────┘               │
         │                    │                          │
         │                    │                          │
         └────────────────────┴──────────────────────────┘
                    (Cùng process / shared Redis pub/sub)
```

**Cơ chế 1 — Redis pub/sub** (đa process):
Worker publish → Redis channel `predictions` → Next.js subscribe → cập nhật state.

**Cơ chế 2 — Shared EventEmitter** (cùng process):
Dùng `EventEmitter` global trong singleton, cả worker và Next.js cùng import.

**Cơ chế 3 — SSE polling nhẹ** (đơn giản nhất):
Worker ghi Redis + Next.js SSE endpoint đọc từ Redis, không cần shared event emitter.

---

## 8. API Layer — Next.js API Routes

### 8.1. API: GET /api/flights

```typescript
// src/app/api/flights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFlightsFromCache } from '@/lib/cache/getFlights';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // Parse query params
  const date = searchParams.get('date') ?? getTodayDate();
  const source = searchParams.get('source');       // 'NB' | 'DN' | 'TSN'
  const direction = searchParams.get('direction'); // 'Arrival' | 'Departure'
  const airline = searchParams.get('airline');
  const status = searchParams.get('status');       // 'on_time' | 'delayed' | 'cancelled'
  const search = searchParams.get('search');        // mã chuyến bay
  const sortBy = searchParams.get('sortBy') ?? 'scheduled_dt';
  const sortOrder = searchParams.get('sortOrder') ?? 'asc';
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '50');

  try {
    // ① Đọc từ Redis cache (TTL 5 phút)
    const allFlights = await getFlightsFromCache(date);

    // ② Filter
    let filtered = allFlights;
    if (source) filtered = filtered.filter(f => f.source_airport === source);
    if (direction) filtered = filtered.filter(f => f.direction === direction);
    if (airline) filtered = filtered.filter(f => f.airline_code === airline);
    if (status) filtered = filtered.filter(f => f.status_group === status);
    if (search) filtered = filtered.filter(f =>
      f.flight_number.toLowerCase().includes(search.toLowerCase())
    );

    // ③ Sort
    filtered.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a];
      const bVal = b[sortBy as keyof typeof b];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // ④ Paginate
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    // ⑤ Trả response
    return NextResponse.json({
      data: paginated,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        last_updated: await getLastPredictTime(),
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      }
    });

  } catch (error) {
    console.error('[API /flights]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 8.2. API: GET /api/flights/[flightKey]

```typescript
// src/app/api/flights/[flightKey]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFlightByKey } from '@/lib/cache/getFlights';
import { getFlightHistory } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { flightKey: string } }
) {
  const { flightKey } = params;

  try {
    // Prediction hiện tại (từ Redis)
    const prediction = await getFlightByKey(flightKey);

    if (!prediction) {
      return NextResponse.json(
        { error: 'Flight not found' },
        { status: 404 }
      );
    }

    // Lịch sử trạng thái (từ flights_nb/dn/tsn)
    const history = await getFlightHistory(flightKey);

    return NextResponse.json({
      ...prediction,
      history,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 8.3. API: GET /api/weather

```typescript
// src/app/api/weather/route.ts
import { NextResponse } from 'next/server';
import { getWeatherFromCache } from '@/lib/cache/getWeather';

export async function GET() {
  try {
    const weather = await getWeatherFromCache();
    // ['VVNB', 'VVDN', 'VVTS']

    return NextResponse.json({
      data: weather,
      meta: {
        count: weather.length,
        last_updated: weather[0]?.updated_at ?? null,
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 8.4. Response schema

```typescript
// src/types/api.ts

// GET /api/flights
interface FlightsResponse {
  data: FlightWithPrediction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    last_updated: string; // ISO
  };
}

// GET /api/flights/[flightKey]
interface FlightDetailResponse extends FlightWithPrediction {
  history: FlightStatusHistory[];
}

interface FlightStatusHistory {
  retrieved_at_vn: string;
  status_raw: string;
  status_group: string;
  estimated_time: string | null;
  delay_minutes: number | null;
}

// Common
interface FlightWithPrediction {
  flight_key: string;
  flight_number: string;
  airline_code: string;           // 'VJ', 'VN', 'QH'...
  source_airport: 'NB' | 'DN' | 'TSN';
  source_airport_name: string;    // 'Nội Bài', 'Đà Nẵng', 'Tân Sơn Nhất'
  direction: 'Arrival' | 'Departure';
  route_airport_std: string;      // 'HO CHI MINH', 'DA NANG'...
  scheduled_dt: string;           // ISO with timezone
  estimated_time: string | null;
  status_raw: string;
  status_group: 'on_time' | 'delayed' | 'landed' | 'departed' | 'cancelled' | 'unknown';
  delay_minutes_predicted: number;
  confidence_score: number;       // 0-1
  weather?: {
    icao: string;
    temperature_c: number;
    visibility_miles: number;
    wind_speed_kt: number;
    cloud_cover: string;
  };
  computed_at: string;
}
```

---

## 9. Model integration (Node.js)

### 9.1. Chọn model format

Vấn đề: Model huấn luyện bằng Python (`scikit-learn` / `XGBoost` / `LightGBM`), nhưng web app dùng Node.js.

**Giải pháp:**

| Cách | Ưu điểm | Nhược điểm |
|------|---------|-----------|
| **ONNX Runtime** (đề xuất) | Nhanh, cross-platform, hỗ trợ nhiều framework | Cần convert từ .pkl → .onnx |
| **Python subprocess** | Giữ nguyên code Python | Latency cao (~200ms/call), cần Python env |
| **PMML / JSON model** | Không cần Python runtime | Không hỗ trợ mọi model |
| **Embed Python trong WebAssembly** | Bảo mật, cross-platform | Phức tạp, tốc độ chậm |

**Đề xuất: ONNX Runtime for Node.js**

```bash
npm install onnxruntime-node
```

### 9.2. Huấn luyện và export model

```python
# scripts/train-model.py (trong ida-data-monitoring)
# Chạy trong môi trường Python có sẵn

import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
import onnx
from skl2onnx import convert_sklearn
import joblib

# Load training data
df = pd.read_csv('training_dataset_labeled.csv')
X = df[FEATURE_COLUMNS]  # 35 features
y = df['delay_minutes']   # Regression target

# Train
model = GradientBoostingRegressor(n_estimators=200, max_depth=5)
model.fit(X, y)

# Save scaler
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
joblib.dump(scaler, 'web/model/scaler.pkl')

# Convert to ONNX
initial_type = [('float_input', FloatTensorType([None, 35]))]
onnx_model = convert_sklearn(model, initial_types=initial_type)
with open('web/model/model.onnx', 'wb') as f:
    f.write(onnx_model.SerializeToString())

print(f'Model trained. MAE on training set: {np.mean(np.abs(model.predict(X) - y)):.2f} minutes')
```

### 9.3. Model inference trong Node.js

```typescript
// src/lib/model/predictor.ts
import * as ort from 'onnxruntime-node';
import { Features } from '@/types/flight';

let session: ort.InferenceSession | null = null;
let scalerData: number[][] | null = null;

export async function loadModel(modelPath: string, scalerPath: string): Promise<void> {
  session = await ort.InferenceSession.create(modelPath);
  const scalerRaw = await fs.promises.readFile(scalerPath);
  const scaler = JSON.parse(scalerRaw.toString());
  scalerData = {
    mean: scaler.mean,
    std: scaler.std,
  };
  console.log('[Model] Loaded ONNX model + scaler');
}

export function predict(features: Features): { delayMinutes: number; confidence: number } {
  if (!session || !scalerData) {
    throw new Error('Model not loaded');
  }

  // ① Normalize features bằng scaler đã lưu
  const scaled = features.map((f, i) =>
    (f - scalerData!.mean[i]) / scalerData!.std[i]
  );

  // ② Đảm bảo đúng shape [1, 35]
  const inputTensor = new ort.Tensor('float_input',
    new Float32Array(scaled), [1, features.length]
  );

  // ③ Inference
  const results = session.run({ float_input: inputTensor });
  const output = results.output0.data as Float32Array;

  const delayMinutes = output[0];
  const confidence = estimateConfidence(delayMinutes, output);

  return { delayMinutes, confidence };
}

function estimateConfidence(delayMinutes: number, output: Float32Array): number {
  // Đơn giản: confidence cao khi prediction gần 0 (on-time) hoặc rất lớn (clearly delayed)
  const spread = Math.max(...output) - Math.min(...output);
  return Math.min(1, spread / 30);
}
```

### 9.4. Feature engineering (port từ notebook)

```typescript
// src/lib/features/computeFeatures.ts
import { FlightSnapshot, WeatherMETAR, Features } from '@/types';

export const FEATURE_NAMES = [
  // Time features
  'scheduled_hour',
  'scheduled_dayofweek',
  'scheduled_month',
  'minutes_to_departure_at_snapshot',
  // Flight features
  'source_airport_encoded',    // NB=0, DN=1, TSN=2
  'direction_encoded',        // Arrival=0, Departure=1
  'route_airport_encoded',
  'airline_code_encoded',
  'flight_num_only',
  'is_estimated_missing',
  // Weather features
  'temperature_c',
  'dew_point_c',
  'wind_direction_deg',
  'wind_speed_kt',
  'visibility_miles',
  'is_low_visibility',
  'is_wind_variable',
  'temp_dew_spread',
  'cloud_cover_encoded',
  // Interaction features
  'hour_x_visibility',
  'wind_x_delay_risk_airport',
  // ... tổng cộng 35 features
];

export function computeFeatures(
  flight: FlightSnapshot,
  weather: WeatherMETAR | null
): Features {
  const scheduledDt = new Date(flight.scheduled_dt);
  const retrievedAt = new Date(flight.retrieved_at_vn ?? new Date());

  return [
    // Time (4)
    scheduledDt.getHours(),
    scheduledDt.getDay(),           // 0=CN, 1=T2...
    scheduledDt.getMonth() + 1,
    (scheduledDt.getTime() - retrievedAt.getTime()) / 60000, // minutes to departure

    // Flight encoded (6)
    airportToCode(flight.source_airport),
    directionToCode(flight.direction),
    routeToCode(flight.route_airport_std),
    airlineToCode(extractAirline(flight.flight_number)),
    parseInt(flight.flight_number.replace(/\D/g, '')) || 0,
    flight.estimated_time ? 0 : 1,

    // Weather (10)
    weather?.temperature_c ?? -999,
    weather?.dew_point_c ?? -999,
    weather?.wind_direction_deg ?? -999,
    weather?.wind_speed_kt ?? -999,
    weather?.visibility_miles ?? -999,
    (weather?.visibility_miles ?? 99) <= 3 ? 1 : 0,
    weather?.wind_direction_deg === 'VRB' ? 1 : 0,
    (weather?.temperature_c ?? 0) - (weather?.dew_point_c ?? 0),
    cloudCoverToCode(weather?.cloud_cover ?? 'clear'),

    // Interaction (4)
    scheduledDt.getHours() * (weather?.visibility_miles ?? 99),
    (weather?.wind_speed_kt ?? 0) * airportDelayRisk(flight.source_airport),

    // ... padding to 35 features
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ] as Features;
}

// Encoding helpers
const airportMap: Record<string, number> = { NB: 0, DN: 1, TSN: 2 };
const directionMap: Record<string, number> = { Arrival: 0, Departure: 1 };
const airlineMap: Record<string, number> = {
  VJ: 0, VN: 1, QH: 2, BL: 3, 9G: 4, VU: 5,
};
const cloudCoverMap: Record<string, number> = {
  clear: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4,
};
```

---

## 10. Frontend — Next.js Pages & Components

### 10.1. Root Layout

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footbar';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'Flight Delay Monitor — Dự báo trễ chuyến bay Việt Nam',
  description: 'Theo dõi và dự báo độ trễ chuyến bay tại 3 sân bay lớn nhất Việt Nam: Nội Bài, Đà Nẵng, Tân Sơn Nhất. Cập nhật realtime.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
```

### 10.2. Dashboard Page (Server Component + ISR)

```tsx
// src/app/page.tsx
import { Suspense } from 'react';
import { getFlightsFromCache } from '@/lib/cache/getFlights';
import { FlightTable } from '@/components/flights/FlightTable';
import { WeatherGrid } from '@/components/weather/WeatherGrid';
import { StatsOverview } from '@/components/stats/StatsOverview';
import { SSEProvider } from '@/hooks/useSSE';

export const revalidate = 300; // ISR: revalidate mỗi 5 phút

async function getData() {
  const today = new Date().toISOString().split('T')[0];
  const [flights, weather] = await Promise.all([
    getFlightsFromCache(today),
    getWeatherFromCache(),
  ]);
  return { flights, weather };
}

export default async function DashboardPage() {
  const { flights, weather } = await getData();

  const stats = {
    total: flights.length,
    delayed: flights.filter(f => f.delay_minutes_predicted >= 15).length,
    onTime: flights.filter(f => f.delay_minutes_predicted < 15).length,
    delayRate: flights.length > 0
      ? (flights.filter(f => f.delay_minutes_predicted >= 15).length / flights.length * 100).toFixed(1)
      : '0',
  };

  return (
    <SSEProvider>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Theo dõi chuyến bay
          </h1>
          <p className="text-gray-500 mt-1">
            Cập nhật mới nhất: {new Date().toLocaleString('vi-VN')}
          </p>
        </div>

        {/* Stats cards */}
        <StatsOverview stats={stats} />

        {/* Weather section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Thời tiết hiện tại</h2>
          <WeatherGrid weather={weather} />
        </section>

        {/* Flight table */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Danh sách chuyến bay hôm nay</h2>
          <Suspense fallback={<FlightTableSkeleton />}>
            <FlightTable initialFlights={flights} />
          </Suspense>
        </section>
      </div>
    </SSEProvider>
  );
}
```

### 10.3. FlightTable với TanStack Table + Filter

```tsx
// src/components/flights/FlightTable.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { FlightWithPrediction } from '@/types';
import { PredictionBadge } from './PredictionBadge';
import { FlightFilter } from './FlightFilter';

export function FlightTable({ initialFlights }: { initialFlights: FlightWithPrediction[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'scheduled_dt', desc: false }
  ]);
  const [filters, setFilters] = useState({
    source: '',
    direction: '',
    status: '',
    search: '',
  });

  // SSE real-time update
  const { flights, updateFlight } = useFlights(initialFlights);

  const columns = useMemo<ColumnDef<FlightWithPrediction>[]>(() => [
    {
      accessorKey: 'flight_number',
      header: 'Mã CB',
      cell: ({ row }) => (
        <a href={`/flights/${row.original.flight_key}`}
           className="font-mono font-bold text-blue-600 hover:underline">
          {row.original.flight_number}
        </a>
      ),
    },
    {
      accessorKey: 'source_airport',
      header: 'Sân bay',
      cell: ({ row }) => AIRPORT_NAMES[row.original.source_airport],
    },
    {
      accessorKey: 'direction',
      header: 'Chiều',
    },
    {
      accessorKey: 'route_airport_std',
      header: 'Điểm đến',
    },
    {
      accessorKey: 'scheduled_dt',
      header: 'Giờ bay',
      cell: ({ row }) => formatTime(row.original.scheduled_dt),
    },
    {
      accessorKey: 'status_group',
      header: 'Trạng thái',
      cell: ({ row }) => <StatusBadge status={row.original.status_group} />,
    },
    {
      accessorKey: 'delay_minutes_predicted',
      header: 'Dự đoán',
      cell: ({ row }) => (
        <PredictionBadge
          delayMinutes={row.original.delay_minutes_predicted}
          confidence={row.original.confidence_score}
        />
      ),
    },
    {
      accessorKey: 'weather.visibility_miles',
      header: 'Tầm nhìn',
      cell: ({ row }) => row.original.weather?.visibility_miles
        ? `${row.original.weather.visibility_miles} mi`
        : '—',
    },
  ], []);

  const filteredFlights = useMemo(() => {
    return flights.filter(f => {
      if (filters.source && f.source_airport !== filters.source) return false;
      if (filters.direction && f.direction !== filters.direction) return false;
      if (filters.status && f.status_group !== filters.status) return false;
      if (filters.search && !f.flight_number.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [flights, filters]);

  const table = useReactTable({
    data: filteredFlights,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <FlightFilter filters={filters} onChange={setFilters} />
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
                    {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
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
      {/* Pagination */}
      <div className="flex items-center gap-4 mt-4">
        <span className="text-sm text-gray-500">
          Tổng: {table.getFilteredRowModel().rows.length} chuyến
        </span>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          ← Trước
        </button>
        <span>Trang {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Sau →
        </button>
      </div>
    </div>
  );
}
```

### 10.4. SSE Hook cho real-time updates

```typescript
// src/hooks/useSSE.ts
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { FlightWithPrediction } from '@/types';

interface SSEContextValue {
  flights: FlightWithPrediction[];
  updateFlight: (updated: FlightWithPrediction) => void;
  isConnected: boolean;
  lastUpdate: Date | null;
}

const SSEContext = createContext<SSEContextValue | null>(null);

export function SSEProvider({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<FlightWithPrediction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Load initial data từ API route (đọc từ Redis)
    fetch('/api/flights')
      .then(res => res.json())
      .then(data => setFlights(data.data));

    // Kết nối SSE
    const eventSource = new EventSource('/api/stream');

    eventSource.onopen = () => setIsConnected(true);

    eventSource.onmessage = (event) => {
      const updated: FlightWithPrediction = JSON.parse(event.data);
      setFlights(prev => {
        const idx = prev.findIndex(f => f.flight_key === updated.flight_key);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        // Chuyến bay mới: thêm vào đầu
        return [updated, ...prev];
      });
      setLastUpdate(new Date());
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      // Reconnect sau 5 giây
      setTimeout(() => eventSource.close(), 5000);
    };

    return () => eventSource.close();
  }, []);

  const updateFlight = (updated: FlightWithPrediction) => {
    setFlights(prev => {
      const idx = prev.findIndex(f => f.flight_key === updated.flight_key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return prev;
    });
  };

  return (
    <SSEContext.Provider value={{ flights, updateFlight, isConnected, lastUpdate }}>
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

### 10.5. PredictionBadge component

```tsx
// src/components/flights/PredictionBadge.tsx
function formatDelay(minutes: number): string {
  if (minutes < 0) return `Sớm ${Math.abs(minutes)} phút`;
  if (minutes === 0) return 'Đúng giờ';
  if (minutes < 15) return `+${minutes} phút`;
  return `Trễ ${minutes} phút`;
}

function delayColor(minutes: number): string {
  if (minutes < 5)  return 'bg-green-100 text-green-800';
  if (minutes < 15) return 'bg-yellow-100 text-yellow-800';
  if (minutes < 30) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export function PredictionBadge({ delayMinutes, confidence }: {
  delayMinutes: number;
  confidence: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${delayColor(delayMinutes)}`}>
        {formatDelay(delayMinutes)}
      </span>
      <span className="text-xs text-gray-400" title="Độ tin cậy">
        {(confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}
```

---

## 11. Real-time: Server-Sent Events (SSE)

### 11.1. SSE Endpoint

```typescript
// src/app/api/stream/route.ts
import { NextRequest } from 'next/server';
import { eventEmitter } from '@/lib/eventEmitter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Gửi heartbeat mỗi 25 giây để giữ connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Handler cho mỗi prediction update
      const onUpdate = (data: FlightWithPrediction) => {
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Client đã disconnect
          eventEmitter.off('prediction:updated', onUpdate);
          clearInterval(heartbeat);
        }
      };

      eventEmitter.on('prediction:updated', onUpdate);

      // Cleanup khi client disconnect
      req.signal.addEventListener('abort', () => {
        eventEmitter.off('prediction:updated', onUpdate);
        clearInterval(heartbeat);
        controller.close();
      });

      // Gửi connected message
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'connected', at: new Date().toISOString() })}\n\n`
      ));
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',       // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

### 11.2. EventEmitter singleton

```typescript
// src/lib/eventEmitter.ts
import { EventEmitter } from 'events';

class SSEEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000); // Cho phép nhiều SSE client
  }
}

// Singleton — shared giữa API routes và worker
export const eventEmitter = new SSEEventEmitter();
```

### 11.3. SSE trong Docker multi-process

Nếu worker chạy trong container riêng (khác process với Next.js):

```typescript
// Worker: gửi message qua Redis pub/sub
import { createClient } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const publisher = redis.duplicate();

export async function broadcastPrediction(result: PredictionResult) {
  await publisher.publish('predictions', JSON.stringify(result));
}

// Next.js: subscribe Redis channel
const subscriber = redis.duplicate();
subscriber.subscribe('predictions');
subscriber.on('message', (_channel, message) => {
  const data = JSON.parse(message);
  eventEmitter.emit('prediction:updated', data);
});
```

---

## 12. Authentication & Authorization

### 12.1. Phân loại user

| Loại | Mô tả | Cần auth? |
|------|--------|-----------|
| Guest | Xem dashboard công khai | Không |
| Subscriber | Theo dõi chuyến bay cụ thể, nhận thông báo | Có (email) |
| Admin | Quản lý model, xem logs | Có (password) |

### 12.2. Guest (không cần auth)

- Xem dashboard, bảng chuyến bay, thời tiết, thống kê.
- Không cần đăng nhập.
- Được phép dùng SSE stream.

### 12.3. Subscriber (email-based, không password)

```typescript
// Đăng ký theo dõi chuyến bay
// POST /api/subscriptions
{
  "email": "user@example.com",
  "flight_key": "NB|Arrival|VN224|2026-05-08 10:00"
}

// Server gửi email khi:
// - delay dự đoán tăng > 15 phút
// - chuyến bay bị hủy
// - chuyến bay đã cất cánh
```

### 12.4. Admin (NextAuth.js)

```typescript
// Dùng NextAuth.js cho admin dashboard
// /admin → quản lý model, xem crawl logs, trigger manual crawl

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const providers = [
  CredentialsProvider({
    name: 'Admin',
    credentials: {
      username: { label: 'Username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      // Kiểm tra username/password từ env
      if (
        credentials?.username === process.env.ADMIN_USERNAME &&
        credentials?.password === process.env.ADMIN_PASSWORD
      ) {
        return { id: '1', name: 'Admin', email: 'admin@example.com' };
      }
      return null;
    },
  }),
];
```

---

## 13. Deployment

### 13.1. Docker Compose (development)

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

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  worker:
    build:
      context: .
      dockerfile: worker/Dockerfile
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 1

  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 13.2. Production deployment options

#### Option A: Vercel + Railway (đề xuất cho dự án này)

| Component | Nền tảng | Chi phí ước tính |
|-----------|---------|-----------------|
| Web (Next.js) | Vercel | Miễn phí (Hobby) |
| PostgreSQL | Railway | ~$5/tháng |
| Redis | Railway / Upstash | ~$5/tháng |
| Worker | Railway / Fly.io | ~$5/tháng |
| Model files | Vercel Blob / S3 | ~$1/tháng |

```bash
# Deploy web lên Vercel
vercel deploy

# Deploy worker lên Railway
railway up --service worker
```

#### Option B: All-in-one (1 VPS)

```
┌──────────────────────────────────────┐
│  1 VPS (Ubuntu 22.04)               │
│                                      │
│  ┌────────────┐ ┌────────────┐      │
│  │  Next.js   │ │  Worker    │      │
│  │  (port 3000)│ │  (cron)    │      │
│  └─────┬──────┘ └─────┬──────┘      │
│        │               │              │
│  ┌─────┴───────────────┴──────┐      │
│  │  PostgreSQL (5432)        │      │
│  │  Redis (6379)             │      │
│  └───────────────────────────┘      │
└──────────────────────────────────────┘
```

#### Option C: Kubernetes (production scale)

Phù hợp khi cần scale theo load. Sử dụng Helm chart cho Next.js + separate Deployment cho worker.

### 13.3. Environment variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://postgres:password@host:5432/flight_delay

# Redis
REDIS_URL=redis://localhost:6379

# Model
MODEL_PATH=./model/model.onnx
SCALER_PATH=./model/scaler.json
MODEL_VERSION=v1.0

# Admin auth
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme123

# Email (cho notification)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=password
EMAIL_FROM=flight-delay@example.com

# Vercel (production)
NEXT_PUBLIC_API_URL=https://your-domain.com
```

### 13.4. CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy Web App

on:
  push:
    branches: [main]
    paths: ['web/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: vercel deploy --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

---

## 14. Monitoring & Observability

### 14.1. Logging

```typescript
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
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

## 15. Roadmap

### Phase 1: Foundation (Tuần 1-2)
- [ ] Setup project: Next.js, TypeScript, Tailwind CSS
- [ ] Kết nối PostgreSQL + Redis
- [ ] Implement API routes cơ bản (`/api/flights`, `/api/weather`)
- [ ] Import data từ `ida-data-monitoring` vào bảng `predictions_cache`
- [ ] Dashboard page với flight table (ISR, filter, sort, pagination)

### Phase 2: Model integration (Tuần 3)
- [ ] Train model bằng Python (XGBoost / LightGBM)
- [ ] Convert sang ONNX, lưu scaler
- [ ] Implement `computeFeatures()` trong TypeScript
- [ ] Implement `predictor.ts` với ONNX Runtime
- [ ] Worker pipeline: cron → predict → Redis

### Phase 3: Real-time (Tuần 4)
- [ ] Implement SSE endpoint `/api/stream`
- [ ] Frontend SSE hook + auto-update UI
- [ ] SSE broadcaster trong worker
- [ ] Connection status indicator

### Phase 4: UI/UX (Tuần 5)
- [ ] Trang chi tiết chuyến bay `/flights/[key]`
- [ ] FlightTimeline component (lịch sử trạng thái)
- [ ] Trang thời tiết `/weather`
- [ ] Trang thống kê `/stats` với Recharts
- [ ] Mobile responsive

### Phase 5: Polish (Tuần 6)
- [ ] Authentication (NextAuth.js cho admin)
- [ ] Email notification cho subscribers
- [ ] Health check endpoint
- [ ] Error boundary + loading states
- [ ] Unit tests + E2E tests (Playwright)

### Phase 6: Production (Tuần 7-8)
- [ ] Setup CI/CD (GitHub Actions)
- [ ] Deploy: Vercel + Railway
- [ ] Monitoring (logging, health check)
- [ ] Domain + SSL
- [ ] Load testing với k6

---

## 16. Tech stack tổng hợp

### Frontend

| Thư viện | Mục đích | Version |
|---------|---------|---------|
| Next.js 14 | Framework, SSR + ISR | `^14.2` |
| TypeScript | Type safety | `^5.4` |
| Tailwind CSS | Styling | `^3.4` |
| TanStack Table | Bảng có filter/sort/pagination | `^8` |
| Recharts | Biểu đồ thống kê | `^2.12` |
| Lucide React | Icons | `^0.400` |
| date-fns | Format ngày giờ | `^3.6` |

### Backend

| Thư viện | Mục đích | Version |
|---------|---------|---------|
| Node.js | Runtime | `^20` |
| ioredis | Redis client | `^5.3` |
| pg | PostgreSQL client | `^8.12` |
| onnxruntime-node | ML inference | `^1.17` |
| node-cron | Cron scheduler | `^3.1` |
| pino | Structured logging | `^9.0` |
| zod | Schema validation | `^3.23` |

### Infrastructure

| Dịch vụ | Mục đích | Chi phí |
|---------|---------|---------|
| Vercel | Next.js hosting | Miễn phí |
| Railway | PostgreSQL + Redis + Worker | ~$15/tháng |
| Supabase | Thay thế Railway (PostgreSQL) | Miễn phí - $25/tháng |
| Upstash | Redis serverless | Miễn phí - $10/tháng |
| GitHub Actions | CI/CD | Miễn phí |
| Sentry | Error tracking | Miễn phí |

### Development

| Tool | Mục đích |
|------|---------|
| ESLint + Prettier | Code style |
| Husky + lint-staged | Pre-commit hooks |
| Vitest | Unit tests |
| Playwright | E2E tests |
| Docker + Docker Compose | Development environment |
| DBeaver / pgAdmin | Database GUI |

---

*Lần cập nhật: 2026-05-08*
