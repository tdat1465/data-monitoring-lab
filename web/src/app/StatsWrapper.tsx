'use client';

import { StatsSection } from '@/components/flights/StatsSection';
import type { Flight } from '@/types/flight';

interface StatsWrapperProps {
  flights: Flight[];
}

export function StatsWrapper({ flights }: StatsWrapperProps) {
  const total = flights.length;

  const getDelayFlag = (f: Flight) =>
    Number(f.label_delay ?? 0) === 1 || Number(f.delay_minutes ?? 0) >= 15;

  const delayed = flights.filter(getDelayFlag).length;
  const onTime = total - delayed;
  const delayRate =
    total > 0 ? ((delayed / total) * 100).toFixed(1) : '0';

  return (
    <StatsSection
      total={total}
      delayed={delayed}
      onTime={onTime}
      delayRate={delayRate}
    />
  );
}
