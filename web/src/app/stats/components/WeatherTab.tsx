'use client';

import { useMemo, useState } from 'react';
import type { Flight } from '@/types/flight';
import type { WeatherMETAR } from '@/types/weather';
import { extractRainFromMetar } from '@/lib/utils';
import { DateFilterBar } from './DateFilterBar';
import { AirportComparisonChart } from './weather_charts/AirportComparisonChart';
import { PressureHumidityChart } from './weather_charts/PressureHumidityChart';
import { RainDelayImpactChart } from './weather_charts/RainDelayImpactChart';
import { RainTimeSeriesChart } from './weather_charts/RainTimeSeriesChart';
import { TempDelayCorrelationChart } from './weather_charts/TempDelayCorrelationChart';
import { VisibilityChart } from './weather_charts/VisibilityChart';
import { WeatherTimeSeriesChart } from './weather_charts/WeatherTimeSeriesChart';
import { WindRoseChart } from './weather_charts/WindRoseChart';

type DateRange = {
  start: string;
  end: string;
};

type Resolution = 'raw' | '30m' | '1h' | '1d';

type ProcessedWeatherRow = {
  report_time_vn: string;
  temperature_c: number | null;
  dew_point_c: number | null;
  wind_speed_kt: number | null;
  visibility_miles: number | null;
  humidity: number | null;
  pressure_qnh: number | null;
  VVNB: number | null;
  VVDN: number | null;
  VVTS: number | null;
  Delay_NB: number;
  Delay_DN: number;
  Delay_TSN: number;
  Delay_all: number;
  Flight_NB: number;
  Flight_DN: number;
  Flight_TSN: number;
  Flight_all: number;
  Delayed_NB: number;
  Delayed_DN: number;
  Delayed_TSN: number;
  Delayed_all: number;
  Rain_NB: number;
  Rain_DN: number;
  Rain_TSN: number;
  Rain_all: number;
  RainRate_NB: number;
  RainRate_DN: number;
  RainRate_TSN: number;
  RainRate_all: number;
  RainIntensity_NB: number;
  RainIntensity_DN: number;
  RainIntensity_TSN: number;
  RainIntensity_all: number;
};

type WeatherTabProps = {
  flights?: Flight[];
  rawWeatherHistory?: WeatherMETAR[];
  onDateFilter?: (range: DateRange) => void;
  initialDateRange?: DateRange;
};

const AIRPORT_ICAO_MAP: Record<string, string> = {
  NB: 'VVNB',
  DN: 'VVDN',
  TSN: 'VVTS',
};

function getVietnamDateRange() {
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return { start: formatDate(sevenDaysAgo), end: formatDate(today) };
}

function isWithinDateRange(dateValue: string | null | undefined, range: DateRange) {
  if (!range.start || !range.end || !dateValue) return true;

  const timestamp = new Date(dateValue).getTime();
  const startTime = new Date(`${range.start}T00:00:00+07:00`).getTime();
  const endTime = new Date(`${range.end}T23:59:59.999+07:00`).getTime();

  return timestamp >= startTime && timestamp <= endTime;
}

