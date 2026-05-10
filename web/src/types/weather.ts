export interface WeatherMETAR {
  icao_code: string;
  report_time_vn: string;
  temperature_c: number | null;
  dew_point_c: number | null;
  wind_direction_deg: number | null;
  wind_speed_kt: number | null;
  visibility_miles: number | null;
  cloud_cover: string | null;
  raw_metar: string;
}

export interface WeatherApiResponse {
  data: WeatherMETAR[];
  meta: {
    count: number;
    last_updated: string | null;
  };
}
