"use client";

import React, { useMemo, useState } from 'react';
import type { Flight } from '@/types/flight';
import {
  FlightStatusDonutChart,
} from './flight_charts/FlightStatusDonutChart';
import { AirlineDelayBarChart } from './flight_charts/AirlineDelayBarChart';
import { AirportHourlyStackedBarChart } from './flight_charts/AirportHourlyStackedBarChart';
import { HourlyDelayHeatmap } from './flight_charts/HourlyDelayHeatmap';
import { DelayMinuteTreemap } from './flight_charts/DelayMinuteTreemap';
import { RoutePerformanceTable } from './flight_charts/RoutePerformanceTable';

type DateRange = { start?: string; end?: string };

export function FlightTab({ rawFlightData = [], flights }: { rawFlightData?: Flight[]; flights?: Flight[] }) {
  const dataSource = flights ?? rawFlightData;

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

  const [inputDateRange, setInputDateRange] = useState<DateRange>(getInitialDates);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange>(getInitialDates);
  const [selectedAirport, setSelectedAirport] = useState<'ALL' | 'NB' | 'DN' | 'TSN'>('ALL');



  // Normalize input records (parse dates, cast numbers, extract airline_code/hour)
  const normalized = useMemo(() => {
    if (!dataSource || dataSource.length === 0) return [] as any[];
    return dataSource.map((r: any) => {
      // scheduled_dt: try to coerce to ISO date string
      let scheduledDtIso = '';
      let scheduledHour: number | null = null;
      try {
        if (typeof r.scheduled_dt === 'string') {
          const dt = new Date(r.scheduled_dt);
          if (!isNaN(dt.getTime())) {
            scheduledDtIso = dt.toISOString();
            scheduledHour = dt.getHours();
          } else {
            // maybe it's date-only like YYYY-MM-DD
            const s = r.scheduled_dt.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
              scheduledDtIso = s + 'T00:00:00.000Z';
              scheduledHour = 0;
            }
          }
        } else if (r.scheduled_dt instanceof Date) {
          scheduledDtIso = r.scheduled_dt.toISOString();
          scheduledHour = r.scheduled_dt.getHours();
        } else if (typeof r.scheduled_dt === 'number') {
          const dt = new Date(r.scheduled_dt);
          if (!isNaN(dt.getTime())) {
            scheduledDtIso = dt.toISOString();
            scheduledHour = dt.getHours();
          }
        }
      } catch (e) {
        scheduledDtIso = '';
      }

      const airline = r.airline_code ?? (r.flight_number ? String(r.flight_number).match(/^([A-Z0-9]{2})/)?.[0] ?? 'UNK' : 'UNK');

      const delayMinutes = r.delay_minutes == null ? null : Number(r.delay_minutes);
      const label = r.label_delay == null ? null : Number(r.label_delay);

      const temperature_c = r.temperature_c == null ? null : Number(r.temperature_c);
      const visibility_miles = r.visibility_miles == null ? null : Number(r.visibility_miles);

      return {
        ...r,
        scheduled_dt_iso: scheduledDtIso,
        scheduled_hour: scheduledHour,
        airline_code: airline,
        delay_minutes: delayMinutes != null && !isNaN(delayMinutes) ? delayMinutes : null,
        label_delay: label != null && !isNaN(label) ? label : null,
        temperature_c,
        visibility_miles,
      };
    });
  }, [dataSource]);

  const filteredNormalized = useMemo(() => {
    if (!normalized || normalized.length === 0) return [] as any[];
    return normalized.filter((r) => {
      if (selectedAirport !== 'ALL' && r.source_airport !== selectedAirport) return false;
      if (appliedDateRange.start || appliedDateRange.end) {
        const d = r.scheduled_dt_iso ? r.scheduled_dt_iso.slice(0, 10) : '';
        if (d === '') return false;
        if (appliedDateRange.start && d < appliedDateRange.start) return false;
        if (appliedDateRange.end && d > appliedDateRange.end) return false;
      }
      return true;
    });
  }, [normalized, selectedAirport, appliedDateRange]);

  const processedData = useMemo(() => {
    const total = filteredNormalized.length;
    const delayedCount = filteredNormalized.filter((r) => (r.label_delay ?? 0) === 1).length;
    const delayRate = total ? (delayedCount / total) * 100 : 0;
    const delayRecords = filteredNormalized.filter((r) => typeof r.delay_minutes === 'number' && r.delay_minutes != null) as any[];
    const avgDelay = delayRecords.length > 0 ? delayRecords.reduce((s, r) => s + r.delay_minutes, 0) / delayRecords.length : 0;
    
    // Debug: Check data quality
    if (total > 0) {
      console.log(`[FlightTab Debug] Total: ${total}, DelayRecords: ${delayRecords.length}, AvgDelay: ${avgDelay.toFixed(2)}`);
      if (delayRecords.length > 0) {
        console.log(`[FlightTab Debug] Sample delay values:`, delayRecords.slice(0, 5).map(r => r.delay_minutes));
      } else {
        console.log(`[FlightTab Debug] NO valid delay records! Sample raw values:`, filteredNormalized.slice(0, 3).map(r => ({ delay_minutes: r.delay_minutes, type: typeof r.delay_minutes })));
      }
    }

    const statusDist = filteredNormalized.reduce<Record<string, number>>((acc, r) => {
      const k = r.status_group || 'other';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    const airlineAgg: Record<string, { flights: number; delayed: number }> = {};
    filteredNormalized.forEach((r) => {
      const a = r.airline_code ?? 'UNK';
      airlineAgg[a] = airlineAgg[a] || { flights: 0, delayed: 0 };
      airlineAgg[a].flights += 1;
      if ((r.label_delay ?? 0) === 1) airlineAgg[a].delayed += 1;
    });
    const airlinePerf = Object.entries(airlineAgg)
      .map(([k, v]) => ({ airline: k, delayRate: (v.delayed / v.flights) * 100, flights: v.flights }))
      .sort((a, b) => b.delayRate - a.delayRate);

    const hourly: Record<number, number> = {};
    const hourlyByDay: Record<string, Record<number, number>> = {
      'Mon': {}, 'Tue': {}, 'Wed': {}, 'Thu': {}, 'Fri': {}, 'Sat': {}, 'Sun': {}
    };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    filteredNormalized.forEach((r) => {
      let h = 0;
      let dayName = 'Sun';
      if (typeof r.scheduled_hour === 'number') h = r.scheduled_hour;
      if (r.scheduled_dt_iso) {
        const dt = new Date(r.scheduled_dt_iso);
        if (!isNaN(dt.getTime())) {
          h = dt.getHours();
          dayName = dayNames[dt.getUTCDay()];
        }
      }
      if ((r.label_delay ?? 0) === 1) {
        hourly[h] = (hourly[h] || 0) + 1;
        hourlyByDay[dayName][h] = (hourlyByDay[dayName][h] || 0) + 1;
      }
    });
    const hourlyHeat = Array.from({ length: 24 }, (_, i) => ({ hour: i, delayed: hourly[i] || 0 }));
    
    // Convert to 2D array for heatmap (days x hours)
    const heatmapData = Object.entries(hourlyByDay).map(([day, hours]) => ({
      day,
      ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(i).padStart(2, '0'), hours[i] || 0]))
    }));

    const minuteDelayCounts: Record<string, number> = {};
    filteredNormalized.forEach((r) => {
      const m = Number(r.delay_minutes);
      if (isNaN(m)) return;
      const minute = Math.round(m);
      if (minute <= 0) return;
      const key = String(minute);
      minuteDelayCounts[key] = (minuteDelayCounts[key] || 0) + 1;
    });

    const routeAgg: Record<string, { flights: number; delayed: number }> = {};
    filteredNormalized.forEach((r) => {
      const route = r.route_airport_std || 'UNK';
      routeAgg[route] = routeAgg[route] || { flights: 0, delayed: 0 };
      routeAgg[route].flights += 1;
      if ((r.label_delay ?? 0) === 1) routeAgg[route].delayed += 1;
    });
    const routePerf = Object.entries(routeAgg)
      .map(([route, v]) => ({ route, delayRate: (v.delayed / v.flights) * 100, flights: v.flights }))
      .sort((a, b) => b.delayRate - a.delayRate)
      .slice(0, 20);

    return {
      total,
      delayRate,
      avgDelay: Number((avgDelay || 0).toFixed(2)),
      statusDist,
      airlinePerf,
      hourlyHeat,
      heatmapData,
      minuteDelayCounts,
      routePerf,
    };
  }, [filteredNormalized]);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-300 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Từ ngày:</label>
              <input
                type="date"
                value={inputDateRange.start}
                className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(e) => setInputDateRange({ ...inputDateRange, start: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Đến ngày:</label>
              <input
                type="date"
                value={inputDateRange.end}
                className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                onChange={(e) => setInputDateRange({ ...inputDateRange, end: e.target.value })}
              />
            </div>

            <button
              onClick={() => setAppliedDateRange(inputDateRange)}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Lọc
            </button>

            {(inputDateRange.start || inputDateRange.end) && (
              <button
                onClick={() => {
                  const defaultRange = getInitialDates();
                  setInputDateRange(defaultRange);
                  setAppliedDateRange(defaultRange);
                }}
                className="text-sm text-red-600 hover:underline ml-auto"
              >
                Xóa lọc
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Sân bay:</label>
              <select
                value={selectedAirport}
                onChange={(e) => setSelectedAirport(e.target.value as any)}
                className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả sân bay</option>
                <option value="NB">Nội Bài</option>
                <option value="DN">Đà Nẵng</option>
                <option value="TSN">Tân Sơn Nhất</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: KPIs + Donut */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 grid grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Tổng số chuyến bay</div>
            <div className="text-2xl font-bold">{processedData.total}</div>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Tỷ lệ trễ</div>
            <div className="text-2xl font-bold">{processedData.delayRate.toFixed(1)}%</div>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Độ trễ trung bình (phút)</div>
            <div className="text-2xl font-bold">{processedData.avgDelay}</div>
          </div>
        </div>
        <div className="col-span-4">
          <FlightStatusDonutChart data={processedData.statusDist} />
        </div>
      </div>

      {/* Row 2: Airport hourly stacked chart */}
      <div>
        <AirportHourlyStackedBarChart data={filteredNormalized} />
      </div>

      {/* Row 3: Airline & Route */}
      <div className="grid grid-cols-2 gap-4">
        <AirlineDelayBarChart data={processedData.airlinePerf} />
        <RoutePerformanceTable data={processedData.routePerf} />
      </div>

      {/* Row 4: Time & Severity */}
      <div className="space-y-4">
        <div>
          <HourlyDelayHeatmap data={processedData.heatmapData} />
        </div>
        <div>
          <DelayMinuteTreemap data={processedData.minuteDelayCounts} />
        </div>
      </div>
    </div>
  );
}