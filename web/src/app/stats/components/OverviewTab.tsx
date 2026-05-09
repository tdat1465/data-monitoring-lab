'use client';

import { useState, useMemo } from 'react';
import { AirportRadarChart } from './overview_charts/AirportRadarChart';
import { TemperatureHeatmap } from './overview_charts/TemperatureHeatmap';
import { VisibilityBoxPlot } from './overview_charts/VisibilityBoxPlot';
import { CloudCoverChart } from './overview_charts/CloudCoverChart';

import type { Flight } from '@/types/flight';
import type { WeatherMETAR } from '@/types/weather';



export function OverviewTab({ flights, rawWeatherHistory }: { flights: Flight[], rawWeatherHistory: WeatherMETAR[] }) {
  const getInitialDates = () => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return { start: formatDate(sevenDaysAgo), end: formatDate(today) };
  };

  const [inputDateRange, setInputDateRange] = useState(getInitialDates);
  const [appliedDateRange, setAppliedDateRange] = useState(getInitialDates);
  const [resolution, setResolution] = useState<'raw' | '30m' | '1h' | '1d'>('raw');

  const filteredData = useMemo(() => {
    if (!rawWeatherHistory || rawWeatherHistory.length === 0) return [];
    
    return rawWeatherHistory.filter((row: any) => {
      if (!appliedDateRange.start || !appliedDateRange.end) return true; 
      const reportTime = new Date(row.report_time_vn).getTime();
      const startTime = new Date(appliedDateRange.start).setHours(0, 0, 0, 0);
      const endTime = new Date(appliedDateRange.end).setHours(23, 59, 59, 999);
      return reportTime >= startTime && reportTime <= endTime;
    });
  }, [rawWeatherHistory, appliedDateRange]);

  if (!rawWeatherHistory || rawWeatherHistory.length === 0) {
    return <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl">Đang tải dữ liệu thời tiết...</div>;
  }

  const handleClearFilter = () => {
    const defaultRange = getInitialDates();
    setInputDateRange(defaultRange);
    setAppliedDateRange(defaultRange);
    setResolution('raw');
  };
  
  if (!rawWeatherHistory || rawWeatherHistory.length === 0) {
    return <div className="p-8 text-center text-gray-500">Đang chuẩn bị dữ liệu tổng quan...</div>;
  }

  return (
    <div className="space-y-6">
      {/* THANH LỌC THỜI GIAN - COPY TỪ WEATHERTAB */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Từ ngày:</label>
            <input
              type="date"
              value={inputDateRange.start} 
              className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setInputDateRange({ ...inputDateRange, start: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Đến ngày:</label>
            <input
              type="date"
              value={inputDateRange.end} 
              className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setInputDateRange({ ...inputDateRange, end: e.target.value })}
            />
          </div>
          <button 
            onClick={() => setAppliedDateRange(inputDateRange)}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Lọc
          </button>

          <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Hiển thị:</span>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {[{ label: 'Gốc', value: 'raw' }, 
                { label: '1 Giờ', value: '1h' }, 
                { label: '1 Ngày', value: '1d' }].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setResolution(opt.value as any)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${resolution === opt.value ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {(inputDateRange.start || inputDateRange.end) && (
            <button onClick={handleClearFilter} className="text-sm text-red-600 hover:underline ml-auto">Xóa lọc</button>
          )}
        </div>
      </div>

      {/* GRID BIỂU ĐỒ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="w-full">
          {/* CloudCoverChart có thể dùng processedData để mượt hơn */}
          <CloudCoverChart rawWeatherHistory={filteredData} />
        </div>
        <div className="w-full">
          {/* Heatmap/Radar nên dùng filteredData để thấy độ lệch chi tiết giữa các điểm */}
          <TemperatureHeatmap rawWeatherHistory={filteredData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AirportRadarChart rawWeatherHistory={filteredData} />
        <VisibilityBoxPlot rawWeatherHistory={filteredData} />
      </div>
    </div>
  );
}