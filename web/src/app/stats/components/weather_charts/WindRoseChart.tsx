'use client';

import { useMemo } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend
} from 'recharts';

export function WindRoseChart({ rawWeatherHistory = [], flights = [], selectedAirport }: any) {
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

    const counts = directions.map(d => ({
      subject: d.angle,
      'Tần suất': 0,
      'Gió mạnh (>15kt)': 0,
      'Tỉ lệ trễ (%)': 0,
      delayedFlightsCount: 0,
      totalFlightsInDir: 0,
    }));

    // 2. Gom thời tiết theo giờ để lấy góc gió đại diện cho giờ đó
    const hourlyWind: Record<string, number> = {};
    
    rawWeatherHistory.forEach((row: any) => {
      const deg = row.wind_direction_deg;
      const speed = Number(row.wind_speed_kt);
      if (deg === null || deg === undefined) return;

      // Gom theo khung giờ (YYYY-MM-DDTHH)
      const reportHour = new Date(row.report_time_vn).toISOString().slice(0, 13);
      
      // Lưu lại hướng gió đầu tiên tìm thấy trong giờ đó
      if (!hourlyWind[reportHour]) {
        hourlyWind[reportHour] = deg;
      }

      // Đếm tần suất thời tiết
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

    // 3. Lặp qua chuyến bay: Đối chiếu giờ bay với hướng gió trong giờ đó
    flights.forEach((f: any) => {
      if (!f.scheduled_dt) return;
      if (selectedAirport && f.source_airport !== selectedAirport) return;

      const flightHour = new Date(f.scheduled_dt).toISOString().slice(0, 13);
      const windDeg = hourlyWind[flightHour];

      if (windDeg !== undefined) {
        const isDelayed = Number(f.label_delay ?? 0) === 1;
        
        // Tìm xem gió giờ đó thuộc hướng nào
        let matchIndex = -1;
        directions.forEach((d, index) => {
          if (d.angle === 'N (Bắc)') {
            if (windDeg >= 337.5 || windDeg < 22.5) matchIndex = index;
          } else {
            if (windDeg >= d.min && windDeg < d.max) matchIndex = index;
          }
        });

        // Cộng vào tổng chuyến bay của hướng đó
        if (matchIndex !== -1) {
          counts[matchIndex].totalFlightsInDir += 1;
          if (isDelayed) counts[matchIndex].delayedFlightsCount += 1;
        }
      }
    });

    // 4. Tính tỉ lệ phần trăm cuối cùng
    return counts.map(c => ({
      subject: c.subject,
      'Tần suất': c['Tần suất'] / 10,
      'Gió mạnh (>15kt)': c['Gió mạnh (>15kt)'],
      'Tỉ lệ trễ (%)': c.totalFlightsInDir > 0 
        ? Number(((c.delayedFlightsCount / c.totalFlightsInDir) * 100).toFixed(1)) 
        : 0,
    }));
  }, [rawWeatherHistory, flights, selectedAirport]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-2 text-xl font-bold text-gray-800">Biểu đồ Hoa gió</h2>
      <p className="mb-6 text-sm text-gray-500">Thống kê hướng gió chủ đạo, gió mạnh và tỉ lệ trễ theo hướng</p>
      
      <div className="w-full h-[430px]">
        <ResponsiveContainer width="100%" height={430}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
            {/* Ẩn tick đi để đỡ rối mắt */}
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
            
            {/* THÊM LEGEND: Giúp người dùng click vào để ẩn/hiện các lớp biểu đồ */}
            <Legend verticalAlign="top" height={36} wrapperStyle={{ cursor: 'pointer' }} />
            
            <Radar name="Số bản tin" dataKey="Tần suất" stroke="#81b29a" fill="#81b29a" fillOpacity={0.3} />
            <Radar name="Gió mạnh > 15kt" dataKey="Gió mạnh (>15kt)" stroke="#f2cc8f" fill="#f2cc8f" fillOpacity={0.5} />
            <Radar name="Tỉ lệ trễ (%)" dataKey="Tỉ lệ trễ (%)" stroke="#e07a5f" fill="#e07a5f" fillOpacity={0.6} />
            
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}