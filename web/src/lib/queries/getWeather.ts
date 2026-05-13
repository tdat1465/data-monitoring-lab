import { query } from '@/lib/db';
import type { WeatherMETAR } from '@/types/weather';

export async function getLatestWeather(): Promise<WeatherMETAR[]> {
  const sql = `
    SELECT DISTINCT ON (icao_code)
      icao_code,
      report_time_vn::timestamptz AT TIME ZONE '+07:00' AS report_time_vn,
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
  return result.rows as unknown as WeatherMETAR[];
}

// Thêm vào src/lib/queries/getWeather.ts
// export async function getWeatherHistory(startDate?: string, endDate?: string): Promise<WeatherMETAR[]> {
//   const start = startDate || 'NOW() - INTERVAL \'7 days\'';
//   const end = endDate ? `'${endDate}'::timestamp` : 'NOW()';

//   const sql = `
//     SELECT
//       icao_code,
//       report_time_vn::timestamptz AS report_time_vn,
//       temperature_c,
//       dew_point_c,
//       wind_direction_deg,
//       wind_speed_kt,
//       visibility_miles,
//       cloud_cover,
//       raw_metar
//     FROM weather_metar
//     WHERE report_time_vn::timestamptz BETWEEN ${startDate ? `'${startDate}'::timestamp` : start} AND ${end}
//     ORDER BY report_time_vn ASC
//   `;
//   const result = await query(sql);
//   return result.rows as unknown as WeatherMETAR[];
// }

// src/lib/queries/getWeather.ts

// export async function getWeatherHistory(startDate?: string, endDate?: string): Promise<WeatherMETAR[]> {
//   // Gắn cụ thể 00:00:00+07:00 cho ngày bắt đầu và 23:59:59+07:00 cho ngày kết thúc
//   const startStr = startDate ? `'${startDate} 00:00:00+07:00'::timestamptz` : "NOW() - INTERVAL '7 days'";
//   const endStr = endDate ? `'${endDate} 23:59:59+07:00'::timestamptz` : "NOW()";

//   console.log(`Range: ${startDate} - ${endDate}`);
//   console.log(`Range: ${startStr} - ${endStr}`);

//   const sql = `
//     SELECT
//       icao_code,
//       report_time_vn::timestamptz AT TIME ZONE '+07:00' AS report_time_vn,
//       temperature_c,
//       dew_point_c,
//       wind_direction_deg,
//       wind_speed_kt,
//       visibility_miles,
//       cloud_cover,
//       raw_metar
//     FROM weather_metar
//     WHERE report_time_vn AT TIME ZONE 'Asia/Ho_Chi_Minh' 
//       BETWEEN ${startStr} AND ${endStr}
//     ORDER BY report_time_vn ASC
//   `;
//   const result = await query(sql);
//   return result.rows as unknown as WeatherMETAR[];
// }


export async function getWeatherHistory(startDate?: string, endDate?: string): Promise<WeatherMETAR[]> {
  const startStr = startDate ? `'${startDate}'` : "(NOW() - INTERVAL '7 days')::date::text";
  const endStr = endDate ? `'${endDate}'` : "NOW()::date::text";

  console.log(`Range: ${startDate} - ${endDate}`);

  const sql = `
    SELECT
      icao_code,
      report_time_vn,
      temperature_c,
      dew_point_c,
      wind_direction_deg,
      wind_speed_kt,
      visibility_miles,
      cloud_cover,
      raw_metar
    FROM weather_metar
    WHERE DATE(report_time_vn) BETWEEN ${startStr}::date AND ${endStr}::date
    ORDER BY report_time_vn ASC
  `;
  const result = await query(sql);
  return result.rows as unknown as WeatherMETAR[];
}