function bucketDate(dateValue: string, resolution: Resolution) {
  const date = new Date(dateValue);
  const bucketResolution = resolution === 'raw' ? '30m' : resolution;

  if (bucketResolution === '30m') {
    date.setUTCMinutes(date.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
  } else if (bucketResolution === '1h') {
    date.setUTCMinutes(0, 0, 0);
  } else if (bucketResolution === '1d') {
    date.setUTCHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

function isDelayedFlight(flight: Flight) {
  if (Number(flight.label_delay ?? 0) === 1) return true;
  const delayMinutes = Number(flight.delay_minutes);
  return !isNaN(delayMinutes) && delayMinutes >= 15;
}

function average(items: WeatherMETAR[], prop: keyof WeatherMETAR) {
  const values = items.map((item) => Number(item[prop])).filter((value) => !isNaN(value));
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function averageByStation(items: WeatherMETAR[], prop: keyof WeatherMETAR, icaoCode: string) {
  return average(items.filter((item) => item.icao_code === icaoCode), prop);
}

function qnhAverage(items: WeatherMETAR[]) {
  const qnhs = items
    .map((item) => {
      const match = String(item.raw_metar ?? '').match(/Q(\d{4})/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value !== null);

  if (qnhs.length === 0) return null;
  return Number((qnhs.reduce((sum, value) => sum + value, 0) / qnhs.length).toFixed(0));
}

function rainStats(items: WeatherMETAR[]) {
  if (items.length === 0) {
    return { rainCount: 0, rainRate: 0, rainIntensity: 0 };
  }

  const rainInfos = items.map((item) => extractRainFromMetar(item.raw_metar));
  const rainCount = rainInfos.filter((info) => info.hasRain).length;
  const rainIntensity = rainInfos.reduce((sum, info) => sum + info.intensity, 0) / items.length;

  return {
    rainCount,
    rainRate: Number(((rainCount / items.length) * 100).toFixed(1)),
    rainIntensity: Number(rainIntensity.toFixed(2)),
  };
}

function delayRate(flights: Flight[]) {
  if (flights.length === 0) return 0;
  const delayed = flights.filter(isDelayedFlight).length;
  return Number(((delayed / flights.length) * 100).toFixed(1));
}

export function WeatherTab({
  flights = [],
  rawWeatherHistory = [],
  onDateFilter,
  initialDateRange,
}: WeatherTabProps) {
  const defaultDates = initialDateRange || getVietnamDateRange();
  const [inputDateRange, setInputDateRange] = useState<DateRange>(defaultDates);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange>(defaultDates);
  const [resolution, setResolution] = useState<Resolution>('raw');
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    if (rawWeatherHistory.length === 0) return [];

    return rawWeatherHistory.filter((row) => {
      if (!isWithinDateRange(row.report_time_vn, appliedDateRange)) return false;
      if (selectedAirport && row.icao_code !== AIRPORT_ICAO_MAP[selectedAirport]) return false;
      return true;
    });
  }, [rawWeatherHistory, appliedDateRange, selectedAirport]);

  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      if (!isWithinDateRange(flight.scheduled_dt, appliedDateRange)) return false;
      if (selectedAirport && flight.source_airport !== selectedAirport) return false;
      return true;
    });
  }, [flights, appliedDateRange, selectedAirport]);

  const processedData = useMemo<ProcessedWeatherRow[]>(() => {
    if (rawWeatherHistory.length === 0) return [];

    const filteredWeather = rawWeatherHistory.filter((row) => {
      if (!isWithinDateRange(row.report_time_vn, appliedDateRange)) return false;
      if (selectedAirport && row.icao_code !== AIRPORT_ICAO_MAP[selectedAirport]) return false;
      return true;
    });

    const weatherBuckets: Record<string, WeatherMETAR[]> = {};
    const flightBuckets: Record<string, Flight[]> = {};

    filteredWeather.forEach((row) => {
      const key = bucketDate(row.report_time_vn, resolution);
      weatherBuckets[key] ||= [];
      weatherBuckets[key].push(row);
    });

    filteredFlights.forEach((flight) => {
      if (!flight.scheduled_dt) return;
      const key = bucketDate(flight.scheduled_dt, resolution);
      flightBuckets[key] ||= [];
      flightBuckets[key].push(flight);
    });

    return Object.keys(weatherBuckets).sort().map((key) => {
      const weatherGroup = weatherBuckets[key];
      const flightGroup = flightBuckets[key] || [];

      const flightsNB = flightGroup.filter((flight) => flight.source_airport === 'NB');
      const flightsDN = flightGroup.filter((flight) => flight.source_airport === 'DN');
      const flightsTSN = flightGroup.filter((flight) => flight.source_airport === 'TSN');

      const rainNB = rainStats(weatherGroup.filter((item) => item.icao_code === 'VVNB'));
      const rainDN = rainStats(weatherGroup.filter((item) => item.icao_code === 'VVDN'));
      const rainTSN = rainStats(weatherGroup.filter((item) => item.icao_code === 'VVTS'));
      const rainAll = rainStats(weatherGroup);

      const temp = average(weatherGroup, 'temperature_c');
      const dew = average(weatherGroup, 'dew_point_c');
      const humidity = temp !== null && dew !== null
        ? Math.max(0, Math.min(100, 100 - 5 * (temp - dew)))
        : null;

      return {
        report_time_vn: key,
        temperature_c: temp,
        dew_point_c: dew,
        wind_speed_kt: average(weatherGroup, 'wind_speed_kt'),
        visibility_miles: average(weatherGroup, 'visibility_miles'),
        humidity: humidity !== null ? Number(humidity.toFixed(1)) : null,
        pressure_qnh: qnhAverage(weatherGroup),

        VVNB: averageByStation(weatherGroup, 'temperature_c', 'VVNB'),
        VVDN: averageByStation(weatherGroup, 'temperature_c', 'VVDN'),
        VVTS: averageByStation(weatherGroup, 'temperature_c', 'VVTS'),

        Delay_NB: delayRate(flightsNB),
        Delay_DN: delayRate(flightsDN),
        Delay_TSN: delayRate(flightsTSN),
        Delay_all: delayRate(flightGroup),

        Flight_NB: flightsNB.length,
        Flight_DN: flightsDN.length,
        Flight_TSN: flightsTSN.length,
        Flight_all: flightGroup.length,
        Delayed_NB: flightsNB.filter(isDelayedFlight).length,
        Delayed_DN: flightsDN.filter(isDelayedFlight).length,
        Delayed_TSN: flightsTSN.filter(isDelayedFlight).length,
        Delayed_all: flightGroup.filter(isDelayedFlight).length,

        Rain_NB: rainNB.rainCount,
        Rain_DN: rainDN.rainCount,
        Rain_TSN: rainTSN.rainCount,
        Rain_all: rainAll.rainCount,
        RainRate_NB: rainNB.rainRate,
        RainRate_DN: rainDN.rainRate,
        RainRate_TSN: rainTSN.rainRate,
        RainRate_all: rainAll.rainRate,
        RainIntensity_NB: rainNB.rainIntensity,
        RainIntensity_DN: rainDN.rainIntensity,
        RainIntensity_TSN: rainTSN.rainIntensity,
        RainIntensity_all: rainAll.rainIntensity,
      };
    });
  }, [rawWeatherHistory, filteredFlights, appliedDateRange, resolution, selectedAirport]);

  const handleToday = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayRange = { start: todayStr, end: todayStr };
    setInputDateRange(todayRange);
    setAppliedDateRange(todayRange);
    onDateFilter?.(todayRange);
  };

  const handleClearFilter = () => {
    const defaultRange = getVietnamDateRange();
    setInputDateRange(defaultRange);
    setAppliedDateRange(defaultRange);
    setResolution('raw');
    setSelectedAirport(null);
    onDateFilter?.(defaultRange);
  };

  const handleApplyFilter = () => {
    setAppliedDateRange(inputDateRange);
    onDateFilter?.(inputDateRange);
  };

  if (rawWeatherHistory.length === 0) {
    return (
      <div className="space-y-6">
        <DateFilterBar
          inputDateRange={inputDateRange}
          setInputDateRange={setInputDateRange}
          resolution={resolution}
          setResolution={setResolution}
          onApply={handleApplyFilter}
          onClear={handleClearFilter}
          onToday={handleToday}
          selectedAirport={selectedAirport}
          onAirportChange={setSelectedAirport}
        />
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl">Đang tải dữ liệu thời tiết...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DateFilterBar
        inputDateRange={inputDateRange}
        setInputDateRange={setInputDateRange}
        resolution={resolution}
        setResolution={setResolution}
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        onToday={handleToday}
        selectedAirport={selectedAirport}
        onAirportChange={setSelectedAirport}
      />

      <div className="w-full">
        <WeatherTimeSeriesChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RainTimeSeriesChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
        <RainDelayImpactChart flights={filteredFlights} selectedAirport={selectedAirport} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TempDelayCorrelationChart rawWeatherHistory={processedData} dateRange={appliedDateRange} resolution={resolution} />
        <VisibilityChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="w-full">
          <WindRoseChart rawWeatherHistory={filteredData} flights={flights} selectedAirport={selectedAirport} />
        </div>
        <div className="lg:col-span-2 w-full">
          <PressureHumidityChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
        </div>
      </div>

      <div className="w-full">
        <AirportComparisonChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
      </div>
    </div>
  );
}
