'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function VisibilityBoxPlot({ rawWeatherHistory = [] }: any) {
  const boxData = useMemo(() => {
    const stations = [
      { code: 'VVNB', name: 'Nội Bài' },
      { code: 'VVDN', name: 'Đà Nẵng' },
      { code: 'VVTS', name: 'Tân Sơn Nhất' }
    ];

    return stations.map(s => {
      const vals = rawWeatherHistory
        .filter((d: any) => d.icao_code === s.code)
        .map((d: any) => Number(d.visibility_miles))
        .filter((v: any) => !isNaN(v))
        .sort((a: any, b: any) => a - b);

      if (vals.length === 0) return { name: s.name, low: 0, range: 0, avg: 0 };
      
      const min = vals[0];
      const max = vals[vals.length - 1];
      const avg = vals.reduce((a:any, b:any) => a + b, 0) / vals.length;

      return {
        name: s.name,
        low: min,           // Điểm bắt đầu của dải (Min)
        range: max - min,   // Chiều dài dải (Max - Min)
        avg: avg.toFixed(1)
      };
    });
  }, [rawWeatherHistory]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm h-full">
      <h2 className="mb-4 text-lg font-bold text-gray-800">Biến thiên Tầm nhìn (Miles)</h2>
      <div className="h-[450px]">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={boxData} layout="vertical" margin={{ left: 10, right: 30, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
            <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 12 }} label={{ value: 'Dặm', position: 'insideBottom', offset: -5 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fontWeight: 500 }} width={100} />
            <Tooltip 
              cursor={{ fill: '#f9fafb' }}
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
                      <p className="font-bold border-bottom mb-1">{data.name}</p>
                      <p className="text-[#81b29a]">Min: {data.low} miles</p>
                      <p className="text-[#e07a5f]">Max: {(data.low + data.range).toFixed(1)} miles</p>
                      <p className="text-[#f2cc8f] font-bold">Trung bình: {data.avg} miles</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="low" stackId="a" fill="transparent" />
            <Bar dataKey="range" stackId="a" fill="#3d405b" radius={[0, 4, 4, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-[11px] text-gray-400 italic">
        * Giải thích: Thanh màu xanh thể hiện dải tầm nhìn từ thấp nhất đến cao nhất. Thanh càng ngắn chứng tỏ tầm nhìn ổn định.
      </p>
    </div>
  );
}