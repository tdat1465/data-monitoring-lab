'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { colorForIndex } from '@/lib/theme/chartPalette';

const lowColor = colorForIndex(4);
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

const mapAirportCodeToName = (code: string) => {
  const mapping: Record<string, string> = {
    'NB': 'sân bay Nội Bài',
    'DN': 'sân bay Đà Nẵng',
    'TSN': 'sân bay Tân Sơn Nhất',
  };
  return mapping[code] || code;
}

function getColor(rate: number) {
  if (rate >= 0.5) return mixTwoColors(lowColor, highColor, 0.9);
  if (rate >= 0.2) return mixTwoColors(lowColor, highColor, 0.5);
  return mixTwoColors(lowColor, highColor, 0.1);
}

export function AirlineEfficiencyTreemap({ nodes, byAirport }: { nodes: Array<{ name: string; size: number; delayRate: number }>; byAirport?: Record<string, Record<string, { flights: number; delayed: number }>> }) {
  // if we have airport breakdown, build nested data: airports -> airlines
  const nested = useMemo(() => {
    if (!byAirport) return null;
    return Object.entries(byAirport).map(([ap, airlines]) => ({
      name: ap,
      children: Object.entries(airlines).map(([code, agg]) => ({
        name: `${ap} - ${code}`,
        airport: ap,
        airline: code,
        size: agg.flights,
        delayRate: agg.flights ? (agg.delayed / agg.flights) : 0,
      }))
    }));
  }, [byAirport]);

  const data = useMemo(() => nodes.map(n => ({ name: n.name, size: n.size, delayRate: n.delayRate })), [nodes]);

  const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, airport, airline, children, delayRate } = props;
    const isLeaf = !children || children.length === 0;
    const fill = getColor(delayRate ?? 0);
    if (isLeaf) {
      return (
        <g>
          <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" />
          {width > 60 && height > 30 && (
            <>
              <text x={x + 6} y={y + 16} fill="#fff" fontSize={12} fontWeight={700}>{airport && airline ? airport : name}</text>
              <text x={x + 6} y={y + 31} fill="#f8fafc" fontSize={11} fontWeight={500}>{airport && airline ? airline : ''}</text>
            </>
          )}
        </g>
      );
    }
    // airport group header
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="#f8fafc" stroke="#e6e6e6" />
        {width > 60 && (
          <text x={x + 6} y={y + 18} fill="#111827" fontSize={12} fontWeight={700}>{name}</text>
        )}
      </g>
    );
  };

  // risk summary: find airport with highest avg delay rate
  let riskSummary = null as null | { airport: string; rate: number; topAirline?: string; topRate?: number };
  if (byAirport) {
    let bestAp = '';
    let bestRate = -1;
    Object.entries(byAirport).forEach(([ap, airlines]) => {
      const totals = Object.values(airlines).reduce((s, a) => ({ flights: s.flights + a.flights, delayed: s.delayed + a.delayed }), { flights: 0, delayed: 0 });
      const rate = totals.flights ? (totals.delayed / totals.flights) : 0;
      if (rate > bestRate) { bestRate = rate; bestAp = ap; }
    });
    if (bestAp) {
      // find top airline at that airport
      const airlines = byAirport[bestAp];
      let topAir = '';
      let topR = -1;
      Object.entries(airlines).forEach(([code, agg]) => {
        const r = agg.flights ? (agg.delayed / agg.flights) : 0;
        if (r > topR) { topR = r; topAir = code; }
      });
      riskSummary = { airport: bestAp, rate: bestRate, topAirline: topAir, topRate: topR };
    }
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-2 text-xl font-bold text-gray-800">Hiệu suất hãng bay</h2>
      {riskSummary && (
        <div className="mb-4 text-sm text-gray-700">{`Rủi ro cao tại ${mapAirportCodeToName(riskSummary.airport)} (${(riskSummary.rate*100).toFixed(1)}%) — hãng ${riskSummary.topAirline} ${(riskSummary.topRate!=null?`(${(riskSummary.topRate*100).toFixed(1)}%)`:'')}`}</div>
      )}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height={320}>
          <Treemap data={nested ?? data} dataKey="size" content={<CustomizedContent />} isAnimationActive={false} />
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: lowColor }} />
          <span>Tỷ lệ trễ thấp</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: highColor }} />
          <span>Tỷ lệ trễ cao</span>
        </div>
          <span>Ghi chú: Kích thước = số chuyến.</span>
          <span>Dòng đầu tiên trong các ô là các sân bay tại điểm đi. TSN: Tân Sơn Nhất, NB: Nội Bài, DN: Đà Nẵng</span>
      </div>
    </div>
  );
}
