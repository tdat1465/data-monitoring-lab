import { query } from '@/lib/db';
import type { Flight } from '@/types/flight';

const AIRPORT_NAME: Record<string, string> = {
  NB: 'Nội Bài',
  DN: 'Đà Nẵng',
  TSN: 'Tân Sơn Nhất',
};

export function getAirportName(code: string): string {
  return AIRPORT_NAME[code] ?? code;
}

export async function getFlightsWithPredictions(date?: string): Promise<Flight[]> {
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const sql = `
    SELECT
      s.flight_key,
      s.flight_number,
      s.source_airport,
      s.direction,
      s.route_airport_std,
      s.scheduled_dt::timestamptz AT TIME ZONE '+07:00' AS scheduled_dt,
      s.estimated_dt::timestamptz AT TIME ZONE '+07:00' AS estimated_dt,
      s.status_raw,
      s.status_group,
      s.temperature_c,
      s.visibility_miles,
      s.wind_speed_kt,
      s.cloud_cover,
      s.delay_minutes,
      s.label_delay,
      p.predict_delay_minutes,
      p.predicted_at
    FROM flights_current_snapshot s
    LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
    WHERE s.flight_date = $1
    ORDER BY s.source_airport, s.direction, s.scheduled_dt ASC
  `;

  const result = await query(sql, [targetDate]);
  return result.rows as unknown as Flight[];
}

export async function getFlightsByHistory(days: number = 7): Promise<Flight[]> {
  const sql = `
    SELECT
      s.flight_key,
      s.flight_number,
      s.source_airport,
      s.direction,
      s.route_airport_std,
      s.scheduled_dt::timestamptz AT TIME ZONE '+07:00' AS scheduled_dt,
      s.estimated_dt::timestamptz AT TIME ZONE '+07:00' AS estimated_dt,
      s.status_raw,
      s.status_group,
      s.temperature_c,
      s.visibility_miles,
      s.wind_speed_kt,
      s.cloud_cover,
      s.delay_minutes,
      s.label_delay,
      p.predict_delay_minutes,
      p.predicted_at
    FROM flights_current_snapshot s
    LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
    WHERE s.flight_date >= CURRENT_DATE - INTERVAL '${days} days'
    ORDER BY s.flight_date DESC, s.source_airport, s.scheduled_dt ASC
  `;

  const result = await query(sql);
  return result.rows as unknown as Flight[];
}
