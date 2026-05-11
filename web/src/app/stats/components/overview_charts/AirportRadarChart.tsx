'use client';

import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export function AirportRadarChart({ rawWeatherHistory = [] }: any) {
  const radarData = useMemo(() => {
    const stations = [
      { code: 'VVNB', label: 'Nội Bài' },
      { code: 'VVDN', label: 'Đà Nẵng' },
      { code: 'VVTS', label: 'Tân Sơn Nhất' }
    ];
    
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
              return (t && td) ? 100 - 5 * (t - td) : null;
            }
            return Number(d[m.key]);
          })
          .filter((v: any) => v !== null && !isNaN(v));
        
        entry[s.code] = vals.length ? Number((vals.reduce((a:any, b:any) => a + b, 0) / vals.length).toFixed(1)) : 0;
      });
      return entry;
    });
  }, [rawWeatherHistory]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm h-full">
      <h2 className="mb-4 text-lg font-bold text-gray-800">Đặc tính Khí hậu 3 Miền</h2>
      <div className="h-[450px]">
        <ResponsiveContainer width="100%" height={450}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#4b5563' }} />
            <Radar name="Nội Bài" dataKey="VVNB" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
            <Radar name="Đà Nẵng" dataKey="VVDN" stroke="#10b981" fill="#10b981" fillOpacity={0.5} />
            <Radar name="Tân Sơn Nhất" dataKey="VVTS" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend verticalAlign="bottom" iconType="circle" />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}