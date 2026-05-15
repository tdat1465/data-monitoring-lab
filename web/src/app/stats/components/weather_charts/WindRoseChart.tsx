'use client';

import { useMemo } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend
} from 'recharts';

export function WindRoseChart({ rawWeatherHistory = [], flights = [], selectedAirport }: any) {
  const chartData = useMemo(() => {
    // 1. Initialize 8 main wind directions
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
      frequency: 0,
      strongWind: 0,
      delayedFlightsCount: 0,
      totalFlightsInDir: 0,
    }));

    // 2. Group weather by hour to get representative wind direction per hour
    const hourlyWind: Record<string, number> = {};

    rawWeatherHistory.forEach((row: any) => {
      const deg = row.wind_direction_deg;
      const speed = Number(row.wind_speed_kt);
      if (deg === null || deg === undefined) return;

      // Group by hour slot (YYYY-MM-DDTHH) in Vietnam timezone
      const reportHourStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hourCycle: 'h23',
        hour: '2-digit',
      }).format(new Date(row.report_time_vn));
      const reportDay = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(row.report_time_vn));
      const reportHour = `${reportDay}T${reportHourStr}`;

      // Store first wind direction found in that hour slot
      if (!hourlyWind[reportHour]) {
        hourlyWind[reportHour] = deg;
      }

      // Count weather frequency per direction
      directions.forEach((d, index) => {
        let isMatch = false;
        if (d.angle === 'N (Bắc)') {
          if (deg >= 337.5 || deg < 22.5) isMatch = true;
        } else {
          if (deg >= d.min && deg < d.max) isMatch = true;
        }

        if (isMatch) {
          counts[index].frequency += 1;
          if (speed >= 12) counts[index].strongWind += 1;
        }
      });
    });

    // 3. Lặp qua chuyến bay: Đối chiếu giờ bay với hướng gió trong giờ đó
    flights.forEach((f: any) => {
      if (!f.scheduled_dt) return;
      if (selectedAirport && f.source_airport !== selectedAirport) return;

      // Format flight hour in Vietnam timezone
      const flightHourStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hourCycle: 'h23',
        hour: '2-digit',
      }).format(new Date(f.scheduled_dt));
      const flightDay = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(f.scheduled_dt));
      const flightHour = `${flightDay}T${flightHourStr}`;
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

        // Accumulate flight counts for that direction
        if (matchIndex !== -1) {
          counts[matchIndex].totalFlightsInDir += 1;
          if (isDelayed) counts[matchIndex].delayedFlightsCount += 1;
        }
      }
    });

    // 4. Compute final values & normalize to 0-100 for radar display
    const intermediate = counts.map(c => ({
      subject: c.subject,
      freqRaw: c.frequency,
      strongWindRaw: c.strongWind,
      delayRateRaw: c.totalFlightsInDir > 0
        ? Number(((c.delayedFlightsCount / c.totalFlightsInDir) * 100).toFixed(1))
        : 0,
    }));

    const maxFreq = Math.max(...intermediate.map(d => d.freqRaw), 1);
    const maxStrongWind = Math.max(...intermediate.map(d => d.strongWindRaw), 1);
    const maxDelayRate = Math.max(...intermediate.map(d => d.delayRateRaw), 1);

    return intermediate.map(d => ({
      subject: d.subject,
      // All three series normalized to 0-100 for visual balance
      'Tần suất': Number(((d.freqRaw / maxFreq) * 100).toFixed(1)),
      'Gió mạnh (>=12kt)': Number(((d.strongWindRaw / maxStrongWind) * 100).toFixed(1)),
      'Tỉ lệ trễ (%)': Number(((d.delayRateRaw / maxDelayRate) * 100).toFixed(1)),
      // Raw values for tooltip display
      freqRaw: d.freqRaw,
      strongWindRaw: d.strongWindRaw,
      delayRateRaw: d.delayRateRaw,
    }));
  }, [rawWeatherHistory, flights, selectedAirport]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-2 text-xl font-bold text-gray-800">Biểu đồ Hoa gió</h2>
      <p className="mb-6 text-sm text-gray-500">
        Thống kê hướng gió — <span className="italic text-gray-400">Tất cả trường đã chuẩn hóa về thang 0–100</span>
      </p>

      <div className="w-full h-[430px]">
        <ResponsiveContainer width="100%" height={430}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

            <Legend verticalAlign="top" height={36} wrapperStyle={{ cursor: 'pointer' }} />

            <Radar name="Số bản tin" dataKey="Tần suất" stroke="#81b29a" fill="#81b29a" fillOpacity={0.3} />
            <Radar name="Gió mạnh (>=12kt)" dataKey="Gió mạnh (>=12kt)" stroke="#f2cc8f" fill="#f2cc8f" fillOpacity={0.5} />
            <Radar name="Tỉ lệ trễ (%)" dataKey="Tỉ lệ trễ (%)" stroke="#e07a5f" fill="#e07a5f" fillOpacity={0.6} />

            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              formatter={(value: any, name: string, props: any) => {
                const payload = props.payload;
                if (name === 'Số bản tin') {
                  return [`${payload.tanSuatRaw} bản tin (${value}%)`, name];
                }
                if (name === 'Gió mạnh (>=12kt)') {
                  return [`${payload.gioManhRaw} bản tin (${value}%)`, name];
                }
                return [`${value}%`, name];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}