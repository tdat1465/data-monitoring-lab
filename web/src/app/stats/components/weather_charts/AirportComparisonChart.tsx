'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export function AirportComparisonChart({ rawWeatherHistory = [] }: any) {
  
  const chartData = useMemo(() => {
    // Biến rawWeatherHistory lúc này thực chất là processedData (đã gom nhóm 30p, 1h, 1d) từ WeatherTab truyền xuống.
    // Nên mình chỉ cần lặp qua (map) và đổi tên cho dễ hiểu để Recharts vẽ thôi.
    return rawWeatherHistory.map((row: any) => {
      // Định dạng lại thời gian hiển thị (ví dụ: "08:00 09/05")
      const dateObj = new Date(row.report_time_vn);
      const timeLabel = `${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

      return {
        time: timeLabel,
        // Lấy các giá trị VVNB, VVDN, VVTS đã tính trung bình từ WeatherTab
        'Nội Bài': row.VVNB !== undefined ? row.VVNB : null, 
        'Đà Nẵng': row.VVDN !== undefined ? row.VVDN : null,
        'Tân Sơn Nhất': row.VVTS !== undefined ? row.VVTS : null,
      };
    });
  }, [rawWeatherHistory]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">So sánh Nhiệt độ giữa các Sân bay</h2>
      <div className="w-full h-[430px]">
        <ResponsiveContainer width="100%" height={430}>
          {/* Chuyển về LineChart */}
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="time" 
              minTickGap={60} 
              tick={{ fontSize: 11, fill: '#6b7280' }} 
              angle={-20} 
              textAnchor="end"
            />
            <YAxis 
              domain={['dataMin - 1', 'dataMax + 1']} 
              tick={{ fontSize: 12, fill: '#6b7280' }} 
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Legend verticalAlign="top" height={40} />
            
            {/* 
              Mỗi sân bay một đường:
              - connectNulls={true}: Cực kỳ quan trọng để đường không bị đứt đoạn 
              - dot={false}: Bỏ dấu chấm để đường nhìn thanh thoát hơn
            */}
            <Line 
              type="monotone" 
              dataKey="Nội Bài" 
              stroke="#3b82f6" 
              strokeWidth={3} 
              dot={false} 
              connectNulls={true} 
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="Đà Nẵng" 
              stroke="#10b981" 
              strokeWidth={3} 
              dot={false} 
              connectNulls={true} 
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="Tân Sơn Nhất" 
              stroke="#fb923c" 
              strokeWidth={3} 
              dot={false} 
              connectNulls={true} 
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}