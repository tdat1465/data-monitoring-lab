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

function getTodayInVietnam() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

function toVietnamDate(date: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(`${date}T00:00:00+07:00`));
}

export async function getFlightsWithPredictions(date?: string): Promise<Flight[]> {
  const targetDate = date ? toVietnamDate(date) : getTodayInVietnam();
  console.log('[getFlightsWithPredictions] input date:', date, 'targetDate:', targetDate);
  const sql = `
    SELECT * FROM (
      SELECT DISTINCT ON (s.flight_number, s.flight_date)
        s.flight_key,
        s.flight_number,
        s.source_airport,
        s.direction,
        s.route_airport_std,
        s.scheduled_dt,
        substring(s.scheduled_dt from 12 for 2)::int AS scheduled_hour,
        s.estimated_dt,
        s.status_raw,
        s.status_group,
        s.temperature_c,
        s.visibility_miles,
        s.wind_speed_kt,
        s.cloud_cover,
        s.delay_minutes,
        s.label_delay,
        COALESCE(p.predict_delay_minutes, NULL) AS predict_delay_minutes
      FROM flights_current_snapshot s
      LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
      WHERE s.flight_date = $1
      ORDER BY s.flight_number, s.flight_date, substring(s.scheduled_dt from 12 for 2)::int DESC
    ) sub
    ORDER BY scheduled_hour DESC
  `;

  const result = await query(sql, [targetDate]);
  console.log('[getFlightsWithPredictions] row count:', result.rows.length);
  return result.rows as unknown as Flight[];
}

// Get all historical flight data (no date limit)
export async function getAllFlights(): Promise<Flight[]> {
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
      COALESCE(p.predict_delay_minutes, NULL) AS predict_delay_minutes
    FROM flights_current_snapshot s
    LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
    ORDER BY s.flight_date DESC, s.source_airport, s.scheduled_dt ASC
  `;

  const result = await query(sql);
  return result.rows as unknown as Flight[];
}

export async function getFlightsByDateRange(startDate: string, endDate: string): Promise<Flight[]> {
  const targetStartDate = toVietnamDate(startDate);
  const targetEndDate = toVietnamDate(endDate);

  const sql = `
    SELECT * FROM (
      SELECT DISTINCT ON (substring(s.scheduled_dt from 1 for 10), s.flight_number)
        s.flight_key,
        s.flight_number,
        s.source_airport,
        s.direction,
        s.route_airport_std,
        s.scheduled_dt,
        substring(s.scheduled_dt from 1 for 10) AS scheduled_date,
        substring(s.scheduled_dt from 12 for 2)::int AS scheduled_hour,
        s.estimated_dt,
        s.status_raw,
        s.status_group,
        s.temperature_c,
        s.visibility_miles,
        s.wind_speed_kt,
        s.cloud_cover,
        s.delay_minutes,
        s.label_delay,
        COALESCE(p.predict_delay_minutes, NULL) AS predict_delay_minutes
      FROM flights_current_snapshot s
      LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
      WHERE s.flight_date >= $1
        AND s.flight_date <= $2
      ORDER BY substring(s.scheduled_dt from 1 for 10), s.flight_number, substring(s.scheduled_dt from 12 for 2)::int DESC
    ) sub
    ORDER BY scheduled_date ASC, scheduled_hour DESC
  `;

  const result = await query(sql, [targetStartDate, targetEndDate]);
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
      s.scheduled_dt,
      substring(s.scheduled_dt from 12 for 2)::int AS scheduled_hour,
      s.estimated_dt,
      s.status_raw,
      s.status_group,
      s.temperature_c,
      s.visibility_miles,
      s.wind_speed_kt,
      s.cloud_cover,
      s.delay_minutes,
      s.label_delay,
      COALESCE(p.predict_delay_minutes, NULL) AS predict_delay_minutes
    FROM flights_current_snapshot s
    LEFT JOIN flights_predictions p ON s.flight_key = p.flight_key
    WHERE s.flight_date >= CURRENT_DATE - INTERVAL '${days} days'
    ORDER BY s.flight_date DESC, s.source_airport, s.scheduled_dt ASC
  `;

  const result = await query(sql);
  return result.rows as unknown as Flight[];
}
