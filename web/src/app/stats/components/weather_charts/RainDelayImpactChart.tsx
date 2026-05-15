'use client';

import { useMemo } from 'react';
import type { Flight } from '@/types/flight';
import { extractRainFromMetar } from '@/lib/utils';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type AirportCode = 'NB' | 'DN' | 'TSN';

type ChartRow = {
  condition: string;
  delayRate: number;
  flights: number;
  delayed: number;
};

type TooltipPayload = {
  payload: ChartRow;
};

type TooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
};

type Props = {
  flights?: Flight[];
  selectedAirport?: AirportCode | string | null;
};

function isDelayedFlight(flight: Flight) {
  if (Number(flight.label_delay ?? 0) === 1) return true;
  const delayMinutes = Number(flight.delay_minutes);
  return !isNaN(delayMinutes) && delayMinutes >= 15;
}

function RainImpactTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
      <p className="font-bold text-gray-700">{label}</p>
      <p className="text-[#e07a5f]">Tỷ lệ trễ: {data.delayRate}%</p>
      <p className="text-gray-600">Chuyến bay: {data.flights}</p>
      <p className="text-gray-600">Chuyến trễ: {data.delayed}</p>
    </div>
  );
}

export function RainDelayImpactChart({ flights = [], selectedAirport }: Props) {
  const chartData = useMemo<ChartRow[]>(() => {
    const groups = {
      noRain: { label: 'Không mưa', flights: 0, delayed: 0 },
      rain: { label: 'Có mưa', flights: 0, delayed: 0 },
    };

    flights
      .filter((flight) => !selectedAirport || flight.source_airport === selectedAirport)
      .forEach((flight) => {
        const rain = extractRainFromMetar(flight.raw_metar);
        const group = rain.hasRain ? groups.rain : groups.noRain;

        group.flights += 1;
        if (isDelayedFlight(flight)) {
          group.delayed += 1;
        }
      });

    return Object.values(groups).map((group) => ({
      condition: group.label,
      delayRate: group.flights > 0 ? Number(((group.delayed / group.flights) * 100).toFixed(1)) : 0,
      flights: group.flights,
      delayed: group.delayed,
    }));
  }, [flights, selectedAirport]);

  const totalFlights = chartData.reduce((sum, row) => sum + row.flights, 0);
  const maxDelayRate = Math.max(...chartData.map((row) => row.delayRate), 0);
  const yMax = Math.max(10, Math.ceil((maxDelayRate + 2) / 5) * 5);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Tỷ lệ trễ khi có mưa</h2>
      {totalFlights === 0 ? (
        <div className="flex h-[360px] items-center justify-center text-sm text-gray-500">
          Không có chuyến bay phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
      <div className="w-full h-[360px]">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="condition" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, yMax]} unit="%" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<RainImpactTooltip />} />
            <Bar dataKey="delayRate" radius={[6, 6, 0, 0]} barSize={72} minPointSize={4}>
              {chartData.map((entry) => (
                <Cell key={entry.condition} fill={entry.condition === 'Có mưa' ? '#2563eb' : '#9ca3af'} fillOpacity={0.85} />
              ))}
              <LabelList dataKey="delayRate" position="top" style={{ fontSize: '12px', fill: '#374151' }} formatter={(value: unknown) => `${value}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}
      <p className="mt-3 text-sm text-gray-500">
        Đang tính trên {totalFlights.toLocaleString('vi-VN')} chuyến bay trong bộ lọc hiện tại.
      </p>
    </div>
  );
}
