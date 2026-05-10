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

type FlightRow = {
  source_airport?: string | null;
  scheduled_dt_iso?: string;
  scheduled_hour?: number | null;
};

const AIRPORT_LABELS: Record<string, string> = {
  NB: 'Nội Bài',
  DN: 'Đà Nẵng',
  TSN: 'Tân Sơn Nhất',
};

const AIRPORT_COLORS: Record<string, string> = {
  NB: '#3b82f6',
  DN: '#f59e0b',
  TSN: '#10b981',
};

export function AirportHourlyStackedBarChart({ data }: { data: FlightRow[] }) {
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

      let hour = row.scheduled_hour ?? null;
      if (hour === null && row.scheduled_dt_iso) {
        const dt = new Date(row.scheduled_dt_iso);
        if (!Number.isNaN(dt.getTime())) {
          hour = dt.getHours();
        }
      }

      if (hour === null || hour < 0 || hour > 23) return;
      rows[hour][airport] += 1;
    });

    return rows;
  }, [data]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Số chuyến bay theo giờ của 3 sân bay</h2>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
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
    </div>
  );
}
