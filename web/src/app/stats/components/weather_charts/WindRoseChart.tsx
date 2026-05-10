'use client';

import { useMemo } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';

export function WindRoseChart({ rawWeatherHistory = [] }: any) {
  const chartData = useMemo(() => {
    // 1. Khởi tạo 8 hướng chính
    const directions = [
      { angle: 'N (Bắc)', min: 337.5, max: 22.5 },
      { angle: 'NE (Đông Bắc)', min: 22.5, max: 67.5 },
      { angle: 'E (Đông)', min: 67.5, max: 112.5 },
      { angle: 'SE (Đông Nam)', min: 112.5, max: 157.5 },
      { angle: 'S (Nam)', min: 157.5, max: 202.5 },
      { angle: 'SW (Tây Nam)', min: 202.5, max: 247.5 },
      { angle: 'W (Tây)', min: 247.5, max: 292.5 },
      { angle: 'NW (Tây Bắc)', min: 292.5, max: 337.5 },
    ];

    // 2. Đếm tần suất
    const counts = directions.map(d => ({
      subject: d.angle,
      'Tần suất': 0,
      'Gió mạnh (>15kt)': 0, // Thêm biến để phân tích sâu
      fullMark: 100,
    }));

    rawWeatherHistory.forEach((row: any) => {
      const deg = row.wind_direction_deg;
      const speed = Number(row.wind_speed_kt);
      if (deg === null || deg === undefined) return;

      // Tìm hướng phù hợp cho góc độ
      directions.forEach((d, index) => {
        let isMatch = false;
        if (d.angle === 'N (Bắc)') {
          if (deg >= 337.5 || deg < 22.5) isMatch = true;
        } else {
          if (deg >= d.min && deg < d.max) isMatch = true;
        }

        if (isMatch) {
          counts[index]['Tần suất'] += 1;
          if (speed > 15) counts[index]['Gió mạnh (>15kt)'] += 1;
        }
      });
    });

    return counts;
  }, [rawWeatherHistory]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-2 text-xl font-bold text-gray-800">Biểu đồ Hoa gió</h2>
      <p className="mb-6 text-sm text-gray-500">Thống kê hướng gió chủ đạo và tần suất gió mạnh</p>
      
      <div className="w-full h-[430px]">
        <ResponsiveContainer width="100%" height={430}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
            
            {/* Vùng màu xanh: Tổng tần suất các hướng */}
            <Radar
              name="Tổng số bản tin"
              dataKey="Tần suất"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.5}
            />
            
            {/* Vùng màu đỏ: Chỉ tính những lúc gió mạnh (cảnh báo Crosswind) */}
            <Radar
              name="Gió mạnh > 15kt"
              dataKey="Gió mạnh (>15kt)"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.6}
            />
            
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}