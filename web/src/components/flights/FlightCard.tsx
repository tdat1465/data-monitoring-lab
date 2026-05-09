import { MapPin, Clock } from 'lucide-react';
import type { Flight } from '@/types/flight';
import { formatTime } from '@/lib/utils/formatTime';
import { StatusBadge, DelayBadge } from '@/components/ui/Badge';

const AIRPORT_NAMES: Record<string, string> = {
  NB: 'Nội Bài',
  DN: 'Đà Nẵng',
  TSN: 'Tân Sơn Nhất',
};

interface FlightCardProps {
  flight: Flight;
}

export function FlightCard({ flight }: FlightCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono font-bold text-blue-600 text-lg">
          {flight.flight_number}
        </span>
        <DelayBadge minutes={flight.predict_delay_minutes} />
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <MapPin className="w-3.5 h-3.5" />
        <span className="font-medium">{AIRPORT_NAMES[flight.source_airport]}</span>
        <span className="text-gray-400">
          {flight.direction === 'Arrival' ? '→' : '←'} {flight.route_airport_std}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTime(flight.scheduled_dt)}</span>
        </div>
        <StatusBadge status={flight.status_group} />
      </div>
    </div>
  );
}
