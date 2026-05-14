'use client';

import { useState, useMemo } from 'react';
import { DateFilterBar } from './DateFilterBar';
import { WeatherTimeSeriesChart } from './weather_charts/WeatherTimeSeriesChart';
import { AirportComparisonChart } from './weather_charts/AirportComparisonChart';
import { VisibilityChart } from './weather_charts/VisibilityChart';
import { WindRoseChart } from './weather_charts/WindRoseChart';
import { PressureHumidityChart } from './weather_charts/PressureHumidityChart';
import { TempDelayCorrelationChart } from './weather_charts/TempDelayCorrelationChart';

export function WeatherTab({
  flights = [], 
  rawWeatherHistory = [], 
  onDateFilter, 
  initialDateRange 
}: any) {

  // console.table(rawWeatherHistory)
  

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
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);

  const handleToday = () => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const todayStr = formatDate(today);
    const todayRange = { start: todayStr, end: todayStr };
    setInputDateRange(todayRange);
    setAppliedDateRange(todayRange);
    if (onDateFilter) {
      onDateFilter(todayRange);
    }
  };

  const filteredData = useMemo(() => {
    if (!rawWeatherHistory || rawWeatherHistory.length === 0) return [];
    
    return rawWeatherHistory.filter((row: any) => {
      if (!appliedDateRange.start || !appliedDateRange.end) return true;

      const reportTime = new Date(row.report_time_vn).getTime();
      // So sánh với ICT boundary: 3/5 00:00 ICT = 2/5 17:00 UTC
      const startTime = new Date(`${appliedDateRange.start}T00:00:00+07:00`).getTime();
      const endTime   = new Date(`${appliedDateRange.end}T23:59:59.999+07:00`).getTime();

      return reportTime >= startTime && reportTime <= endTime;
    });
  }, [rawWeatherHistory, appliedDateRange]);

  const airportIcaoMap: Record<string, string> = { NB: 'VVNB', DN: 'VVDN', TSN: 'VVTS' };
  
  const processedData = useMemo(() => {
    if (!rawWeatherHistory || rawWeatherHistory.length === 0) return [];

    // Lọc theo ngày
    // Bước filter trong processedData
    const filteredWeather = rawWeatherHistory.filter((row: any) => {
      if (appliedDateRange.start && appliedDateRange.end) {
        const reportTime = new Date(row.report_time_vn).getTime();
        const startTime = new Date(`${appliedDateRange.start}T00:00:00+07:00`).getTime();
        const endTime   = new Date(`${appliedDateRange.end}T23:59:59.999+07:00`).getTime();
        if (reportTime < startTime || reportTime > endTime) return false;
      }
      // LỌC SÂN BAY
      if (selectedAirport && row.icao_code !== airportIcaoMap[selectedAirport]) return false;
      return true;
    });

    // Lọc chuyến bay theo ngày VÀ Sân bay
    const filteredFlights = flights.filter((f: any) => {
      if (appliedDateRange.start && appliedDateRange.end && f.scheduled_dt) {
        const flightTime = new Date(f.scheduled_dt).getTime();
        const startTime = new Date(`${appliedDateRange.start}T00:00:00+07:00`).getTime();
        const endTime   = new Date(`${appliedDateRange.end}T23:59:59.999+07:00`).getTime();
        if (flightTime < startTime || flightTime > endTime) return false;
      }
      // LỌC SÂN BAY
      if (selectedAirport && f.source_airport !== selectedAirport) return false;
      return true;
    });

    const weatherBuckets: Record<string, any[]> = {};
    const flightBuckets: Record<string, any[]> = {};

    const bucketRes = resolution === 'raw' ? '30m' : resolution;

    filteredWeather.forEach((row: any) => {
      const date = new Date(row.report_time_vn);
      if (bucketRes === '30m') date.setUTCMinutes(date.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
      else if (bucketRes === '1h') date.setUTCMinutes(0, 0, 0);
      else if (bucketRes === '1d') date.setUTCHours(0, 0, 0, 0);

      const key = date.toISOString();
      if (!weatherBuckets[key]) weatherBuckets[key] = [];
      weatherBuckets[key].push(row);
    });

    // Gom nhóm chuyến bay vào CÙNG khung giờ với thời tiết
    filteredFlights.forEach((f: any) => {
      if (!f.scheduled_dt) return;
      const date = new Date(f.scheduled_dt);
      if (bucketRes === '30m') date.setUTCMinutes(date.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
      else if (bucketRes === '1h') date.setUTCMinutes(0, 0, 0);
      else if (bucketRes === '1d') date.setUTCHours(0, 0, 0, 0);

      const key = date.toISOString();
      if (!flightBuckets[key]) flightBuckets[key] = [];
      flightBuckets[key].push(f);
    });

    // Tính toán đầu ra chuẩn nhất
    return Object.keys(weatherBuckets).sort().map(key => {
      const wgroup = weatherBuckets[key];
      const fGroup = flightBuckets[key] || [];

      const getAvgByStation = (prop: string, code: string) => {
        const vals = wgroup.filter(item => item.icao_code === code).map(item => Number(item[prop])).filter(v => !isNaN(v));
        if (vals.length === 0) return null;
        return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      };

      const getDelayRateByStation = (flightAirportCode: string) => {
        const stationFlights = fGroup.filter(f => f.source_airport === flightAirportCode);
        if (stationFlights.length === 0) return 0; 

        const delayedCount = stationFlights.filter(f => {
          const isLabelDelayed = Number(f.label_delay ?? 0) === 1;
          // Lưu ý: Kiểm tra kỹ tên thuộc tính là 'Minutes' hay 'minutes' trong dữ liệu của bạn
          const isTimeDelayed = Number(f.Minutes ?? 0) >= 15; 
          
          return isLabelDelayed || isTimeDelayed;
        }).length;

        return Number(((delayedCount / stationFlights.length) * 100).toFixed(1));
      };

      // THÊM MỚI: Hàm tính tỉ lệ trễ cho TẤT CẢ các chuyến bay trong khung giờ
      const getDelayRateAll = () => {
        if (fGroup.length === 0) return 0; 
        const delayedCount = fGroup.filter(f => Number(f.label_delay ?? 0) === 1).length;
        return Number(((delayedCount / fGroup.length) * 100).toFixed(1));
      };
      
      const getAvg = (prop: string) => {
        const vals = wgroup.map(item => Number(item[prop])).filter(v => !isNaN(v));
        if (vals.length === 0) return null;
        
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return Number(avg.toFixed(2));
      };

      const getAvgQNH = () => {
        const qnhs = wgroup.map(item => {
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

        Delay_NB: getDelayRateByStation('NB'),
        Delay_DN: getDelayRateByStation('DN'),
        Delay_TSN: getDelayRateByStation('TSN'),
        
        // THÊM MỚI: Thuộc tính trả về cho Delay_all
        Delay_all: getDelayRateAll(),
      };
    });
  }, [rawWeatherHistory, flights, appliedDateRange, resolution, selectedAirport]);

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
      <DateFilterBar
        inputDateRange={inputDateRange}
        setInputDateRange={setInputDateRange}
        resolution={resolution}
        setResolution={setResolution}
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        onToday={handleToday}
        selectedAirport={selectedAirport}
        onAirportChange={setSelectedAirport}
      />
      
      {/* HÀNG 1: Biểu đồ đường chuỗi thời gian (Chiếm Full 100% chiều ngang) */}
      <div className="w-full">
        <WeatherTimeSeriesChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
      </div>
      
      {/* HÀNG 2: Lưới 2 cột -> Chia đôi không gian 1/2 và 1/2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="w-full">
          <TempDelayCorrelationChart rawWeatherHistory={processedData} />
        </div>
        <div className="w-full">
          <VisibilityChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
        </div>
      </div>
      
      {/* HÀNG 3: Lưới 3 cột -> Chia không gian 1/3 và 2/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cột trái: Chiếm 1/3 diện tích (mặc định chiếm 1 cột) */}
        <div className="w-full">
          <WindRoseChart rawWeatherHistory={filteredData} flights={flights} selectedAirport={selectedAirport} />
        </div>
        
        {/* Cột phải: Chiếm 2/3 diện tích (dùng lg:col-span-2 để ăn 2 cột) */}
        <div className="lg:col-span-2 w-full">
          <PressureHumidityChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
        </div>


    </div>

        <div className="w-full">
        
          <AirportComparisonChart rawWeatherHistory={processedData} selectedAirport={selectedAirport} />
        </div>
      </div>

  );
}