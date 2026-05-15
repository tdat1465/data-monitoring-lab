"use client";

import React, { useMemo, useState } from 'react';
import type { Flight } from '@/types/flight';
import {
  FlightStatusDonutChart,
} from './flight_charts/FlightStatusDonutChart';
import { DateFilterBar } from './DateFilterBar';
import { AirlineDelayBarChart } from './flight_charts/AirlineDelayBarChart';
import { AirportHourlyStackedBarChart } from './flight_charts/AirportHourlyStackedBarChart';
import { HourlyDelayHeatmap } from './flight_charts/HourlyDelayHeatmap';
import { DelayMinuteTreemap } from './flight_charts/DelayMinuteTreemap';
import { RoutePerformanceTable } from './flight_charts/RoutePerformanceTable';

type DateRange = { start: string; end: string };

export function FlightTab({
  flights,
  onDateFilter,
  initialDateRange,
}: {
  flights: Flight[],
  onDateFilter: any,
  initialDateRange: any
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
  const [focusHour, setFocusHour] = useState<number | null>(null);

  // Helper functions matching OverviewTab
  const getDelayFlag = (flight: any) => {
    // Nếu có label_delay = 1 thì chắc chắn là delayed, không cần xét tiếp, nếu không thì xét tiếp
    if (Number(flight.label_delay ?? 0) === 1) return true;
    const delayMinutes = Number(flight.delay_minutes);
    if (!isNaN(delayMinutes) && delayMinutes >= 15) return true;
    else if (!isNaN(delayMinutes) && delayMinutes < 15) return false; // Nếu có delay_minutes rõ ràng dưới 15 phút thì chắc chắn không delayed, không cần xét tiếp

    // Nếu không có các giá trị chắc chắn thì xét tiếp predict_delay_minutes để có thể dự đoán trễ nếu delay_minutes chưa được cập nhật
    const predictDelayMinutes = Number(flight.predict_delay_minutes);
    if (!isNaN(delayMinutes) && !isNaN(predictDelayMinutes) && predictDelayMinutes >= 15) return true;

    return false;
  };

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

  const getVietnamHour = (scheduledDt: string | Date | null | undefined) => {
    if (!scheduledDt) return null;

    // Prefer wall-clock hour from datetime text; source DB stores local datetime as text.
    if (typeof scheduledDt === 'string') {
      const raw = scheduledDt.trim();
      const hourMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/);
      if (hourMatch) {
        return Number(hourMatch[2]);
      }
    }

    const date = scheduledDt instanceof Date ? scheduledDt : new Date(scheduledDt);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const hourPart = parts.find(part => part.type === 'hour')?.value;
    if (!hourPart) return null;

    const hour = Number(hourPart);
    return Number.isNaN(hour) ? null : hour;
  };

  // Helper to get hour and day name in Vietnam timezone
  const getHourAndDayInVN = (scheduledDt: string | Date | null | undefined) => {
    if (!scheduledDt) return { hour: 0, dayName: 'Chủ nhật' };

    const date = scheduledDt instanceof Date ? scheduledDt : new Date(scheduledDt);
    if (Number.isNaN(date.getTime())) return { hour: 0, dayName: 'Chủ nhật' };

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const dayPart = parts.find(p => p.type === 'weekday')?.value || 'Sun';
    const hourPart = parts.find(p => p.type === 'hour')?.value || '0';

    const dayNamesVi: Record<string, string> = {
      'Mon': 'Thứ 2', 'Tue': 'Thứ 3', 'Wed': 'Thứ 4',
      'Thu': 'Thứ 5', 'Fri': 'Thứ 6', 'Sat': 'Thứ 7', 'Sun': 'Chủ nhật'
    };

    return {
      hour: parseInt(hourPart, 10),
      dayName: dayNamesVi[dayPart] || 'Chủ nhật'
    };
  };

  // Event handlers
  const handleApplyFilter = () => {
    setAppliedDateRange(inputDateRange);
    if (onDateFilter) {
      onDateFilter(inputDateRange);
    }
  };

  const handleClearFilter = () => {
    const defaultRange = getInitialDates();
    setInputDateRange(defaultRange);
    setAppliedDateRange(defaultRange);
    setResolution('raw');
    if (onDateFilter) {
      onDateFilter(defaultRange);
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

  // Deduplicate flights: a single physical flight (e.g., VJ1208 SGN→HAN) appears twice in the DB:
  //   - As Arrival at destination airport (NB, DN, or TSN)
  //   - As Departure from origin airport (may not be NB/DN/TSN)
  // We count each flight_number+date combination only once to get the actual flight count.
  const deduplicateFlights = (flightList: any[]) => {
    const unique = new Map<string, any>();
    flightList.forEach((f) => {
      const flightDate = f.scheduled_dt?.split('T')[0] ?? '';
      // Use flight_number + date as key (ignore source_airport to deduplicate across airports)
      const key = `${f.flight_number}_${flightDate}`;
      if (!unique.has(key)) {
        unique.set(key, f);
      }
    });
    return Array.from(unique.values());
  };

  // Normalize input records (parse dates, cast numbers, extract airline_code/hour)
  const normalized = useMemo(() => {
    if (!flights || flights.length === 0) return [] as any[];
    // Deduplicate flights first
    const uniqueFlights = deduplicateFlights(flights);
    return uniqueFlights.map((r: any) => {
      let scheduledHour: number | null = null;
      try {
        const hourFromServer = Number(r.scheduled_hour);
        if (!Number.isNaN(hourFromServer) && hourFromServer >= 0 && hourFromServer <= 23) {
          scheduledHour = hourFromServer;
        } else {
          scheduledHour = getVietnamHour(r.scheduled_dt);
        }
      } catch (e) {
        const match = typeof r.scheduled_dt === 'string' ? r.scheduled_dt.match(/\b(\d{2}):(\d{2})(?::\d{2})?\b/) : null;
        scheduledHour = match ? Number(match[1]) : null;
      }

      const airline = r.airline_code ?? (r.flight_number ? String(r.flight_number).match(/^([A-Z0-9]{2})/)?.[0] ?? 'UNK' : 'UNK');
      const delayMinutes = r.delay_minutes == null ? null : Number(r.delay_minutes);

      return {
        ...r,
        scheduled_hour: scheduledHour,
        airline_code: airline,
        delay_minutes: delayMinutes != null && !isNaN(delayMinutes) ? delayMinutes : null,
      };
    });
  }, [flights]);
  // Thêm hàm mapping các loại route_airport_std và route_airport nếu cần thiết
  const mapRouteAirport = (route: string | null | undefined) => {
    if (!route) return 'UNK';
    const mapping: Record<string, string> = {
      'HAI PHONG': 'HAI PHONG (HPH)',
      'HAIPHONG': 'HAI PHONG (HPH)',
      'HẢI PHÒNG': 'HAI PHONG (HPH)',
      'HA NOI': 'HA NOI (HAN)',
      'HO CHI MINH': 'HO CHI MINH (SGN)',
      'CAN THO': 'CAN THO (VCA)',
      'B. MA THUOT': 'BUON MA THUOT (BMV)',
      'BUON MA THUOT': 'BUON MA THUOT (BMV)',
      'PHÚ QUÓC': 'PHU QUOC (PQC)',
      'PHU QUOC': 'PHU QUOC (PQC)',
      'NHA TRANG': 'NHA TRANG (CXR)',
      'HÀ NỌI': 'HA NOI (HAN)',
      'DÀ NÃNG': 'DA NANG (DAD)',
      'DA NANG': 'DA NANG (DAD)',
      'DA NẴNG': 'DA NANG (DAD)',
      'Vinh': 'VINH (VII)',
      'VINH': 'VINH (VII)',
      'QUI NHON': 'QUY NHON (UIH)',
      'QUY NHON': 'QUY NHON (UIH)',
    };
    return mapping[route] || route;
  }
  // Áp dụng mapping cho route_airport_std nếu có
  const mappedNormalized = useMemo(() => {
    return normalized.map((r: any) => ({
      ...r,
      route_airport_std: mapRouteAirport(r.route_airport_std),
      route_airport: mapRouteAirport(r.route_airport)
    }));
  }, [normalized]);

  const filteredNormalized = useMemo(() => {
    if (!mappedNormalized || mappedNormalized.length === 0) return [] as any[];
    return mappedNormalized.filter((f) => {
      if (!selectedAirport || selectedAirport === 'ALL') return true;
      return f.source_airport === selectedAirport;
    });
  }, [mappedNormalized, selectedAirport]);

  // Global hour focus — filters ALL charts to a single hour when set
  const focusFiltered = useMemo(() => {
    if (focusHour === null) return filteredNormalized;
    return filteredNormalized.filter((f) => f.scheduled_hour === focusHour);
  }, [filteredNormalized, focusHour]);

  const handleHourClick = (hour: number) => {
    setFocusHour((prev) => (prev === hour ? null : hour));
  };

  const processedData = useMemo(() => {
    // Use focusFiltered as the data source so focusHour drives all charts/KPIs
    const data = focusFiltered;
    const total = data.length;
    const delayedCount = data.filter(getDelayFlag).length;
    const delayRate = total ? (delayedCount / total) * 100 : 0;
    const delayRecords = data.filter((r) => r.delay_minutes !== null);
    const avgDelay = delayRecords.length > 0 ? delayRecords.reduce((s, r) => s + (r.delay_minutes || 0), 0) / delayRecords.length : 0;

    const hourly = data.reduce<Record<string, {
      flights: number;
      delayed: number;
      avgDelay: number;
      minDelay: number | null;
      maxDelay: number | null;
    }>>((acc, r) => {
      const hour = getVietnamHour(r.scheduled_dt);
      if (hour == null) return acc;
      const key = `${hour}`;

      if (!acc[key]) {
        acc[key] = {
          flights: 0,
          delayed: 0,
          avgDelay: 0,
          minDelay: null,
          maxDelay: null,
        };
      }

      acc[key].flights += 1;
      if (getDelayFlag(r)) {
        acc[key].delayed += 1;
        const d = Number(r.delay_minutes);
        if (!Number.isNaN(d)) {
          acc[key].minDelay = acc[key].minDelay === null ? d : Math.min(acc[key].minDelay, d);
          acc[key].maxDelay = acc[key].maxDelay === null ? d : Math.max(acc[key].maxDelay, d);
        }
      }
      return acc;
    }, {});

    const statusDist = data.reduce<Record<string, number>>((acc, r) => {
      const k = r.status_group || 'other';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    const airlineAgg: Record<string, { flights: number; delayed: number }> = {};
    const isSingleDay = initialDateRange.start === initialDateRange.end;

    data.forEach((r) => {
      const a = r.airline_code ?? 'UNK';
      airlineAgg[a] = airlineAgg[a] || { flights: 0, delayed: 0 };
      airlineAgg[a].flights += 1;
      if (getDelayFlag(r)) airlineAgg[a].delayed += 1;
    });

    const airlinePerf = Object.entries(airlineAgg)
      .map(([k, v]) => ({ airline: k, delayRate: (v.delayed / v.flights) * 100, flights: v.flights }))
      .sort((a, b) => b.delayRate - a.delayRate);

    // Heatmap Logic
    const hourlyByDay: Record<string, Record<number, number>> = {};

    data.forEach((r) => {
      const { hour, dayName } = getHourAndDayInVN(r.scheduled_dt);

      // Ép toàn bộ dữ liệu vào 1 hàng nếu chỉ chọn 1 ngày (tránh lẹm giờ do múi giờ)
      const rowKey = isSingleDay
        ? (data[0] ? getHourAndDayInVN(data[0].scheduled_dt).dayName : dayName)
        : dayName;

      if (getDelayFlag(r)) {
        if (!hourlyByDay[rowKey]) hourlyByDay[rowKey] = {};
        hourlyByDay[rowKey][hour] = (hourlyByDay[rowKey][hour] || 0) + 1;
      }
    });

    const heatmapData = Object.entries(hourlyByDay).map(([day, hours]) => ({
      day,
      ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(i).padStart(2, '0'), hours[i] || 0]))
    }));

    const minuteDelayCounts: Record<string, number> = {};
    data.forEach((r) => {
      if (Number(r.label_delay ?? 0) !== 1) return;

      const actualDelay = Number(r.delay_minutes);
      const predictedDelay = Number(r.predict_delay_minutes);
      const m = Number.isFinite(actualDelay) ? actualDelay : predictedDelay;

      if (!Number.isFinite(m) || m < 15) return;
      const key = String(Math.round(m));
      minuteDelayCounts[key] = (minuteDelayCounts[key] || 0) + 1;
    });

    const routeAgg: Record<string, { flights: number; delayed: number }> = {};
    data.forEach((r) => {
      const route = r.route_airport_std || 'UNK';
      routeAgg[route] = routeAgg[route] || { flights: 0, delayed: 0 };
      routeAgg[route].flights += 1;
      if (getDelayFlag(r)) routeAgg[route].delayed += 1;
    });


    const routePerf = Object.entries(routeAgg)
      .map(([route, v]) => ({ route, delayRate: (v.delayed / v.flights) * 100, flights: v.flights }))
      .sort((a, b) => b.delayRate - a.delayRate)
      .slice(0, 20);

    return {
      total,
      delayRate,
      avgDelay: Number(avgDelay.toFixed(2)),
      statusDist,
      airlinePerf,
      heatmapData,
      minuteDelayCounts,
      routePerf,
    };
  }, [focusFiltered, initialDateRange]);

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
        onAirportChange={(airport) => {
          setSelectedAirport((airport as any) ?? 'ALL');
        }}
      />

      {/* Focus Hour Badge */}
      {focusHour !== null && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <span>🕐</span>
          <span>Đang lọc khung giờ: <strong>{String(focusHour).padStart(2, '0')}:00 – {String(focusHour).padStart(2, '0')}:59</strong></span>
          <button
            onClick={() => setFocusHour(null)}
            className="ml-auto px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 rounded transition-colors"
          >
            ✕ Xoá lọc giờ
          </button>
        </div>
      )}

      {/* Row 1: KPIs + Donut */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 grid grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Tổng số chuyến bay</div>
            <div className="text-2xl font-bold">{processedData.total}</div>
          </div>
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-500">Tỷ lệ trễ (bao gồm dự báo)</div>
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
        <AirportHourlyStackedBarChart data={focusFiltered} onHourClick={handleHourClick} />
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