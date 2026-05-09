'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart
} from 'recharts';

export function WeatherTimeSeriesChart({ rawWeatherHistory = [] }: any) {
  
  const chartData = useMemo(() => {
    return rawWeatherHistory.map((row: any) => {
      const dateObj = new Date(row.report_time_vn);
      // Định dạng: HH:mm DD/MM
      const label = `${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      
      return {
        time: label,
        'Nhiệt độ (°C)': row.temperature_c !== null ? Number(row.temperature_c) : null,
        'Điểm sương (°C)': row.dew_point_c !== null ? Number(row.dew_point_c) : null,
        airport: row.icao_code === 'VVNB' ? 'Nội Bài' : row.icao_code === 'VVDN' ? 'Đà Nẵng' : 'Tân Sơn Nhất'
      };
    });
  }, [rawWeatherHistory]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Diễn biến Nhiệt độ & Điểm sương</h2>
      
      <div className="w-full" style={{ height: '400px' }}>
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {/* Định nghĩa dải màu Gradient */}
            <defs>
              <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorDew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            
            <XAxis 
              dataKey="time" 
              minTickGap={50} 
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              labelClassName="font-bold text-gray-800"
            />
            
            <Legend verticalAlign="top" height={36}/>

            {/* Vùng Area cho Điểm sương - Tạo cảm giác mềm mại */}
            <Area
              type="monotone"
              dataKey="Điểm sương (°C)"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorDew)"
            />

            {/* Đường Line cho Nhiệt độ - Điểm nhấn chính */}
            <Line
              type="monotone"
              dataKey="Nhiệt độ (°C)"
              stroke="#ef4444"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <p className="mt-4 text-sm text-gray-500 italic">
        * Biểu đồ hiển thị dữ liệu chi tiết theo từng mốc báo cáo METAR.
      </p>
    </div>
  );
}