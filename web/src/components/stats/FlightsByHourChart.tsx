'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface FlightsByHourData {
  hour: string;
  'Sân bay': number;
  NB: number;
  DN: number;
  TSN: number;
}

interface FlightsByHourChartProps {
  data: FlightsByHourData[];
}

export function FlightsByHourChart({ data }: FlightsByHourChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Bar dataKey="NB" name="Nội Bài" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="DN" name="Đà Nẵng" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="TSN" name="Tân Sơn Nhất" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
