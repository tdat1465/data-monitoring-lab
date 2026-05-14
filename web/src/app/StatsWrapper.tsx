'use client';

import { StatsSection } from '@/components/flights/StatsSection';
import type { Flight } from '@/types/flight';

interface StatsWrapperProps {
  flights: Flight[];
}

// Logic 3 cấp ưu tiên:
// 1. label_delay === 1 (nhãn thực tế)
// 2. delay_minutes >= 15 (delay thực tế)
// 3. predict_delay_minutes >= 15 (dự đoán)
function isDelayed(flight: Flight): boolean {
  if (Number(flight.label_delay ?? 0) === 1) return true;

  const delayMinutes = Number(flight.delay_minutes);
  if (!isNaN(delayMinutes) && delayMinutes >= 15) return true;
  if (!isNaN(delayMinutes) && delayMinutes < 15) return false;

  const predictDelayMinutes = Number(flight.predict_delay_minutes);
  if (!isNaN(predictDelayMinutes) && predictDelayMinutes >= 15) return true;

  return false;
}

function isOnTime(flight: Flight): boolean {
  if (Number(flight.label_delay ?? 0) === 1) return false;

  const delayMinutes = Number(flight.delay_minutes);
  if (!isNaN(delayMinutes) && delayMinutes >= 15) return false;
  if (!isNaN(delayMinutes) && delayMinutes < 15) return true;

  const predictDelayMinutes = Number(flight.predict_delay_minutes);
  if (!isNaN(predictDelayMinutes) && predictDelayMinutes >= 15) return false;
  if (!isNaN(predictDelayMinutes) && predictDelayMinutes < 15) return true;

  return false;
}

export function StatsWrapper({ flights }: StatsWrapperProps) {
  const total = flights.length;
  const delayed = flights.filter(isDelayed).length;
  const onTime = flights.filter(isOnTime).length;
  const delayRate = total > 0 ? ((delayed / total) * 100).toFixed(1) : '0';

  return (
    <StatsSection
      total={total}
      delayed={delayed}
      onTime={onTime}
      delayRate={delayRate}
    />
  );
}
