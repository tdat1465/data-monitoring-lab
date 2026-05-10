'use client';

import { useState, useMemo } from 'react';
import { DateFilterBar } from './DateFilterBar';
import { WeatherTimeSeriesChart } from './weather_charts/WeatherTimeSeriesChart';
import { AirportComparisonChart } from './weather_charts/AirportComparisonChart';
import { VisibilityChart } from './weather_charts/VisibilityChart';
import { WindRoseChart } from './weather_charts/WindRoseChart';
import { PressureHumidityChart } from './weather_charts/PressureHumidityChart';

export function WeatherTab({ 
  rawWeatherHistory = [], 
  onDateFilter, 
  initialDateRange 
}: any) {

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

  const defaultDates = initialDateRange || getInitialDates();
  const [inputDateRange, setInputDateRange] = useState(defaultDates);
  const [appliedDateRange, setAppliedDateRange] = useState(defaultDates);
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

  const processedData = useMemo(() => {
    if (!rawWeatherHistory || rawWeatherHistory.length === 0) return [];

    // Lọc theo ngày
    let filtered = rawWeatherHistory.filter((row: any) => {
      if (!appliedDateRange.start || !appliedDateRange.end) return true; 
      const reportTime = new Date(row.report_time_vn).getTime();
      const startTime = new Date(appliedDateRange.start).setHours(0, 0, 0, 0);
      const endTime = new Date(appliedDateRange.end).setHours(23, 59, 59, 999);
      return reportTime >= startTime && reportTime <= endTime;
    });

    // Gom nhóm (Bucket) - Áp dụng cho TẤT CẢ các chế độ để đồng bộ cấu trúc
    const buckets: Record<string, any[]> = {};
    filtered.forEach((row: any) => {
      const date = new Date(row.report_time_vn);
      if (resolution === '30m') date.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0);
      else if (resolution === '1h') date.setMinutes(0, 0, 0);
      else if (resolution === '1d') date.setHours(0, 0, 0, 0);
      // Chế độ 'raw' sẽ giữ nguyên thời gian gốc không làm tròn

      const key = date.toISOString();
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(row);
    });

    // Tính toán đầu ra chuẩn nhất
    return Object.keys(buckets).sort().map(key => {
      const group = buckets[key];
      
      const getAvg = (prop: string) => {
        const vals = group.map(item => Number(item[prop])).filter(v => !isNaN(v));
        if (vals.length === 0) return null;
        
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return Number(avg.toFixed(2));
      };

      const getAvgByStation = (prop: string, code: string) => {
        const vals = group
          .filter(item => item.icao_code === code)
          .map(item => Number(item[prop]))
          .filter(v => !isNaN(v));
          
        if (vals.length === 0) return null;

        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return Number(avg.toFixed(2)); // Ép về số và làm tròn 2 chữ số thập phân
      };

      const getAvgQNH = () => {
        const qnhs = group.map(item => {
          const match = String(item.raw_metar).match(/Q(\d{4})/);
          return match ? Number(match[1]) : null;
        }).filter(v => v !== null) as number[];
        
        return qnhs.length ? Number((qnhs.reduce((a, b) => a + b, 0) / qnhs.length).toFixed(0)) : null;
      };

      const temp = getAvg('temperature_c');
      const dew = getAvg('dew_point_c');

      const humidity = (temp !== null && dew !== null) 
        ? Math.max(0, Math.min(100, 100 - 5 * (temp - dew))) 
        : null;

      return {
        report_time_vn: key,
        // Cột tổng quan cho biểu đồ chuỗi thời gian
        temperature_c: temp,
        dew_point_c: dew,
        wind_speed_kt: getAvg('wind_speed_kt'),
        visibility_miles: getAvg('visibility_miles'),
        humidity: humidity ? Number(humidity.toFixed(1)) : null,
        pressure_qnh: getAvgQNH(),
        // 3 Cột riêng biệt phục vụ cho biểu đồ so sánh
        VVNB: getAvgByStation('temperature_c', 'VVNB'),
        VVDN: getAvgByStation('temperature_c', 'VVDN'),
        VVTS: getAvgByStation('temperature_c', 'VVTS'),
      };
    });
  }, [rawWeatherHistory, appliedDateRange, resolution]);

  if (!rawWeatherHistory || rawWeatherHistory.length === 0) {
    return <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl">Đang tải dữ liệu thời tiết...</div>;
  }

  const handleClearFilter = () => {
    const defaultRange = getInitialDates();
    setInputDateRange(defaultRange);
    setAppliedDateRange(defaultRange);
    setResolution('raw');
    if (onDateFilter) {
      onDateFilter(defaultRange);
    }
  };

  const handleApplyFilter = () => {
    setAppliedDateRange(inputDateRange);
    if (onDateFilter) {
      onDateFilter(inputDateRange);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
        <DateFilterBar
          inputDateRange={inputDateRange}
          setInputDateRange={setInputDateRange}
          resolution={resolution}
          setResolution={setResolution}
          onApply={handleApplyFilter}
          onClear={handleClearFilter}
        />
      </div>
      
      {/* HÀNG 1: Biểu đồ đường chuỗi thời gian (Chiếm Full 100% chiều ngang) */}
      <div className="w-full">
        <WeatherTimeSeriesChart rawWeatherHistory={processedData} />
      </div>
      
      {/* HÀNG 2: Lưới 2 cột -> Chia đôi không gian 1/2 và 1/2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="w-full">
          <AirportComparisonChart rawWeatherHistory={processedData} />
        </div>
        <div className="w-full">
          <VisibilityChart rawWeatherHistory={processedData} />
        </div>
      </div>
      
      {/* HÀNG 3: Lưới 3 cột -> Chia không gian 1/3 và 2/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cột trái: Chiếm 1/3 diện tích (mặc định chiếm 1 cột) */}
        <div className="w-full">
          <WindRoseChart rawWeatherHistory={filteredData} />
        </div>
        
        {/* Cột phải: Chiếm 2/3 diện tích (dùng lg:col-span-2 để ăn 2 cột) */}
        <div className="lg:col-span-2 w-full">
          <PressureHumidityChart rawWeatherHistory={processedData} />
        </div>

      </div>
    </div>
  );
}