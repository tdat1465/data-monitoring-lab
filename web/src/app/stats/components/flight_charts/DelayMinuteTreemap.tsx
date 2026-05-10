'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';

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

function getCellFill(intensity: number) {
  if (intensity >= 0.8) return '#ea580c';
  if (intensity >= 0.6) return '#f97316';
  if (intensity >= 0.4) return '#fb923c';
  if (intensity >= 0.2) return '#fdba74';
  if (intensity > 0) return '#fed7aa';
  return '#f3f4f6';
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name, size = 0, depth, maxCount = 0 }: CellProps) {
  if (width <= 0 || height <= 0 || size <= 0) return null;

  const intensity = maxCount > 0 ? size / maxCount : 0;
  const fill = getCellFill(intensity);
  const textColor = intensity >= 0.4 ? '#ffffff' : '#1f2937';
  const showLabel = width >= 42 && height >= 28;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} ry={8} fill={fill} stroke="#ffffff" strokeWidth={1} />
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
          <div className="text-gray-500">Phút cao nhất</div>
          <div className="text-lg font-semibold text-gray-900">
            {summary.peak ? `${summary.peak.minute}m` : '-'}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="text-gray-500">Trung bình mỗi phút</div>
          <div className="text-lg font-semibold text-gray-900">{summary.averagePerMinute.toFixed(1)}</div>
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height={320}>
          <Treemap
            data={summary.nodes}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#ffffff"
            content={<TreemapCell maxCount={summary.maxCount} />}
          >
            <Tooltip content={<MinuteTreemapTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}