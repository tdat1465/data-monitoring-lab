'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Bar,
  ComposedChart,
  Line,
} from 'recharts';
import type { Flight } from '@/types/flight';

interface Props {
  flights: Flight[];
  selectedAirport?: string | null;
}

/* ── Custom tooltip ────────────────────────────────────────────── */
function DailyTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{Number(p.value).toFixed(1)} phút</span>
        </p>
      ))}
    </div>
  );
}

export function ActualVsPredictedChart({ flights, selectedAirport }: Props) {
  /* ── 1. Filter: delay_minutes != null/NaN, predict_delay_minutes != null ── */
  const validFlights = useMemo(() => {
    return flights.filter((f) => {
      if (f.delay_minutes == null || isNaN(Number(f.delay_minutes))) return false;
      if (f.predict_delay_minutes == null || isNaN(Number(f.predict_delay_minutes))) return false;
      if (selectedAirport && f.source_airport !== selectedAirport) return false;
      return true;
    });
  }, [flights, selectedAirport]);

  /* ── Clip helper: chuẩn hóa về [0, 300] như khi huấn luyện ────── */
  const clip = (v: number, lo = 0, hi = 300) => Math.max(lo, Math.min(hi, v));

  /* ── 2. Daily aggregation ─────────────────────────────────────── */
  const dailyData = useMemo(() => {
    const buckets: Record<string, { sumActual: number; sumPredicted: number; count: number }> = {};

    validFlights.forEach((f) => {
      const dateStr = f.scheduled_dt ? f.scheduled_dt.substring(0, 10) : 'Unknown';
      if (!buckets[dateStr]) buckets[dateStr] = { sumActual: 0, sumPredicted: 0, count: 0 };
      buckets[dateStr].sumActual += clip(Number(f.delay_minutes));
      buckets[dateStr].sumPredicted += clip(Number(f.predict_delay_minutes));
      buckets[dateStr].count += 1;
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        avgActual: Number((v.sumActual / v.count).toFixed(2)),
        avgPredicted: Number((v.sumPredicted / v.count).toFixed(2)),
        count: v.count,
      }));
  }, [validFlights]);

  /* ── 3. Error metrics ─────────────────────────────────────────── */
  const metrics = useMemo(() => {
    if (validFlights.length === 0) return { mae: 0, rmse: 0, count: 0 };
    const n = validFlights.length;
    const errors = validFlights.map((f) => {
      const actual = clip(Number(f.delay_minutes));
      const predicted = clip(Number(f.predict_delay_minutes));
      return predicted - actual;
    });
    const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / n;
    const mse = errors.reduce((s, e) => s + e * e, 0) / n;
    const rmse = Math.sqrt(mse);

    return { mae, rmse, count: n };
  }, [validFlights]);

  /* ── Render ────────────────────────────────────────────────────── */
  if (validFlights.length === 0) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold text-gray-800">Thực tế vs Dự đoán</h2>
        <p className="mt-4 text-gray-400 text-center text-sm">
          Không có dữ liệu phù hợp (cần delay_minutes và predict_delay_minutes khác null).
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-800">Thực tế vs Dự đoán trễ chuyến</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          So sánh <code className="text-xs bg-gray-100 px-1 rounded">delay_minutes</code> và <code className="text-xs bg-gray-100 px-1 rounded">predict_delay_minutes</code> — trung bình theo ngày
        </p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg px-3 py-2 border border-blue-100">
          <div className="text-xs text-blue-500 font-medium">Số mẫu</div>
          <div className="text-lg font-bold text-blue-800">{metrics.count.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-lg px-3 py-2 border border-amber-100">
          <div className="text-xs text-amber-600 font-medium">MAE</div>
          <div className="text-lg font-bold text-amber-800">{metrics.mae.toFixed(2)} <span className="text-xs font-normal">phút</span></div>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-lg px-3 py-2 border border-rose-100">
          <div className="text-xs text-rose-500 font-medium">RMSE</div>
          <div className="text-lg font-bold text-rose-800">{metrics.rmse.toFixed(2)} <span className="text-xs font-normal">phút</span></div>
        </div>
      </div>

      {/* Chart area */}
      <div className="w-full h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dailyData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              angle={-35}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'Phút trễ TB', angle: -90, position: 'insideLeft', offset: 5, fontSize: 12, fill: '#6b7280' }}
            />
            <Tooltip content={<DailyTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
            <Bar
              dataKey="avgActual"
              name="Thực tế (TB)"
              fill="#3B82F6"
              fillOpacity={0.75}
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Line
              type="monotone"
              dataKey="avgPredicted"
              name="Dự đoán (TB)"
              stroke="#F59E0B"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#F59E0B', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer hint */}
      <p className="mt-3 text-xs text-gray-400 text-center">
        {`Hiển thị ${dailyData.length} ngày — mỗi cột/điểm là trung bình delay của các chuyến bay trong ngày đó.`}
      </p>
    </div>
  );
}
