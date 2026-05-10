import { query } from '@/lib/db';
import type { Flight, FlightStatusHistory } from '@/types/flight';

export async function getFlightByKey(flightKey: string): Promise<Flight | null> {
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
    WHERE s.flight_key = $1
  `;
  const result = await query(sql, [flightKey]);
  return (result.rows[0] as unknown as Flight) ?? null;
}

export async function getFlightHistory(flightKey: string): Promise<FlightStatusHistory[]> {
  const parts = flightKey.split('|');
  const source = parts[0];
  const tableMap: Record<string, string> = { NB: 'flights_nb', DN: 'flights_dn', TSN: 'flights_tsn' };
  const table = tableMap[source];
  if (!table) return [];

  const flight_number = parts[2];

  const sql = `
    SELECT
      data_retrieved_at_vn::timestamptz AT TIME ZONE '+07:00' AS retrieved_at_vn,
      scheduled_time,
      estimated_time,
      status
    FROM ${table}
    WHERE flight_number = $1
    ORDER BY data_retrieved_at_vn ASC
  `;
  const result = await query(sql, [flight_number]);
  return result.rows as unknown as FlightStatusHistory[];
}
