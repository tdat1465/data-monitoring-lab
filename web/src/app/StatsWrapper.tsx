'use client';

import { StatsSection } from '@/components/flights/StatsSection';
import type { Flight } from '@/types/flight';

interface StatsWrapperProps {
  flights: Flight[];
}

export function StatsWrapper({ flights }: StatsWrapperProps) {
  const total = flights.length;
  const delayed = flights.filter(
    (f) => (f.predict_delay_minutes ?? 0) >= 15
  ).length;
  const onTime = flights.filter(
    (f) => f.predict_delay_minutes != null && (f.predict_delay_minutes ?? 0) < 15
  ).length;
  const noPrediction = flights.filter(
    (f) => f.predict_delay_minutes == null
  ).length;
  const delayRate =
    total > 0 ? ((delayed / (total - noPrediction || 1)) * 100).toFixed(1) : '0';

  return (
    <StatsSection
      total={total}
      delayed={delayed}
      onTime={onTime}
      delayRate={delayRate}
    />
  );
}
