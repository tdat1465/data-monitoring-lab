'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { colorForIndex } from '@/lib/theme/chartPalette';

const AIRPORT_LABELS: Record<string, string> = {
  NB: 'Sân bay Nội Bài',
  DN: 'Sân bay Đà Nẵng',
  TSN: 'Sân bay Tân Sơn Nhất',
};

export function PredictedRiskLineChart({ seriesByAirport }: { seriesByAirport: Record<string, Array<{ time: string; avgPredicted: number }>> }) {
  // merge into single array keyed by time
  const times = Array.from(new Set([...(seriesByAirport.NB||[]).map(d=>d.time), ...(seriesByAirport.DN||[]).map(d=>d.time), ...(seriesByAirport.TSN||[]).map(d=>d.time)]));
  times.sort();

  const data = times.map(t => ({
    time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    NB: seriesByAirport.NB.find(s => s.time === t)?.avgPredicted || 0,
    DN: seriesByAirport.DN.find(s => s.time === t)?.avgPredicted || 0,
    TSN: seriesByAirport.TSN.find(s => s.time === t)?.avgPredicted || 0,
  }));

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-gray-800">Rủi ro dự báo (12 giờ tới)</h2>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 60, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} label={{ value: 'Phút', angle: -90, position: 'insideLeft', offset: 10 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="NB" name={AIRPORT_LABELS.NB} stroke={colorForIndex(3)} dot={false} />
            <Line type="monotone" dataKey="DN" name={AIRPORT_LABELS.DN} stroke={colorForIndex(5)} dot={false} />
            <Line type="monotone" dataKey="TSN" name={AIRPORT_LABELS.TSN} stroke={colorForIndex(2)} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
