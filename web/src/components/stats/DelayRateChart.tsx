'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DelayRateData {
  name: string;
  value: number;
  color: string;
}

interface DelayRateChartProps {
  data: DelayRateData[];
}

export function DelayRateChart({ data }: DelayRateChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value} chuyến`, 'Số lượng']}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend
          formatter={(value) => <span style={{ color: '#374151', fontSize: 13 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
