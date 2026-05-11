'use client';

import { useState, useMemo } from 'react';
import { DateFilterBar } from './DateFilterBar';
import { OverviewKPICards } from './overview_charts/OverviewKPICards';
import { PredictedRiskLineChart } from './overview_charts/PredictedRiskLineChart';
import { AirlineEfficiencyTreemap } from './overview_charts/AirlineEfficiencyTreemap';
import { FlightRadarClock } from './overview_charts/FlightRadarClock';
import { AirportRadarChart } from './overview_charts/AirportRadarChart';
import { TemperatureHeatmap } from './overview_charts/TemperatureHeatmap';
import { VisibilityBoxPlot } from './overview_charts/VisibilityBoxPlot';
import { CloudCoverChart } from './overview_charts/CloudCoverChart';

import type { Flight } from '@/types/flight';
import type { WeatherMETAR } from '@/types/weather';



export function OverviewTab({ 
  flights, 
  rawWeatherHistory,
  onDateFilter,
  initialDateRange,
 }: { 
  flights: Flight[], 
  rawWeatherHistory: WeatherMETAR[], 
  onDateFilter: any, 
  initialDateRange : any 
}) {

  const getInitialDates = () => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return { start: formatDate(sevenDaysAgo), end: formatDate(today) };
  };

  const defaultDates = initialDateRange || getInitialDates();
  const [inputDateRange, setInputDateRange] = useState(defaultDates);
  const [appliedDateRange, setAppliedDateRange] = useState(defaultDates);
  const [resolution, setResolution] = useState<'raw' | '30m' | '1h' | '1d'>('raw');
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    if (!rawWeatherHistory || rawWeatherHistory.length === 0) return [];
    
    return rawWeatherHistory.filter((row: any) => {
      if (!appliedDateRange.start || !appliedDateRange.end) return true;

      const reportTime = new Date(row.report_time_vn).getTime();
      // So sánh với ICT boundary: 3/5 00:00 ICT = 2/5 17:00 UTC
      const startTime = new Date(`${appliedDateRange.start}T00:00:00+07:00`).getTime();
      const endTime   = new Date(`${appliedDateRange.end}T23:59:59.999+07:00`).getTime();

      return reportTime >= startTime && reportTime <= endTime;
    });
  }, [rawWeatherHistory, appliedDateRange]);

  if (!rawWeatherHistory || rawWeatherHistory.length === 0) {
    return <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl">Đang tải dữ liệu thời tiết...</div>;
  }

  const handleClearFilter = () => {
    const defaultRange = getInitialDates();
    setInputDateRange(defaultRange);
    setAppliedDateRange(defaultRange);
    setResolution('raw');
    setSelectedAirport(null);
    if (onDateFilter) {
      onDateFilter(defaultRange);
    }
  };

  const handleApplyFilter = () => {
    setAppliedDateRange(inputDateRange);
    if (onDateFilter) {
      onDateFilter(inputDateRange);
    }
  };

  const handleToday = () => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const todayStr = formatDate(today);
    const todayRange = { start: todayStr, end: todayStr };
    setInputDateRange(todayRange);
    setAppliedDateRange(todayRange);
    if (onDateFilter) {
      onDateFilter(todayRange);
    }
  };
  
  if (!rawWeatherHistory || rawWeatherHistory.length === 0) {
    return <div className="p-8 text-center text-gray-500">Đang chuẩn bị dữ liệu tổng quan...</div>;
  }

  const getDelayFlag = (flight: Flight) => Number(flight.label_delay ?? 0) === 1;
  const getFlightDate = (scheduledDt: string | Date | null | undefined) => {
    if (!scheduledDt) return '';

    if (typeof scheduledDt === 'string') {
      const match = scheduledDt.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }

    const date = scheduledDt instanceof Date ? scheduledDt : new Date(scheduledDt);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : '';
  };
  // --- Compute flight + ML + weather KPIs ---
  const flightsInRange = flights.filter(f => {
    if (!appliedDateRange.start || !appliedDateRange.end) return !selectedAirport || f.source_airport === selectedAirport;

    const flightDate = getFlightDate(f.scheduled_dt);
    if (!flightDate) return false;

    const dateMatch = flightDate >= appliedDateRange.start && flightDate <= appliedDateRange.end;
    const airportMatch = !selectedAirport || f.source_airport === selectedAirport;
    return dateMatch && airportMatch;
  });

  const totalFlights = flightsInRange.length;
  const delayedCount = flightsInRange.filter(getDelayFlag).length;
  const delayRate = totalFlights ? (delayedCount / totalFlights) * 100 : 0;

  // Weather KPIs from filteredData
  const avgVisibility = filteredData.length ? (filteredData.reduce((s:any,r:any)=> s + (Number(r.visibility_miles)||0),0) / filteredData.length) : null;
  const avgWind = filteredData.length ? (filteredData.reduce((s:any,r:any)=> s + (Number(r.wind_speed_kt)||0),0) / filteredData.length) : null;

  // ML predictions for next 12 hours
  const now = new Date();
  // Use date from applied filter but time from current moment (hour/min/sec)
  const baseDate = appliedDateRange && appliedDateRange.end ? new Date(appliedDateRange.end) : new Date();
  baseDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  const twelveHoursLater = new Date(baseDate.getTime() + 12 * 60 * 60 * 1000);

  // Build a flight set specifically for the 12-hour prediction window so
  // predictions are shown even if they cross day boundaries
  const flightsFor12hPrediction = flights.filter(f => {
    if (f.predict_delay_minutes == null) return false;
    if (!f.scheduled_dt) return false;
    const t = new Date(f.scheduled_dt).getTime();
    return t >= baseDate.getTime() && t <= twelveHoursLater.getTime();
  });

  const airports = ['NB','DN','TSN'];
  const getAirlineCode = (flight: Flight) => {
    return flight.airline_code ?? (flight.flight_number ? String(flight.flight_number).match(/^([A-Z0-9]{2})/)?.[0] ?? 'UNK' : 'UNK');
  };

  // build 15-min buckets for the next 12 hours (date from filter, time from now)
  const intervalMins = 15;
  const intervals: string[] = [];
  for (let t = new Date(baseDate.getTime()); t <= twelveHoursLater; t = new Date(t.getTime() + intervalMins * 60 * 1000)) {
    intervals.push(new Date(t).toISOString());
  }

  // prepare series per airport
  const seriesByAirport: Record<string, Array<{ time: string; avgPredicted: number }>> = {
    NB: [], DN: [], TSN: []
  };

  intervals.forEach((iso) => {
    const start = new Date(iso);
    const end = new Date(start.getTime() + intervalMins * 60 * 1000);
    airports.forEach((ap) => {
      const items = flightsFor12hPrediction.filter(f => f.source_airport === ap && f.scheduled_dt && new Date(f.scheduled_dt) >= start && new Date(f.scheduled_dt) < end);
      const avg = items.length ? items.reduce((s, x) => s + (Number(x.predict_delay_minutes)||0),0) / items.length : 0;
      seriesByAirport[ap].push({ time: start.toISOString(), avgPredicted: Number(avg.toFixed(2)) });
    });
  });

  // Airline treemap data
  const airlineAgg: Record<string, { flights: number; delayed: number }> = {};
  flightsInRange.forEach((f) => {
    const a = getAirlineCode(f);
    airlineAgg[a] = airlineAgg[a] || { flights: 0, delayed: 0 };
    airlineAgg[a].flights += 1;
    if (getDelayFlag(f)) airlineAgg[a].delayed += 1;
  });

  const treemapNodes = Object.entries(airlineAgg).map(([k,v]) => ({
    name: k,
    size: v.flights,
    delayRate: v.flights ? (v.delayed / v.flights) : 0
  })).sort((a,b)=> b.size - a.size);

  // airport -> airline aggregation for nested treemap
  const airportAirlineAgg: Record<string, Record<string, { flights: number; delayed: number }>> = {};
  flightsInRange.forEach((f) => {
    const ap = f.source_airport ?? 'UNK';
    const a = getAirlineCode(f);
    airportAirlineAgg[ap] = airportAirlineAgg[ap] || {};
    airportAirlineAgg[ap][a] = airportAirlineAgg[ap][a] || { flights: 0, delayed: 0 };
    airportAirlineAgg[ap][a].flights += 1;
    if (getDelayFlag(f)) airportAirlineAgg[ap][a].delayed += 1;
  });

  // Radar clock: counts of delayed flights per hour
  const radarHours = Array.from({ length: 24 }, (_,i)=> ({ hour: i, count: 0 }));
  flightsInRange.forEach((f) => {
    if (getDelayFlag(f) && f.scheduled_dt) {
      const h = new Date(f.scheduled_dt).getHours();
      radarHours[h].count += 1;
    }
  });

  // ML average risk across all airports and intervals
  const allPreds: number[] = [];
  Object.values(seriesByAirport).forEach(arr => arr.forEach(x => allPreds.push(x.avgPredicted)));
  const mlAvg = allPreds.length ? (allPreds.reduce((s,n)=>s+n,0) / allPreds.length) : 0;

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

      {/* KPIs */}
      <div>
        <OverviewKPICards totalFlights={totalFlights} delayRate={delayRate} mlAvg={mlAvg} avgVisibility={avgVisibility} avgWind={avgWind} />
      </div>

      {/* Predicted risk + Radar clock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PredictedRiskLineChart seriesByAirport={seriesByAirport} />
        </div>
        <div className="lg:col-span-1">
          <FlightRadarClock hours={radarHours} />
        </div>
      </div>

      {/* Airline treemap full width */}
      <div>
        <AirlineEfficiencyTreemap nodes={treemapNodes} byAirport={airportAirlineAgg} />
      </div>

      {/* GRID BIỂU ĐỒ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="w-full">
          <CloudCoverChart rawWeatherHistory={filteredData} filteredFlights={flightsInRange} selectedAirport={selectedAirport}/>
        </div>
        <div className="w-full">
          <TemperatureHeatmap rawWeatherHistory={filteredData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AirportRadarChart rawWeatherHistory={filteredData} selectedAirport={selectedAirport} />
        <VisibilityBoxPlot rawWeatherHistory={filteredData} />
      </div>
    </div>
  );
}