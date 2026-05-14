'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { colorForIndex } from '@/lib/theme/chartPalette';

type FlightRow = {
  source_airport?: string | null;
  scheduled_dt_iso?: string;
  scheduled_dt?: string | Date | null;
  scheduled_hour?: number | null;
};

const AIRPORT_LABELS: Record<string, string> = {
  NB: 'Nội Bài',
  DN: 'Đà Nẵng',
  TSN: 'Tân Sơn Nhất',
};

const AIRPORT_COLORS: Record<string, string> = {
  NB: colorForIndex(3),
  DN: colorForIndex(5),
  TSN: colorForIndex(2),
};

export function AirportHourlyStackedBarChart({ data, onHourClick }: { data: FlightRow[]; onHourClick?: (hour: number) => void }) {
  const extractHourFromString = (value: string) => {
    const raw = value.trim();
    const match = raw.match(/^(?:\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/);
    if (!match) return null;
    const hour = Number(match[1]);
    return Number.isNaN(hour) ? null : hour;
  };

  const getVietnamHour = (scheduledDt: string | Date | null | undefined) => {
    if (!scheduledDt) return null;

    // Prefer wall-clock hour from datetime text; source DB stores local datetime as text.
    if (typeof scheduledDt === 'string') {
      const hourFromText = extractHourFromString(scheduledDt);
      if (hourFromText !== null) return hourFromText;
    }

    const date = scheduledDt instanceof Date ? scheduledDt : new Date(scheduledDt);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const hourPart = parts.find((part) => part.type === 'hour')?.value;
    if (!hourPart) return null;

    const hour = Number(hourPart);
    return Number.isNaN(hour) ? null : hour;
  };

  const chartData = useMemo(() => {
    const rows = Array.from({ length: 24 }, (_, hour) => ({
      hour: String(hour).padStart(2, '0'),
      NB: 0,
      DN: 0,
      TSN: 0,
    }));

    data.forEach((row) => {
      const airport = row.source_airport;
      if (airport !== 'NB' && airport !== 'DN' && airport !== 'TSN') return;

      let hour = row.scheduled_dt && typeof row.scheduled_dt === 'string'
        ? extractHourFromString(row.scheduled_dt)
        : null;

      if (hour === null) {
        const serverHour = Number(row.scheduled_hour);
        if (!Number.isNaN(serverHour) && serverHour >= 0 && serverHour <= 23) {
          hour = serverHour;
        }
      }

      if (hour === null && row.scheduled_dt_iso) {
        hour = getVietnamHour(row.scheduled_dt_iso);
      }

      if (hour === null && row.scheduled_dt) {
        hour = getVietnamHour(row.scheduled_dt);
      }

      if (hour === null || hour < 0 || hour > 23) return;
      rows[hour][airport] += 1;
    });

    return rows;
  }, [data]);

  const peakHour = useMemo(() => {
    let max = -1;
    let peak: string | null = null;
    chartData.forEach((row) => {
      const total = (row.NB ?? 0) + (row.DN ?? 0) + (row.TSN ?? 0);
      if (total > max) { max = total; peak = row.hour; }
    });
    return peak !== null && max > 0 ? { hour: peak, total: max } : null;
  }, [chartData]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Số chuyến bay theo giờ của 3 sân bay</h2>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            style={{ cursor: onHourClick ? 'pointer' : 'default' }}
            onClick={(e: any) => {
              if (!onHourClick || !e?.activeLabel) return;
              const hour = Number(e.activeLabel);
              if (!Number.isNaN(hour)) onHourClick(hour);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value, name) => {
                const airportKey = String(name ?? '');
                return [value as React.ReactNode, AIRPORT_LABELS[airportKey] ?? airportKey] as [React.ReactNode, string];
              }}
              labelFormatter={(label) => `Giờ ${label}:00`}
            />
            <Legend formatter={(value) => AIRPORT_LABELS[value] ?? value} />
            <Bar dataKey="NB" stackId="airport" fill={AIRPORT_COLORS.NB} radius={[0, 0, 0, 0]} />
            <Bar dataKey="DN" stackId="airport" fill={AIRPORT_COLORS.DN} radius={[0, 0, 0, 0]} />
            <Bar dataKey="TSN" stackId="airport" fill={AIRPORT_COLORS.TSN} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {peakHour && (
        <p className="mt-3 text-sm text-gray-500">
          Khung giờ cao điểm:{' '}
          <span className="font-semibold text-gray-700">{peakHour.hour}:00 – {peakHour.hour}:59</span>
          {' '}với{' '}
          <span className="font-semibold text-gray-700">{peakHour.total} chuyến bay</span>.
        </p>
      )}
    </div>
  );
}
