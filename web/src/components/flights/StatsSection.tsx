'use client';

import { Plane } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

interface StatsSectionProps {
  total: number;
  delayed: number;
  onTime: number;
  delayRate: string;
}

// Fixed palette colors for stats - chosen for good contrast
const STAT_PALETTE = [
  { bg: '#3D405B', text: '#ffffff' }, // dark blue - tổng số
  { bg: '#E07A5F', text: '#ffffff' }, // terracotta - trễ
  { bg: '#81B29A', text: '#ffffff' }, // sage green - đúng giờ
  { bg: '#F59E0B', text: '#ffffff' }, // amber - tỷ lệ trễ
];

const STAT_LABELS = ['Tổng chuyến bay', 'Trễ (≥15p)', 'Đúng giờ', 'Tỷ lệ trễ'];

export function StatsSection({ total, delayed, onTime, delayRate }: StatsSectionProps) {
  const stats = [
    { label: STAT_LABELS[0], value: total },
    { label: STAT_LABELS[1], value: delayed },
    { label: STAT_LABELS[2], value: onTime },
    { label: STAT_LABELS[3], value: `${delayRate}%` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const { bg, text } = STAT_PALETTE[i];

        return (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 py-4">
              <div
                className="p-3 rounded-xl flex-shrink-0"
                style={{ backgroundColor: bg, color: text }}
              >
                <Plane className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500 truncate">{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: bg }}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
