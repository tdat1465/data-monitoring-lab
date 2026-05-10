'use client';

import { useState, useMemo } from 'react';
import { DateFilterBar } from './DateFilterBar';
import { AirportRadarChart } from './overview_charts/AirportRadarChart';
import { TemperatureHeatmap } from './overview_charts/TemperatureHeatmap';
import { VisibilityBoxPlot } from './overview_charts/VisibilityBoxPlot';
import { CloudCoverChart } from './overview_charts/CloudCoverChart';

import type { Flight } from '@/types/flight';
import type { WeatherMETAR } from '@/types/weather';



export function OverviewTab({ 
  flights, 
  rawWeatherHistory,
  onDateFilter,
  initialDateRange,
 }: { 
  flights: Flight[], 
  rawWeatherHistory: WeatherMETAR[], 
  onDateFilter: any, 
  initialDateRange : any 
}) {

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
  
  if (!rawWeatherHistory || rawWeatherHistory.length === 0) {
    return <div className="p-8 text-center text-gray-500">Đang chuẩn bị dữ liệu tổng quan...</div>;
  }

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

      {/* GRID BIỂU ĐỒ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="w-full">
          <CloudCoverChart rawWeatherHistory={filteredData} />
        </div>
        <div className="w-full">
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