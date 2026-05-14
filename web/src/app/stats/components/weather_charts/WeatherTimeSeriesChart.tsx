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

export function WeatherTimeSeriesChart({ rawWeatherHistory = [], selectedAirport }: any) {
  
  const chartData = useMemo(() => {
    return rawWeatherHistory.map((row: any) => {
      const dateObj = new Date(row.report_time_vn);
      // Format time in Vietnam timezone (UTC+7)
      const timeParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(dateObj);
      const hour = timeParts.find(p => p.type === 'hour')?.value || '00';
      const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
      const dayParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
      }).formatToParts(dateObj);
      const day = dayParts.find(p => p.type === 'day')?.value || '01';
      const month = dayParts.find(p => p.type === 'month')?.value || '01';
      const label = `${hour}:${minute} ${day}/${month}`;
      
      // Lấy delay rate tương ứng theo sân bay được chọn
      const delayRate = selectedAirport === 'DN' ? row.Delay_DN 
                      : selectedAirport === 'TSN' ? row.Delay_TSN 
                      : selectedAirport === 'NB' ? row.Delay_NB
                      : row.Delay_all;
      
      return {
        time: label,
        'Nhiệt độ (°C)': row.temperature_c !== null ? Number(row.temperature_c) : null,
        'Điểm sương (°C)': row.dew_point_c !== null ? Number(row.dew_point_c) : null,
        'Tỉ lệ trễ (%)': delayRate || 0,
        airport: row.icao_code === 'VVNB' ? 'Nội Bài' : row.icao_code === 'VVDN' ? 'Đà Nẵng' : 'Tân Sơn Nhất'
      };
    });
  }, [rawWeatherHistory, selectedAirport]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Diễn biến Nhiệt độ, Điểm sương & Tỉ lệ trễ</h2>
      
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
                <stop offset="5%" stopColor="#3d405b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3d405b" stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            
            <XAxis 
              dataKey="time" 
              minTickGap={50} 
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            
            {/* Trục Y trái cho Nhiệt độ & Điểm sương */}
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            
            {/* Trục Y phải cho Tỉ lệ trễ */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: '%', angle: 90, position: 'insideRight' }}
            />
            
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              labelClassName="font-bold text-gray-800"
            />
            
            <Legend verticalAlign="top" height={36}/>

            {/* Vùng Area cho Điểm sương - Tạo cảm giác mềm mại */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="Điểm sương (°C)"
              stroke="#3d405b"
              fillOpacity={1}
              fill="url(#colorDew)"
            />

            {/* Đường Line cho Nhiệt độ - Điểm nhấn chính */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="Nhiệt độ (°C)"
              stroke="#f2cc8f"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            
            {/* Đường Line cho Tỉ lệ trễ */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Tỉ lệ trễ (%)"
              stroke="#e07a5f"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
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