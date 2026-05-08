import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plane, MapPin, Clock, CloudSun, Wind, Eye, History } from 'lucide-react';
import { getFlightByKey, getFlightHistory } from '@/lib/queries/getFlightByKey';
import { formatTime, formatDateTime } from '@/lib/utils/formatTime';
import { delayBadgeClass } from '@/lib/utils/formatDelay';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';

const AIRPORT_NAMES: Record<string, string> = {
  NB: 'Nội Bài (Hà Nội)',
  DN: 'Đà Nẵng',
  TSN: 'Tân Sơn Nhất',
};

interface PageProps {
  params: Promise<{ flightKey: string }>;
}

export default async function FlightDetailPage({ params }: PageProps) {
  const { flightKey } = await params;
  const decodedKey = decodeURIComponent(flightKey);

  let flight;
  let history;

  try {
    [flight, history] = await Promise.all([
      getFlightByKey(decodedKey),
      getFlightHistory(decodedKey),
    ]);
  } catch (err) {
    console.error('Failed to load flight:', err);
  }

  if (!flight) notFound();

  const delay = flight.predict_delay_minutes;
  const delayText =
    delay == null
      ? 'Chưa có dự báo'
      : delay < 0
        ? `Sớm ${Math.abs(Math.round(delay))} phút`
        : delay === 0
          ? 'Đúng giờ'
          : `Trễ ${Math.round(delay)} phút`;

  return (
    <div className="space-y-6">
      <Link
        href="/flights"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold font-mono text-blue-600">
                {flight.flight_number}
              </h1>
              <p className="text-gray-500 mt-1">
                {AIRPORT_NAMES[flight.source_airport]} —{' '}
                {flight.direction === 'Arrival' ? 'Chiều đến' : 'Chiều đi'}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-2xl font-bold ${delayBadgeClass(delay).split(' ').map((c) => c.replace('bg-', 'text-')).join(' ')}`}
              >
                {delayText}
              </p>
              {flight.predicted_at && (
                <p className="text-xs text-gray-400 mt-1">
                  Dự báo lúc {formatDateTime(flight.predicted_at)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flight Info */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Plane className="w-4 h-4 text-blue-500" />
            Thông tin chuyến bay
          </h2>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Sân bay</p>
            <p className="font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              {AIRPORT_NAMES[flight.source_airport]}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Điểm đến</p>
            <p className="font-medium">{flight.route_airport_std}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Giờ bay</p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {formatTime(flight.scheduled_dt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Giờ dự kiến</p>
            <p className="font-medium">
              {flight.estimated_dt ? formatTime(flight.estimated_dt) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Trạng thái</p>
            <StatusBadge status={flight.status_group} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Chiều</p>
            <p className="font-medium">
              {flight.direction === 'Arrival' ? 'Đến' : 'Đi'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Weather */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CloudSun className="w-4 h-4 text-yellow-500" />
            Thời tiết tại sân bay
          </h2>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Nhiệt độ</p>
            <p className="font-medium">
              {flight.temperature_c != null ? `${flight.temperature_c}°C` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Tầm nhìn</p>
            <p className="font-medium flex items-center gap-1">
              <Eye className="w-3 h-3 text-gray-400" />
              {flight.visibility_miles != null ? `${flight.visibility_miles} mi` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Tốc độ gió</p>
            <p className="font-medium flex items-center gap-1">
              <Wind className="w-3 h-3 text-gray-400" />
              {flight.wind_speed_kt != null ? `${flight.wind_speed_kt} kt` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Mây</p>
            <p className="font-medium text-sm truncate">{flight.cloud_cover ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" />
              Lịch sử trạng thái
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">
                        {formatDateTime(h.retrieved_at_vn)}
                      </span>
                      <StatusBadge status={h.status.toLowerCase().includes('đ')
                        ? 'on_time'
                        : h.status.toLowerCase().includes('trễ') || h.status.toLowerCase().includes('chậm')
                          ? 'delayed'
                          : 'unknown'} />
                    </div>
                    <p className="text-gray-700 mt-0.5">
                      {h.status}
                      {h.estimated_time && ` — Dự kiến: ${h.estimated_time}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
