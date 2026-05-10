'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';

interface DelayDistributionData {
  range: string;
  count: number;
}

interface DelayDistributionChartProps {
  data: DelayDistributionData[];
}

const getBarColor = (range: string): string => {
  if (range.startsWith('Sớm')) return '#22c55e';
  if (range === 'Đúng giờ') return '#3b82f6';
  if (range === 'Trễ 1-15p') return '#eab308';
  if (range === 'Trễ 15-30p') return '#f97316';
  if (range === 'Trễ 30-60p') return '#ef4444';
  return '#991b1b';
};

export function DelayDistributionChart({ data }: DelayDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="range" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [`${value} chuyến`, 'Số lượng']}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Bar dataKey="count" name="Số chuyến bay" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
