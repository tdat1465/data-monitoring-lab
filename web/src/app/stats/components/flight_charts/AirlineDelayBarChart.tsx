'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';

export function AirlineDelayBarChart({ data }: { data: Array<{ airline: string; delayRate: number; flights: number }> }) {
  const chartData = useMemo(() => {
    return data.slice(0, 12).map((d) => ({ airline: d.airline, delayRate: d.delayRate, flights: d.flights }));
  }, [data]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Tỷ lệ trễ theo hãng bay (top 12)</h2>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart layout="vertical" data={chartData} margin={{ top: 10, right: 50, left: 50, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis dataKey="airline" type="category" tick={{ fontSize: 12, fill: '#6b7280' }} width={40} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="delayRate" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={24}>
              <LabelList dataKey="delayRate" position="right" fontSize={11} formatter={(val: any) => typeof val === 'number' ? `${val.toFixed(1)}%` : ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
