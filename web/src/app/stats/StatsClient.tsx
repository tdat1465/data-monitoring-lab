'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Flight } from '@/types/flight';
import type { WeatherMETAR } from '@/types/weather';
import { OverviewTab } from './components/OverviewTab';
import { FlightTab } from './components/FlightTab';
import { WeatherTab } from './components/WeatherTab';

export function StatsClient({ flights, rawWeatherHistory, serverDateRange }: { 
  flights: Flight[], 
  rawWeatherHistory: WeatherMETAR[],
  serverDateRange: { start: string, end: string }
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'weather' | 'flights'>('overview');

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Tự động refresh lại data mỗi 15 phút (900,000 ms)
    // router.refresh() sẽ trigger re-render Server Component (page.tsx) để lấy data mới
    const intervalId = setInterval(() => {
      router.refresh();
    }, 20 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [router]);

  const handleDateFilter = (newRange: { start: string, end: string }) => {
    const params = new URLSearchParams();
    if (newRange.start) params.set('start', newRange.start);
    if (newRange.end) params.set('end', newRange.end);
    
    // Đẩy URL mới, page.tsx sẽ tự động chạy lại để fetch dữ liệu mới từ DB
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs Navigation */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md ${activeTab === 'overview' ? 'bg-white shadow' : ''}`}
          >
            Tổng quan
          </button>
          <button 
            onClick={() => setActiveTab('weather')}
            className={`px-4 py-2 rounded-md ${activeTab === 'weather' ? 'bg-white shadow' : ''}`}
          >
            Thời tiết
          </button>
          <button 
            onClick={() => setActiveTab('flights')}
            className={`px-4 py-2 rounded-md ${activeTab === 'flights' ? 'bg-white shadow' : ''}`}
          >
            Chuyến bay
          </button>
        </div>
      </div>

      {/* Render Component tương ứng */}
      <div className="mt-6">
        {activeTab === 'overview' && <OverviewTab flights={flights} rawWeatherHistory={rawWeatherHistory} onDateFilter={handleDateFilter} initialDateRange={serverDateRange}/>}
        {activeTab === 'weather' && <WeatherTab rawWeatherHistory={rawWeatherHistory} flights={flights} onDateFilter={handleDateFilter} initialDateRange={serverDateRange} />}
        {activeTab === 'flights' && <FlightTab flights={flights} onDateFilter={handleDateFilter} initialDateRange={serverDateRange} />}
      </div>
    </div>
  );
}