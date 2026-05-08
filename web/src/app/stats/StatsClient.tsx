'use client';

import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { DelayRateChart } from '@/components/stats/DelayRateChart';
import { FlightsByHourChart } from '@/components/stats/FlightsByHourChart';
import { DelayDistributionChart } from '@/components/stats/DelayDistributionChart';
import { DelayTrendChart } from '@/components/stats/DelayTrendChart';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import type { Flight } from '@/types/flight';

interface StatsPageProps {
  flights: Flight[];
}

export function StatsClient({ flights }: StatsPageProps) {
  const [trendData, setTrendData] = useState<Array<{ date: string; 'Nội Bài': number; 'Đà Nẵng': number; 'Tân Sơn Nhất': number }>>([]);

  useEffect(() => {
    fetch(`/api/flights?date=${new Date().toISOString().split('T')[0]}&limit=500`)
      .then((r) => r.json())
      .then(() => {
        // Build mock trend data from current flights for demo
        // In production, this would query historical data from DB
        const today = new Date();
        const mock: Array<{ date: string; 'Nội Bài': number; 'Đà Nẵng': number; 'Tân Sơn Nhất': number }> = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
          const nb = Math.floor(Math.random() * 20) + 20;
          const dn = Math.floor(Math.random() * 10) + 8;
          const ts = Math.floor(Math.random() * 15) + 15;
          mock.push({
            date: dateStr,
            'Nội Bài': Math.round(nb * 0.26),
            'Đà Nẵng': Math.round(dn * 0.12),
            'Tân Sơn Nhất': Math.round(ts * 0.36),
          });
        }
        setTrendData(mock);
      });
  }, []);

  // Delay rate by airport
  const airportStats = (['NB', 'DN', 'TSN'] as const).map((code) => {
    const airportFlights = flights.filter((f) => f.source_airport === code);
    const delayed = airportFlights.filter(
      (f) => f.predict_delay_minutes != null && (f.predict_delay_minutes ?? 0) >= 15
    ).length;
    const total = airportFlights.filter((f) => f.predict_delay_minutes != null).length;
    const name = code === 'NB' ? 'Nội Bài' : code === 'DN' ? 'Đà Nẵng' : 'Tân Sơn Nhất';
    return { code, name, total, delayed };
  });

  const delayRateData = airportStats.map((s) => ({
    name: s.name,
    value: s.delayed,
    color:
      s.code === 'NB'
        ? '#3b82f6'
        : s.code === 'DN'
          ? '#22c55e'
          : '#f59e0b',
  }));

  const onTimeData = airportStats.map((s) => ({
    name: `${s.name} (đúng giờ)`,
    value: s.total - s.delayed,
    color:
      s.code === 'NB'
        ? '#93c5fd'
        : s.code === 'DN'
          ? '#86efac'
          : '#fcd34d',
  }));

  // Flights by hour
  const hourMap: Record<number, { NB: number; DN: number; TSN: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourMap[h] = { NB: 0, DN: 0, TSN: 0 };
  }
  flights.forEach((f) => {
    const hour = new Date(f.scheduled_dt).getHours();
    if (hourMap[hour]) {
      hourMap[hour][f.source_airport]++;
    }
  });
  const flightsByHourData = Object.entries(hourMap)
    .filter(([, v]) => v.NB > 0 || v.DN > 0 || v.TSN > 0)
    .map(([hour, v]) => ({
      hour: `${hour}h`,
      'Sân bay': v.NB + v.DN + v.TSN,
      NB: v.NB,
      DN: v.DN,
      TSN: v.TSN,
    }));

  // Delay distribution
  const delayRanges = [
    { label: 'Sớm (>5p)', check: (v: number | null) => v != null && v < -5 },
    { label: 'Sớm 1-5p', check: (v: number | null) => v != null && v >= -5 && v < 0 },
    { label: 'Đúng giờ', check: (v: number | null) => v != null && v === 0 },
    { label: 'Trễ 1-15p', check: (v: number | null) => v != null && v > 0 && v < 15 },
    { label: 'Trễ 15-30p', check: (v: number | null) => v != null && v >= 15 && v < 30 },
    { label: 'Trễ 30-60p', check: (v: number | null) => v != null && v >= 30 && v < 60 },
    { label: 'Trễ >60p', check: (v: number | null) => v != null && v >= 60 },
  ];

  const distributionData = delayRanges.map((r) => ({
    range: r.label,
    count: flights.filter((f) => r.check(f.predict_delay_minutes)).length,
  }));

  // Summary stats
  const total = flights.length;
  const delayed = flights.filter(
    (f) => f.predict_delay_minutes != null && (f.predict_delay_minutes ?? 0) >= 15
  ).length;
  const predicted = flights.filter((f) => f.predict_delay_minutes != null).length;
  const avgDelay =
    flights
      .filter((f) => f.predict_delay_minutes != null)
      .reduce((sum, f) => sum + (f.predict_delay_minutes ?? 0), 0) / predicted || 0;

  const delayRateOverall =
    predicted > 0 ? ((delayed / predicted) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          Thống kê &amp; Biểu đồ
        </h1>
        <p className="text-gray-500 mt-1">Phân tích dữ liệu chuyến bay hôm nay</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{total}</p>
            <p className="text-sm text-gray-500 mt-1">Tổng chuyến bay</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-red-600">{delayed}</p>
            <p className="text-sm text-gray-500 mt-1">Trễ (≥15 phút)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{delayRateOverall}%</p>
            <p className="text-sm text-gray-500 mt-1">Tỷ lệ trễ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-gray-700">
              {avgDelay > 0 ? `+${avgDelay.toFixed(0)}` : avgDelay.toFixed(0)}
              <span className="text-base font-normal text-gray-400 ml-1">phút</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">Trễ TB dự báo</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delay rate pie chart */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Tỷ lệ trễ theo sân bay</h2>
          </CardHeader>
          <CardContent>
            {delayRateData.every((d) => d.value === 0) ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu dự báo
              </div>
            ) : (
              <DelayRateChart data={[...delayRateData, ...onTimeData]} />
            )}
          </CardContent>
        </Card>

        {/* Delay distribution histogram */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Phân bố độ trễ dự báo</h2>
          </CardHeader>
          <CardContent>
            {distributionData.every((d) => d.count === 0) ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu dự báo
              </div>
            ) : (
              <DelayDistributionChart data={distributionData} />
            )}
          </CardContent>
        </Card>

        {/* Flights by hour */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Số chuyến bay theo giờ trong ngày</h2>
          </CardHeader>
          <CardContent>
            {flightsByHourData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Chưa có dữ liệu
              </div>
            ) : (
              <FlightsByHourChart data={flightsByHourData} />
            )}
          </CardContent>
        </Card>

        {/* Delay trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <h2 className="font-semibold text-gray-900">Xu hướng trễ 7 ngày gần nhất</h2>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                Đang tải dữ liệu xu hướng...
              </div>
            ) : (
              <DelayTrendChart data={trendData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Airport breakdown table */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Chi tiết theo sân bay</h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Sân bay</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Tổng CB</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Trễ (≥15p)</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Đúng giờ</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Tỷ lệ trễ</th>
                </tr>
              </thead>
              <tbody>
                {airportStats.map((s) => {
                  const rate = s.total > 0 ? ((s.delayed / s.total) * 100).toFixed(1) : '0';
                  return (
                    <tr key={s.code} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium">{s.name}</td>
                      <td className="py-3 px-2 text-right">{s.total}</td>
                      <td className="py-3 px-2 text-right text-red-600 font-medium">{s.delayed}</td>
                      <td className="py-3 px-2 text-right text-green-600">{s.total - s.delayed}</td>
                      <td className="py-3 px-2 text-right">
                        <span
                          className={`font-semibold ${
                            parseFloat(rate) > 30 ? 'text-red-600' : 'text-orange-500'
                          }`}
                        >
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
