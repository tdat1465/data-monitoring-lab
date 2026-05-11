'use client';

import React from 'react';

export function OverviewKPICards({ totalFlights, delayRate, mlAvg, avgVisibility, avgWind }: { totalFlights: number; delayRate: number; mlAvg: number; avgVisibility: number | null; avgWind: number | null }) {
  const danger = delayRate > 20;
  const visBad = avgVisibility != null && avgVisibility < 3;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className={`p-4 rounded-xl shadow-sm bg-white border ${danger ? 'border-red-200' : 'border-gray-200'}`}>
        <div className="text-sm text-gray-500">Hệ thống</div>
        <div className="text-2xl font-bold">{totalFlights}</div>
        <div className="text-sm text-gray-600">Tỷ lệ trễ: <span className={`font-semibold ${danger ? 'text-red-600' : 'text-gray-800'}`}>{delayRate.toFixed(1)}%</span></div>
      </div>

      <div className="p-4 rounded-xl shadow-sm bg-white border border-gray-200">
        <div className="text-sm text-gray-500">Dự báo (12h tới)</div>
        <div className="text-2xl font-bold">{Number(mlAvg.toFixed(1))} phút</div>
        <div className="text-sm text-gray-600">Rủi ro trung bình</div>
      </div>

      <div className={`p-4 rounded-xl shadow-sm bg-white border ${visBad ? 'border-red-200' : 'border-gray-200'}`}>
        <div className="text-sm text-gray-500">Thời tiết</div>
        <div className="text-2xl font-bold">{avgVisibility != null ? avgVisibility.toFixed(2) : '-'} miles</div>
        <div className={`text-sm ${visBad ? 'text-red-600' : 'text-gray-600'}`}>Tầm nhìn trung bình</div>
      </div>

      <div className="p-4 rounded-xl shadow-sm bg-white border border-gray-200">
        <div className="text-sm text-gray-500">An toàn</div>
        <div className="text-2xl font-bold">{avgWind != null ? avgWind.toFixed(1) : '-'} kt</div>
        <div className="text-sm text-gray-600">Tốc độ gió trung bình</div>
      </div>
    </div>
  );
}
