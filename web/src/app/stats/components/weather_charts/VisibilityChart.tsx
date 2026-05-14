'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Legend
} from 'recharts';

export function VisibilityChart({ rawWeatherHistory = [], selectedAirport }: any) {
  const chartData = useMemo(() => {
    return rawWeatherHistory.map((row: any) => {
      const dateObj = new Date(row.report_time_vn);
      const timeLabel = `${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

      // Lấy dữ liệu tầm nhìn, mặc định về null nếu bị thiếu
      const vis = row.visibility_miles !== undefined && row.visibility_miles !== null 
        ? Number(row.visibility_miles) 
        : null;

      const delay = selectedAirport === 'DN' ? row.Delay_DN 
                  : selectedAirport === 'TSN' ? row.Delay_TSN 
                  : selectedAirport === 'NB' ? row.Delay_NB
                  : row.Delay_all;

      return {
        time: timeLabel,
        'Tầm nhìn (dặm)': vis !== null ? Number(vis.toFixed(2)) : null,
        'Tỉ lệ Trễ (%)': delay, // THÊM DÒNG NÀY
      };
    });
  }, [rawWeatherHistory, selectedAirport]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Biểu đồ tầm nhìn</h2>
      <div className="w-full h-[450]">
        <ResponsiveContainer width="100%" height={450}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            
            {/* Cấu hình dải màu Gradient: Xanh (Cao) -> Vàng -> Đỏ (Đáy) */}
            <defs>
              <linearGradient id="visibilityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#81b29a" stopOpacity={0.8} />   {/* Xanh Lục - Quang đãng */}
                <stop offset="60%" stopColor="#f4f1de" stopOpacity={0.8} />  {/* Vàng - Bắt đầu có sương */}
                <stop offset="100%" stopColor="#eab69f" stopOpacity={0.9} /> {/* Đỏ - Tầm nhìn cực kém */}
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="time" 
              minTickGap={40} 
              tick={{ fontSize: 11, fill: '#6b7280' }} 
              angle={-20} 
              textAnchor="end"
            />
            {/* Trục Y cố định từ 0 đến 10 dặm (mức trần phổ biến của chuẩn METAR) */}
            <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 12, fill: '#6b7280' }} />
            {/* Thêm Trục Y phải cho % Delay */}
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Legend verticalAlign="top" height={36}/>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            
            {/* Vẽ vùng Area */}
            <Area yAxisId="left" type="monotone" dataKey="Tầm nhìn (dặm)" stroke="#81b29a" strokeWidth={2} fill="url(#visibilityGradient)" connectNulls={true} />
            
            {/* Vẽ đường Line cho tỉ lệ Trễ */}
            <Line yAxisId="right" type="monotone" dataKey="Tỉ lệ Trễ (%)" stroke="#e07a5f" strokeWidth={2} dot={false} connectNulls={true} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}