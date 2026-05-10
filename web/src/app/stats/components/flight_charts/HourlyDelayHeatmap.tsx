'use client';

import React, { useMemo } from 'react';

interface HeatmapDataRow {
  day: string;
  [key: string]: string | number;
}

export function HourlyDelayHeatmap({ data }: { data: HeatmapDataRow[] }) {
  const chartData = useMemo(() => data, [data]);

  // Find max value for color scaling across all cells
  const allValues = chartData.flatMap(row => 
    Object.entries(row)
      .filter(([key]) => key !== 'day')
      .map(([_, val]) => Number(val))
  );
  const maxDelayed = Math.max(...allValues, 1);

  // Get color intensity based on value
  const getColor = (value: number) => {
    const intensity = value / maxDelayed;
    if (intensity === 0) return '#f3f4f6'; // light gray
    if (intensity < 0.2) return '#fed7aa'; // light orange
    if (intensity < 0.4) return '#fdba74'; // medium orange
    if (intensity < 0.6) return '#fb923c'; // orange
    if (intensity < 0.8) return '#f97316'; // dark orange
    return '#ea580c'; // darker orange
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Chuyến bay trễ theo ngày và giờ (heatmap)</h2>
      <div className="w-full overflow-x-auto">
        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-4 pb-4">
          <span className="font-semibold">Thấp</span>
          <div className="flex gap-1">
            {['#f3f4f6', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c'].map((color, idx) => (
              <div
                key={`legend-${idx}`}
                className="w-5 h-5 rounded"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <span className="font-semibold">Cao</span>
        </div>

        {/* Heatmap Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Header (Hours) */}
          <div className="flex">
            <div className="w-12 bg-gray-100 border-r border-b border-gray-200" />
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="w-10 h-10 flex items-center justify-center bg-gray-100 border-r border-b border-gray-200 text-xs font-semibold text-gray-700"
              >
                {String(i).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Rows (Days) */}
          {chartData.map((row) => (
            <div key={row.day} className="flex">
              {/* Day Label */}
              <div className="w-12 bg-gray-50 border-r border-b border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700">
                {row.day}
              </div>

              {/* Cells */}
              {Array.from({ length: 24 }, (_, i) => {
                const hourKey = String(i).padStart(2, '0');
                const value = Number(row[hourKey] || 0);
                return (
                  <div
                    key={`${row.day}-${i}`}
                    className="w-10 h-10 flex items-center justify-center border-r border-b border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: getColor(value) }}
                    title={`${row.day} ${String(i).padStart(2, '0')}:00 - ${value} delays`}
                  >
                    {value > 0 && <span className="text-xs font-semibold text-gray-800">{value}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-gray-600 text-xs">Tổng số chuyến bay trễ</div>
            <div className="text-lg font-bold">
              {allValues.reduce((sum, v) => sum + v, 0)}
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-gray-600 text-xs">Giá trị cao nhất</div>
            <div className="text-lg font-bold">{maxDelayed}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-gray-600 text-xs">Trung bình mỗi ô</div>
            <div className="text-lg font-bold">
              {(allValues.reduce((sum, v) => sum + v, 0) / allValues.length).toFixed(1)}
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-gray-600 text-xs">Ô khác 0</div>
            <div className="text-lg font-bold">
              {allValues.filter(v => v > 0).length} / {allValues.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
