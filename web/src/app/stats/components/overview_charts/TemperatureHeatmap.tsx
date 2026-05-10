'use client';

import { useMemo } from 'react';

export function TemperatureHeatmap({ rawWeatherHistory = [] }: any) {
  const airports = ['VVNB', 'VVDN', 'VVTS'];
  const airportNames: Record<string, string> = {
    'VVNB': 'Nội Bài',
    'VVDN': 'Đà Nẵng',
    'VVTS': 'Tân Sơn Nhất'
  };

  const heatmapData = useMemo(() => {
    // Grouping: Record<ICAO, Record<Date, Temperature[]>>
    const group: Record<string, Record<string, number[]>> = {};
    
    airports.forEach(code => group[code] = {});

    rawWeatherHistory.forEach((d: any) => {
      const code = d.icao_code;
      if (!airports.includes(code) || !d.report_time_vn) return;

      const dateObj = new Date(d.report_time_vn);
      if (isNaN(dateObj.getTime())) return;

      const date = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD
      
      if (!group[code][date]) group[code][date] = [];
      
      const temp = Number(d.temperature_c);
      if (!isNaN(temp)) {
        group[code][date].push(temp);
      }
    });

    return airports.map(code => {
      const days = group[code];
      const sortedDates = Object.keys(days).sort();
      
      return {
        code,
        name: airportNames[code],
        data: sortedDates.map(date => ({
          date,
          avgTemp: days[date].reduce((a, b) => a + b, 0) / days[date].length
        }))
      };
    });
  }, [rawWeatherHistory]);

  const getColor = (temp: number) => {
    if (temp <= 0) return 'bg-gray-100';
    if (temp > 32) return 'bg-red-500';
    if (temp > 28) return 'bg-orange-400';
    if (temp > 24) return 'bg-yellow-400';
    if (temp > 20) return 'bg-green-400';
    return 'bg-blue-400';
  };

  return (
    <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Mật độ Nhiệt độ Hệ thống</h2>
          <p className="text-xs text-slate-400">Thống kê trung bình theo ngày tại 3 trạm chính</p>
        </div>
        
        {/* Chú thích màu sắc tinh tế hơn */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">Mát</span>
          <div className="flex gap-1">
            {['bg-sky-400', 'bg-emerald-400', 'bg-amber-400', 'bg-orange-400', 'bg-orange-600'].map(c => (
              <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />
            ))}
          </div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">Nóng</span>
        </div>
      </div>
      
      <div className="space-y-8">
        {heatmapData.map(airport => (
          <div key={airport.code} className="grid grid-cols-[100px_1fr] items-center gap-4">
            {/* Nhãn sân bay bên trái để tiết kiệm không gian dọc */}
            <div className="text-right">
              <span className="text-xs font-bold text-slate-700 block leading-tight">{airport.name}</span>
              <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{airport.code}</span>
            </div>

            {/* Các ô Heatmap nhỏ hơn, bo góc nhẹ hơn giống GitHub */}
            <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              {airport.data.map(d => (
                <div key={d.date} className="group relative">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-sm ${getColor(d.avgTemp)} transition-all duration-300 hover:ring-2 hover:ring-offset-2 hover:ring-slate-300 flex items-center justify-center cursor-default`} >
                    <span className="text-[9px] font-bold text-black/60">{new Date(d.date).getDate()}</span>
                  </div>
                  
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg shadow-2xl z-20 whitespace-nowrap">
                    <div className="font-semibold border-b border-white/10 pb-1 mb-1">{airport.name}</div>
                    <div>{new Date(d.date).toLocaleDateString('vi-VN')}: <span className="font-bold">{d.avgTemp.toFixed(1)}°C</span></div>
                  </div>
                </div>
              ))}
              {airport.data.length === 0 && (
                <div className="py-2 text-[10px] text-slate-300 italic">Dữ liệu trống</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}