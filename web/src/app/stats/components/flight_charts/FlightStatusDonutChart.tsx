'use client';

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { colorForIndex } from '@/lib/theme/chartPalette';
// const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#6B7280', '#3B82F6'];
const COLORS = [colorForIndex(2), colorForIndex(5), colorForIndex(4), colorForIndex(6), colorForIndex(3), colorForIndex(1), colorForIndex(0), '#9ca3af'];
const STATUS_LABELS: Record<string, string> = {
  on_time: 'Đúng giờ',
  delayed: 'Trễ',
  unknown: 'Chưa rõ',
  enroute: 'Đang bay',
  other: 'Khác',
  landed: 'Đã hạ cánh',
  departed: 'Đã cất cánh',
  cancelled: 'Hủy',
};

function StatusLegend({ payload }: { payload?: ReadonlyArray<{ value?: string; color?: string }> }) {
  if (!payload?.length) return null;

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 px-2 text-xs text-gray-600">
      {payload.map((entry, idx) => (
        <div key={`${entry.value ?? 'status'}-${idx}`} className="inline-flex items-center gap-2 whitespace-nowrap">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color ?? '#9ca3af' }}
          />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function FlightStatusDonutChart({ data }: { data: Record<string, number> }) {
  const chartData = useMemo(() => {
    return Object.entries(data).map(([name, value]) => ({
      name: STATUS_LABELS[name] ?? name,
      value,
    }));
  }, [data]);

  const total = useMemo(() => chartData.reduce((s, e) => s + e.value, 0), [chartData]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Phân bố trạng thái chuyến bay</h2>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={64} paddingAngle={2}>
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend verticalAlign="bottom" height={52} content={(props) => <StatusLegend {...props} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-sm text-gray-600">Tổng số: <span className="font-semibold">{total}</span> chuyến bay</div>
    </div>
  );
}
