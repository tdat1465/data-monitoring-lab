'use client';

import React from 'react';
import { colorForIndex } from '@/lib/theme/chartPalette';

const lowColor = colorForIndex(0);
const highColor = colorForIndex(2);

const mixChannel = (from: number, to: number, t: number) => Math.round(from + (to - from) * t);

const mixTwoColors = (fromHex: string, toHex: string, t: number) => {
  const from = fromHex.replace('#', '');
  const to = toHex.replace('#', '');

  const fromR = parseInt(from.slice(0, 2), 16);
  const fromG = parseInt(from.slice(2, 4), 16);
  const fromB = parseInt(from.slice(4, 6), 16);

  const toR = parseInt(to.slice(0, 2), 16);
  const toG = parseInt(to.slice(2, 4), 16);
  const toB = parseInt(to.slice(4, 6), 16);

  return `rgb(${mixChannel(fromR, toR, t)}, ${mixChannel(fromG, toG, t)}, ${mixChannel(fromB, toB, t)})`;
};

export function FlightRadarClock({ hours }: { hours: Array<{ hour: number; count: number }> }) {
  const max = Math.max(...hours.map(h=>h.count), 1);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-gray-800">Mật độ trễ theo giờ</h2>
      <div className="grid grid-cols-6 gap-6 text-xs text-gray-600">
        {hours.map(h => (
          <div key={h.hour} className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: mixTwoColors(lowColor, highColor, h.count / max) }}>
              <span className="text-gray-800 font-semibold">{h.count}</span>
            </div>
            <div className="mt-1">{String(h.hour).padStart(2,'0')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
