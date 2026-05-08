Last updated: 2026-05-09

# IDA Data Monitoring - Web Application

## 1. Project Overview

**Project:** Real-time flight delay prediction web application for Vietnam airports.
**Parent project:** `ida-data-monitoring` - data collection system for 3 major Vietnamese airports (Nội Bài, Đà Nẵng, Tân Sơn Nhất).
**Stack:** Next.js 14 (frontend + API) + Python (inference) + PostgreSQL (database).

### Key Features
- Display real-time flight status for 3 Vietnamese airports
- ML-based delay prediction (Two-Stage model: Classifier + Regressor)
- Real-time updates via SSE + PostgreSQL LISTEN/NOTIFY (no polling, no Redis)
- Weather display (METAR data from NOAA)

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS | Web UI |
| State | React hooks (useSSE, useFlightUpdates) | Real-time data |
| API | Next.js API Routes | REST endpoints |
| Database | PostgreSQL (pg client) | Data storage |
| ML | Python, scikit-learn | Delay prediction |
| Deployment | Vercel (web), Railway (DB) | Hosting |

### Key Libraries
- `@tanstack/react-table` - Data tables with sorting/filtering
- `recharts` - Statistics charts
- `lucide-react` - Icons
- `date-fns` - Date formatting
- `pg` - PostgreSQL client
- `zod` - Schema validation

---

## 3. Directory Structure

```
web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── flights/       # GET /api/flights
│   │   │   ├── weather/       # GET /api/weather
│   │   │   ├── stream/        # SSE endpoint (real-time)
│   │   │   └── health/         # Health check endpoints
│   │   ├── flights/           # Flight pages
│   │   ├── weather/           # Weather page
│   │   ├── stats/             # Statistics page
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Dashboard (home)
│   │
│   ├── components/            # React components
│   │   ├── flights/          # FlightCard, FlightTable
│   │   ├── weather/          # WeatherCard, WeatherGrid
│   │   ├── stats/            # Chart components
│   │   ├── ui/               # Primitives (Badge, Card, Toast)
│   │   ├── layout/           # Navbar, Footer
│   │   ├── ConnectionStatus.tsx
│   │   └── DatabaseHealthChecker.tsx
│   │
│   ├── hooks/                # React hooks
│   │   ├── useSSE.ts         # SSE connection hook
│   │   └── useDatabaseHealthCheck.ts
│   │
│   ├── lib/                  # Utilities
│   │   ├── db.ts             # PostgreSQL connection pool
│   │   ├── dbListener.ts     # LISTEN/NOTIFY handler
│   │   ├── checkDbConnection.ts
│   │   └── queries/          # Database queries
│   │       ├── getFlights.ts
│   │       ├── getFlightByKey.ts
│   │       └── getWeather.ts
│   │
│   ├── types/                # TypeScript types
│   │   ├── flight.ts
│   │   └── weather.ts
│   │
│   └── db/
│       └── migrations/
│           └── 001_add_notify_trigger.sql
│
├── docs/
│   └── PLAN.md               # Full project plan (Vietnamese)
│
├── package.json
├── next.config.ts
├── tsconfig.json
└── .env.example

# Parent project (Python)
src/
├── processing.py             # Data processing, feature engineering
├── inference.py              # ML inference, writes predictions
└── crawl_flights.py          # Data collection
```

---

## 4. Database Schema

### Main Tables

| Table | Purpose | Updated by |
|-------|---------|------------|
| `flights_nb`, `flights_dn`, `flights_tsn` | Raw flight data per airport | GitHub Actions (30 min) |
| `weather_metar` | METAR weather data | GitHub Actions (30 min) |
| `flights_current_snapshot` | Latest flight status + features | `processing.py` |
| `flights_predictions` | ML predictions (delay minutes) | `inference.py` |
| `training_dataset_labeled` | Training data | `processing.py` |

### Prediction Update Flow

```
inference.py writes to flights_predictions
    ↓
PostgreSQL TRIGGER fires (pg_notify)
    ↓
SSE endpoint receives NOTIFY
    ↓
Browser receives SSE event
    ↓
UI updates (~50ms total latency)
```

### NOTIFY Channels

| Channel | Fires when |
|---------|------------|
| `prediction_update` | INSERT/UPDATE on `flights_predictions` |
| `status_update` | UPDATE on `flights_current_snapshot.status_group` |

---

## 5. Data Flow (4 Stages)

### Stage 1: Collect (30 min)
```
GitHub Actions (cron: */30 * * * *)
    ↓
flights_nb, flights_dn, flights_tsn, weather_metar
```

### Stage 2: Processing (2-5 min, manual)
```
python src/processing.py
    ↓
flights_current_snapshot, training_dataset_labeled
```

### Stage 3: Inference (5-30 sec, manual)
```
python src/inference.py
    ↓
flights_predictions (TRIGGER → pg_notify)
```

### Stage 4: Display (real-time)
```
pg_notify → dbListener → SSE endpoint → useSSE hook → UI
    Latency: ~50ms - 26 seconds (best to worst case)
```

### Latency Summary

