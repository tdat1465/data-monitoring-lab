'use client';

import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export function AirportRadarChart({ rawWeatherHistory = [], selectedAirport = null }: any) {
  const radarData = useMemo(() => {
    const allStations = [
      { code: 'VVNB', label: 'Nội Bài' },
      { code: 'VVDN', label: 'Đà Nẵng' },
      { code: 'VVTS', label: 'Tân Sơn Nhất' }
    ];
    
    // Filter stations based on selected airport
    const stationMap: Record<string, string> = { 'NB': 'VVNB', 'DN': 'VVDN', 'TSN': 'VVTS' };
    const stations = selectedAirport && stationMap[selectedAirport]
      ? allStations.filter(s => s.code === stationMap[selectedAirport])
      : allStations;
    
    const metrics = [
      { key: 'temperature_c', label: 'Nhiệt độ (°C)' },
      { key: 'humidity', label: 'Độ ẩm (%)' },
      { key: 'wind_speed_kt', label: 'Gió (kt)' },
      { key: 'visibility_miles', label: 'Tầm nhìn (miles)' }
    ];

    return metrics.map(m => {
      const entry: any = { subject: m.label };
      stations.forEach(s => {
        const vals = rawWeatherHistory
          .filter((d: any) => d.icao_code === s.code)
          .map((d: any) => {
            if (m.key === 'humidity') {
              const t = Number(d.temperature_c);
              const td = Number(d.dew_point_c);
              const humidity = (t && td) ? 100 - 5 * (t - td) : null;
              return humidity ? humidity / 10 : null;
            }
            let val = Number(d[m.key]);
            if (m.key === 'temperature_c') {
              return val ? val / 10 : null;
            }
            return val;
          })
          .filter((v: any) => v !== null && !isNaN(v));
        
        entry[s.code] = vals.length ? Number((vals.reduce((a:any, b:any) => a + b, 0) / vals.length).toFixed(1)) : 0;
      });
      return entry;
    });
  }, [rawWeatherHistory, selectedAirport]);

  const stationLabels: Record<string, string> = { 'NB': 'Nội Bài', 'DN': 'Đà Nẵng', 'TSN': 'Tân Sơn Nhất' };
  const title = selectedAirport ? `Đặc tính Khí hậu - ${stationLabels[selectedAirport]}` : 'Đặc tính Khí hậu 3 Miền';

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm h-full">
      <h2 className="mb-4 text-lg font-bold text-gray-800">{title}</h2>
      <div className="h-[450px]">
        <ResponsiveContainer width="100%" height={450}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#4b5563' }} />
            <Radar name="Nội Bài" dataKey="VVNB" stroke="#3d405b" fill="#3d405b" fillOpacity={0.5} />
            <Radar name="Đà Nẵng" dataKey="VVDN" stroke="#f2cc8f" fill="#f2cc8f" fillOpacity={0.5} />
            <Radar name="Tân Sơn Nhất" dataKey="VVTS" stroke="#eab69f" fill="#eab69f" fillOpacity={0.5} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend verticalAlign="bottom" iconType="circle" />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-[11px] text-gray-400 italic">
        Ghi chú: Nhiệt độ (°C) và độ ẩm (%) đã được chia cho 10 để trực quan hóa dễ đọc hơn.
      </p>
    </div>
  );
}