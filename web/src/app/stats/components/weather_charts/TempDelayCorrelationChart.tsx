'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';

interface DataPoint {
  temperature_c: number | null;
  Delay_all: number;
}

interface Props {
  rawWeatherHistory: any[];
  dateRange?: { start: string; end: string };
  resolution?: string;
}

export function TempDelayCorrelationChart({ rawWeatherHistory, dateRange, resolution }: Props) {
  const correlationData = useMemo(() => {
    if (!rawWeatherHistory || rawWeatherHistory.length === 0) return [];

    const bins: Record<string, { sumDelay: number; count: number; minTemp: number }> = {};

    rawWeatherHistory.forEach((item: DataPoint) => {
      if (item.temperature_c !== null && item.temperature_c !== undefined) {
        const step = 2; 
        const binStart = Math.floor(item.temperature_c / step) * step;
        const binLabel = `${binStart}-${binStart + step}°C`;

        if (!bins[binLabel]) {
          bins[binLabel] = { sumDelay: 0, count: 0, minTemp: binStart };
        }
        bins[binLabel].sumDelay += item.Delay_all;
        bins[binLabel].count += 1;
      }
    });

    return Object.entries(bins)
      .map(([label, data]) => ({
        tempRange: label,
        avgDelay: Number((data.sumDelay / data.count).toFixed(1)),
        minTemp: data.minTemp
      }))
      .sort((a, b) => a.minTemp - b.minTemp);
  }, [rawWeatherHistory]);

  // Hiện chú thích khi lọc đúng khoảng 17/4/2026 – 15/5/2026 VÀ resolution là '1d'
  const showNote = useMemo(() => {
    if (!dateRange || resolution !== '1d') return false;
    return dateRange.start === '2026-04-17' && dateRange.end === '2026-05-15';
  }, [dateRange, resolution]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
          <p className="font-bold text-gray-700">{`Nhiệt độ: ${label}`}</p>
          <p className="text-[#e07a5f]">
            {`Tỉ lệ Trễ: ${payload[0].value}%`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    // Sử dụng p-6 và các class border/shadow giống hệt Pressure Chart
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Tiêu đề h2, mb-6, text-xl để đồng bộ */}
      <h2 className="mb-2 text-xl font-bold text-gray-800">Tương quan Nhiệt độ & Tỉ lệ trễ</h2>

      {/* Chú thích: chỉ hiện khi đủ điều kiện lọc ngày 14/4–15/5 + resolution 1d */}
      {showNote && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
          <span className="mt-0.5">💡</span>
          <span>
            <strong>Nhận xét:</strong> Khi nhiệt độ trung bình ngày càng thấp thì tỷ lệ trễ chuyến trong ngày đó càng cao.
          </span>
        </div>
      )}

      {/* Bọc ResponsiveContainer trong div có chiều cao h-[455px] đúng bằng Pressure Chart */}
      <div className="w-full h-[450px]">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={correlationData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="tempRange" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              unit="%"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="avgDelay" 
              radius={[4, 4, 0, 0]}
              barSize={40}
            >
              {correlationData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.avgDelay > 15 ? '#ef4444' : '#e07a5f'} 
                  fillOpacity={0.8}
                />
              ))}
              <LabelList 
                dataKey="avgDelay" 
                position="top" 
                style={{ fontSize: '12px', fill: '#374151' }} 
                formatter={(v: any) => `${v}%`} 
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}