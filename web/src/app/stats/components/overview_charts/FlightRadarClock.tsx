'use client';

import React from 'react';
import { colorForIndex } from '@/lib/theme/chartPalette';

const baseColor = colorForIndex(5);

const mixWithWhite = (hex: string, t: number) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  const mix = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

export function FlightRadarClock({ hours }: { hours: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...hours.map(h=>h.count), 1);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-gray-800">Mật độ trễ theo giờ</h2>
      <div className="grid grid-cols-6 gap-2 text-xs text-gray-600">
        {hours.map(h => (
          <div key={h.hour} className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: mixWithWhite(baseColor, h.count / max) }}>
              <span className="text-white font-semibold">{h.count}</span>
            </div>
            <div className="mt-1">{String(h.hour).padStart(2,'0')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
