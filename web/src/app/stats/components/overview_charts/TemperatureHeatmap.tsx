'use client';

import { useMemo } from 'react';

export function TemperatureHeatmap({ rawWeatherHistory = [] }: any) {
  const dailyData = useMemo(() => {
    const days: Record<string, number[]> = {};
    
    rawWeatherHistory.forEach((d: any) => {
      if (!d.report_time_vn) return;
      
      // CHỐT CHẶN: Ép kiểu về Date rồi mới toISOString để dùng split
      const dateStr = new Date(d.report_time_vn).toISOString();
      const date = dateStr.split('T')[0];
      
      if (!days[date]) days[date] = [];
      days[date].push(Number(d.temperature_c));
    });

    return Object.keys(days).sort().map(date => {
      const validTemps = days[date].filter(v => !isNaN(v));
      return {
        date,
        avgTemp: validTemps.length ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length : 0
      };
    });
  }, [rawWeatherHistory]);

  const getColor = (temp: number) => {
    if (temp === 0) return 'bg-gray-100';
    if (temp > 32) return 'bg-red-500';
    if (temp > 28) return 'bg-orange-400';
    if (temp > 24) return 'bg-yellow-400';
    if (temp > 20) return 'bg-green-400';
    return 'bg-blue-400';
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-800">Mật độ Nhiệt độ Hệ thống</h2>
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
          <span>Mát</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-blue-400" />
            <div className="w-3 h-3 rounded-sm bg-green-400" />
            <div className="w-3 h-3 rounded-sm bg-yellow-400" />
            <div className="w-3 h-3 rounded-sm bg-orange-400" />
            <div className="w-3 h-3 rounded-sm bg-red-500" />
          </div>
          <span>Nóng</span>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {dailyData.map(d => (
          <div key={d.date} className="group relative">
            <div className={`w-10 h-10 rounded-md ${getColor(d.avgTemp)} shadow-sm transition-all hover:ring-2 hover:ring-offset-2 hover:ring-gray-400 cursor-help flex items-center justify-center`} >
               <span className="text-[9px] font-bold text-white opacity-40">{new Date(d.date).getDate()}</span>
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs py-1 px-2 rounded shadow-xl z-20 whitespace-nowrap">
              {new Date(d.date).toLocaleDateString('vi-VN')}: {d.avgTemp.toFixed(1)}°C
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}