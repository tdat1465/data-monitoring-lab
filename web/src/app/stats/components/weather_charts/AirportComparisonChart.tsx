'use client';

import { useMemo } from 'react';
import {
  LineChart, // Dùng lại LineChart thuần
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
    return rawWeatherHistory.map((row: any) => {
      const dateObj = new Date(row.report_time_vn);
      console.log(row.report_time_vn, typeof row.report_time_vn, new Date(row.report_time_vn).toISOString());
      // const timeLabel = `${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

      // Thay vì getHours(), getDate() — dùng ICT offset +7
      const hours = (dateObj.getUTCHours() + 7) % 24;
      const minutes = dateObj.getUTCMinutes().toString().padStart(2, '0');
      const date = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
      const day = date.getUTCDate();
      const month = date.getUTCMonth() + 1;

      const timeLabel = `${hours}:${minutes} ${day}/${month}`;

      return {
        time: timeLabel,
        'Nội Bài (°C)': row.VVNB !== undefined ? row.VVNB : null, 
        'Đà Nẵng (°C)': row.VVDN !== undefined ? row.VVDN : null,
        'Tân Sơn Nhất (°C)': row.VVTS !== undefined ? row.VVTS : null,
        'Nội Bài (%)': row.Delay_NB !== undefined ? row.Delay_NB : null,
        'Đà Nẵng (%)': row.Delay_DN !== undefined ? row.Delay_DN : null,
        'Tân Sơn Nhất (%)': row.Delay_TSN !== undefined ? row.Delay_TSN : null,
      };
    });
  }, [rawWeatherHistory]);

  // Màu sắc thống nhất cho từng sân bay
  const colors = { NB: '#3d405b', DN: '#f2cc8f', TSN: '#e07a5f' };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-gray-800">Tương quan Nhiệt độ và Tỉ lệ Trễ chuyến</h2>
      
      <div className="flex flex-col gap-4">
        
        {/* --- BIỂU ĐỒ 1: NHIỆT ĐỘ --- */}
        <div className="w-full h-[220px]">
          <h3 className="text-sm font-semibold text-gray-500 mb-1 ml-4">Nhiệt độ (°C)</h3>
          <ResponsiveContainer width="100%" height={220}>
            {/* Sử dụng syncId="weather-delay-sync" để đồng bộ rê chuột */}
            <LineChart data={chartData} syncId="weather-delay-sync" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              {/* Ẩn tick của XAxis ở biểu đồ trên để tiết kiệm không gian */}
              <XAxis dataKey="time" tick={false} axisLine={false} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 12, fill: '#6b7280' }} width={40}/>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '12px' }}/>
              
              <Line type="monotone" dataKey="Nội Bài (°C)" stroke={colors.NB} strokeWidth={2} dot={false} connectNulls={true} />
              <Line type="monotone" dataKey="Đà Nẵng (°C)" stroke={colors.DN} strokeWidth={2} dot={false} connectNulls={true} />
              <Line type="monotone" dataKey="Tân Sơn Nhất (°C)" stroke={colors.TSN} strokeWidth={2} dot={false} connectNulls={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* --- BIỂU ĐỒ 2: TỈ LỆ TRỄ CHUYẾN --- */}
        <div className="w-full h-[250px]">
          <h3 className="text-sm font-semibold text-gray-500 mb-1 ml-4">Tỉ lệ Trễ chuyến (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            {/* Cùng syncId với biểu đồ trên */}
            <LineChart data={chartData} syncId="weather-delay-sync" margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              {/* Hiển thị XAxis đầy đủ ở biểu đồ dưới cùng */}
              <XAxis dataKey="time" minTickGap={40} tick={{ fontSize: 11, fill: '#6b7280' }} angle={-20} textAnchor="end" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} width={40} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '12px' }}/>
              
              {/* Dùng nét đứt (strokeDasharray) hoặc AreaChart tùy bạn, ở đây giữ nguyên nét đứt để khác biệt */}
              <Line type="monotone" dataKey="Nội Bài (%)" stroke={colors.NB} strokeDasharray="3 3" strokeWidth={2} dot={false} connectNulls={true} />
              <Line type="monotone" dataKey="Đà Nẵng (%)" stroke={colors.DN} strokeDasharray="3 3" strokeWidth={2} dot={false} connectNulls={true} />
              <Line type="monotone" dataKey="Tân Sơn Nhất (%)" stroke={colors.TSN} strokeDasharray="3 3" strokeWidth={2} dot={false} connectNulls={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}