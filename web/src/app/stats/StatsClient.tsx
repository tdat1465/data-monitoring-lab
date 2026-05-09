'use client';

import { useState } from 'react';
import type { Flight } from '@/types/flight';
import { OverviewTab } from './components/OverviewTab';
import { FlightTab } from './components/FlightTab';
import { WeatherTab } from './components/WeatherTab';

export function StatsClient({ flights }: { flights: Flight[] }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'weather' | 'flights'>('overview');

  return (
    <div className="space-y-6">
      {/* Header & Tabs Navigation */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Thống kê</h1>
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
        {activeTab === 'overview' && <OverviewTab flights={flights} />}
        {activeTab === 'weather' && <WeatherTab />}
        {activeTab === 'flights' && <FlightTab flights={flights} />}
      </div>
    </div>
  );
}