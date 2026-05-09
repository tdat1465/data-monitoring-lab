'use client';

import { useMemo } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export function PressureHumidityChart({ rawWeatherHistory = [] }: any) {
  const chartData = useMemo(() => {
    return rawWeatherHistory.map((row: any) => {
      const dateObj = new Date(row.report_time_vn);
      const timeLabel = `${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

      const t = Number(row.temperature_c);
      const td = Number(row.dew_point_c);
      const humidity = (t && td) ? Math.max(0, Math.min(100, 100 - 5 * (t - td))) : null;

      return {
        time: timeLabel,
        'Áp suất (QNH)': row.pressure_qnh, // Móc từ mã Q1011
        'Độ ẩm (%)': row.humidity,
      };
    });
  }, [rawWeatherHistory]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Tương quan Áp suất & Độ ẩm</h2>
      <div className="w-full h-[455px]">
        <ResponsiveContainer width="100%" height={455}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="time" minTickGap={40} tick={{ fontSize: 11, fill: '#6b7280' }} angle={-20} textAnchor="end" />
            
            {/* Trục Y trái cho Áp suất */}
            <YAxis yAxisId="left" domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 12, fill: '#6b7280' }} label={{ value: 'hPa', angle: -90, position: 'insideLeft' }} />
            
            {/* Trục Y phải cho Độ ẩm */}
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} label={{ value: '%', angle: 90, position: 'insideRight' }} />
            
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend verticalAlign="top" align="right" />

            {/* Vẽ Độ ẩm dạng Cột (Bar) */}
            <Bar yAxisId="right" dataKey="Độ ẩm (%)" fill="#bae6fd" radius={[4, 4, 0, 0]} barSize={20} />
            
            {/* Vẽ Áp suất dạng Đường (Line) */}
            <Line yAxisId="left" type="monotone" dataKey="Áp suất (QNH)" stroke="#ef4444" strokeWidth={3} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}