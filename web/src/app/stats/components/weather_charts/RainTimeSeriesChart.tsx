'use client';

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type AirportCode = 'NB' | 'DN' | 'TSN';

type RainChartRow = {
  report_time_vn: string;
  Delay_NB?: number;
  Delay_DN?: number;
  Delay_TSN?: number;
  Delay_all?: number;
  RainRate_NB?: number;
  RainRate_DN?: number;
  RainRate_TSN?: number;
  RainRate_all?: number;
};

type Props = {
  rawWeatherHistory?: RainChartRow[];
  selectedAirport?: AirportCode | string | null;
};

const RAIN_RATE_KEY = 'Tỷ lệ có mưa (%)';
const DELAY_RATE_KEY = 'Tỷ lệ trễ (%)';

function getAirportMetric(row: RainChartRow, selectedAirport: string | null | undefined, metric: 'Delay' | 'RainRate') {
  if (selectedAirport === 'DN') return row[`${metric}_DN`];
  if (selectedAirport === 'TSN') return row[`${metric}_TSN`];
  if (selectedAirport === 'NB') return row[`${metric}_NB`];
  return row[`${metric}_all`];
}

export function RainTimeSeriesChart({ rawWeatherHistory = [], selectedAirport }: Props) {
  const chartData = useMemo(() => {
    return rawWeatherHistory.map((row) => {
      const dateObj = new Date(row.report_time_vn);
      const timeLabel = `${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      const rainRate = Number(getAirportMetric(row, selectedAirport, 'RainRate') ?? 0);
      const delayRate = Number(getAirportMetric(row, selectedAirport, 'Delay') ?? 0);

      return {
        time: timeLabel,
        [RAIN_RATE_KEY]: rainRate,
        [DELAY_RATE_KEY]: delayRate,
      };
    });
  }, [rawWeatherHistory, selectedAirport]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Mưa theo thời gian và tỷ lệ trễ</h2>
      <div className="w-full h-[360px]">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="time" minTickGap={40} tick={{ fontSize: 11, fill: '#6b7280' }} angle={-20} textAnchor="end" />
            <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Legend verticalAlign="top" height={36} />
            <Bar yAxisId="left" dataKey={RAIN_RATE_KEY} fill="#3b82f6" fillOpacity={0.35} radius={[4, 4, 0, 0]} barSize={18} />
            <Line yAxisId="right" type="monotone" dataKey={DELAY_RATE_KEY} stroke="#e07a5f" strokeWidth={2.5} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
