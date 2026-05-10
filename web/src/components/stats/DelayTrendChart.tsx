'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface TrendData {
  date: string;
  'Nội Bài': number;
  'Đà Nẵng': number;
  'Tân Sơn Nhất': number;
}

interface DelayTrendChartProps {
  data: TrendData[];
}

export function DelayTrendChart({ data }: DelayTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Tỷ lệ trễ']}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend />
        <Line type="monotone" dataKey="Nội Bài" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Đà Nẵng" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Tân Sơn Nhất" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
