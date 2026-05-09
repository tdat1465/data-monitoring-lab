import { Plane } from 'lucide-react';
import type { Flight } from '@/types/flight';
import { formatTime } from '@/lib/utils/formatTime';
import { formatFlightRoute } from '@/lib/utils/formatRoute';
import { StatusBadge, DelayBadge } from '@/components/ui/Badge';

interface FlightCardProps {
  flight: Flight;
}

export function FlightCard({ flight }: FlightCardProps) {
  const route = formatFlightRoute(
    flight.source_airport,
    flight.route_airport_std,
    flight.direction
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono font-bold text-blue-600 text-lg">
          {flight.flight_number}
        </span>
        <DelayBadge minutes={flight.predict_delay_minutes} />
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <Plane className="w-3.5 h-3.5" />
        <span className="font-medium">{route}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          {formatTime(flight.scheduled_dt)}
        </div>
        <StatusBadge status={flight.status_group} />
      </div>
    </div>
  );
}
