'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { colorForIndex } from '@/lib/theme/chartPalette';

type MinuteTreemapNode = {
  minute: number;
  name: string;
  size: number;
  count: number;
};

type TreeData = {
  name: string;
  children: MinuteTreemapNode[];
};

type CellProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  size?: number;
  depth?: number;
  maxCount?: number;
};

const lowColor = colorForIndex(0);
const highColor = colorForIndex(5);

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

function getCellFill(intensity: number) {
  if (intensity >= 0.8) return mixTwoColors(lowColor, highColor, 0.95);
  if (intensity >= 0.6) return mixTwoColors(lowColor, highColor, 0.8);
  if (intensity >= 0.4) return mixTwoColors(lowColor, highColor, 0.6);
  if (intensity >= 0.2) return mixTwoColors(lowColor, highColor, 0.3);
  if (intensity > 0) return mixTwoColors(lowColor, highColor, 0.1);
  return colorForIndex(0);
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name, size = 0, depth, maxCount = 0 }: CellProps) {
  if (width <= 0 || height <= 0 || size <= 0) return null;

  const intensity = maxCount > 0 ? size / maxCount : 0;
  const fill = getCellFill(intensity);
  const textColor = '#1f2937';
  const showLabel = width >= 42 && height >= 28;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} ry={8} fill={fill} />
      {showLabel && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 4} textAnchor="middle" fill={textColor} fontSize={12} fontWeight={700}>
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill={textColor} fontSize={11}>
            {size}
          </text>
        </>
      )}
    </g>
  );
}

function MinuteTreemapTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: MinuteTreemapNode }> }) {
  if (!active || !payload?.length) return null;

  const node = payload[0]?.payload;
  if (!node) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-sm font-semibold text-gray-800">{node.minute} phút</div>
      <div className="text-sm text-gray-600">Số chuyến bay trễ: {node.count}</div>
    </div>
  );
}

export function DelayMinuteTreemap({ data }: { data: Record<string, number> }) {
  const summary = useMemo(() => {
    const children = Object.entries(data)
      .map(([minute, count]) => ({
        minute: Number(minute),
        name: `${Number(minute)}`,
        size: count,
        count,
      }))
      .filter((item) => Number.isFinite(item.minute) && item.minute > 0 && item.count > 0)
      .sort((a, b) => b.count - a.count || a.minute - b.minute);

    const total = children.reduce((acc, item) => acc + item.count, 0);
    const peak = children[0] ?? null;
    return {
      nodes: children,
      total,
      peak,
      distinctMinutes: children.length,
      averagePerMinute: children.length ? total / children.length : 0,
      maxCount: peak?.count ?? 0,
    };
  }, [data]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Treemap số phút trễ</h2>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-500">Tổng số chuyến bay trễ</div>
          <div className="text-lg font-semibold text-gray-900">{summary.total}</div>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-500">Số phút khác nhau</div>
          <div className="text-lg font-semibold text-gray-900">{summary.distinctMinutes}</div>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-500">Phút có tần suất cao nhất</div>
          <div className="text-lg font-semibold text-gray-900">
            {summary.peak ? `${summary.peak.minute} phút` : '-'}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-500">Trung bình phút trễ</div>
          <div className="text-lg font-semibold text-gray-900">{summary.averagePerMinute.toFixed(1)}</div>
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height={320}>
          <Treemap
            data={summary.nodes}
            dataKey="size"
            content={<TreemapCell maxCount={summary.maxCount} />}
          >
            <Tooltip content={<MinuteTreemapTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}