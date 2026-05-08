export interface Flight {
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

export interface FlightWithPrediction extends Flight {
  history?: FlightStatusHistory[];
}

export interface FlightStatusHistory {
  retrieved_at_vn: string;
  scheduled_time: string;
  estimated_time: string | null;
  status: string;
}

export interface FlightsApiResponse {
  data: Flight[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    last_updated: string | null;
  };
}