| Stage | Best | Worst | Average |
|-------|------|-------|---------|
| Collect | 30 min | 30 min | 30 min |
| Processing | Manual | ~5 min | Manual |
| Inference | ~5 sec | ~30 sec | ~10 sec |
| Display | ~50ms | ~26 sec | ~0-2 sec |

---

## 6. Key Patterns

### SSE + LISTEN/NOTIFY (Short Listen Pattern)

```typescript
// Client side: web/src/hooks/useSSE.ts
const { isConnected, lastUpdated, notifications } = useSSE({
  url: '/api/stream',
  onNotification: (notification) => {
    // Handle flight update
  },
});
```

```typescript
// Server side: web/src/lib/dbListener.ts
// Listens to PostgreSQL NOTIFY channels
// Uses short listen (25s) + reconnect pattern for serverless compatibility
```

**Configuration:**
- `LISTEN_DURATION_MS = 25000` (25 seconds)
- `HEARTBEAT_INTERVAL_MS = 20000` (20 seconds)
- `MAX_RECONNECT_ATTEMPTS = 5`
- Exponential backoff: 1s → 2s → 4s → 8s → 16s

### Database Query Pattern

```typescript
// web/src/lib/db.ts
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
```

### Flight Key Format

```
flight_key = source|dir|route|flight_num|scheduled_dt
Example: NB|Arrival|DAD|VJ1208|2026-05-08T10:00:00
```

---

## 7. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/flights` | GET | List flights with predictions |
| `/api/flights/[key]` | GET | Flight detail |
| `/api/weather` | GET | Latest weather for 3 airports |
| `/api/stream` | GET | SSE real-time stream |
| `/api/health` | GET | Health check |

### Query Parameters for `/api/flights`

| Param | Default | Description |
|-------|---------|-------------|
| `date` | today | Flight date (YYYY-MM-DD) |
| `source` | all | Filter by airport (NB, DN, TSN) |
| `direction` | all | Arrival or Departure |
| `status` | active | Filter by status |
| `search` | - | Search by flight number |
| `sortBy` | scheduled_dt | Sort field |
| `sortOrder` | asc | Sort direction |
| `page` | 1 | Page number |
| `limit` | 50 | Items per page |

---

## 8. Flight Types

```typescript
// web/src/types/flight.ts
interface Flight {
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
  delay_minutes: number | null;
  label_delay: number | null;
}
```

### Status Groups
- `scheduled` - Chưa khởi hành
- `boarding` - Đang boarding
- `departed` - Đã cất cánh
- `landed` - Đã hạ cánh
- `delayed` - Bị delay
- `cancelled` - Bị hủy

### Airport Codes
| Code | Name | ICAO |
|------|------|------|
| NB | Nội Bài | VVNB |
| DN | Đà Nẵng | VVDN |
| TSN | Tân Sơn Nhất | VVTS |

---

## 9. Important Notes

### Running Order

```bash
# 1. GitHub Actions crawls data (every 30 min)
#    → flights_nb, flights_dn, flights_tsn, weather_metar

# 2. Manual: Run processing
python src/processing.py
#    → flights_current_snapshot, training_dataset_labeled

# 3. Manual: Run inference
python src/inference.py
#    → flights_predictions (TRIGGER auto-NOTIFY)

# 4. Web dashboard auto-updates via SSE
```

### NOTIFY Trigger

The trigger in `001_add_notify_trigger.sql` is **already set up**. It fires automatically when `inference.py` writes to `flights_predictions`. No manual NOTIFY call needed.

### Vercel Serverless Limitation

SSE endpoint (`/api/stream`) uses short listen pattern for serverless compatibility. **Best practice:** Deploy to Railway or VPS for persistent SSE connections.

### Model Location

```
Data Modeling/artifacts/delay_model_twostage.joblib
```

### Delay Threshold

In `processing.py`: `DELAY_THRESHOLD_MINUTES = 15`
- Flights delayed ≥ 15 minutes get `label_delay = 1`
- Adjust this threshold based on business requirements

---

## 10. Coding Conventions

### File Naming
- Components: PascalCase (`FlightCard.tsx`)
- Hooks: camelCase with `use` prefix (`useSSE.ts`)
- Utilities: camelCase (`formatTime.ts`)
- Routes: kebab-case (`flight-key`)

### Type Imports
```typescript
import type { Flight } from '@/types/flight';
import { query } from '@/lib/db';
```

### Component Pattern
```typescript
'use client';  // Add for client-side interactivity

export function ComponentName() {
  return <div>...</div>;
}
```

### API Route Pattern
```typescript
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];

  const result = await query(
    'SELECT * FROM flights_current_snapshot WHERE flight_date = $1',
    [date]
  );

  return NextResponse.json({ data: result.rows });
}
```

---

## 11. Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional
NEXT_PUBLIC_API_URL=https://your-domain.com
```

---

## 12. Useful Commands

```bash
# Install dependencies
cd web && npm install

# Run development server
npm run dev

# Run database migration
psql $DATABASE_URL -f src/db/migrations/001_add_notify_trigger.sql

# Run Python scripts (from project root)
python src/processing.py
python src/inference.py

# Type check
npm run type-check

# Lint
npm run lint
```

---

*This file is auto-generated. Update when project structure or conventions change.*
