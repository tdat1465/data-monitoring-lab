import { Wind, Thermometer, Eye, Cloud, Droplets, Compass } from 'lucide-react';
import type { WeatherMETAR } from '@/types/weather';
import { formatDateTime } from '@/lib/utils/formatTime';
import { formatCloudCover } from '@/lib/utils/cloudCover';
import { Card, CardContent } from '@/components/ui/Card';

const AIRPORT_NAMES: Record<string, string> = {
  VVNB: 'Nội Bài (Hà Nội)',
  VVDN: 'Đà Nẵng',
  VVTS: 'Tân Sơn Nhất (TP.HCM)',
};

function VisibilityIndicator({ miles }: { miles: number | null }) {
  if (miles == null) return <span className="text-gray-400">—</span>;
  const color =
    miles > 5 ? 'text-green-600' : miles > 3 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`font-semibold ${color}`}>{miles} mi</span>;
}

interface WeatherCardProps {
  weather: WeatherMETAR;
}

export function WeatherCard({ weather }: WeatherCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {AIRPORT_NAMES[weather.icao_code] ?? weather.icao_code}
          </h3>
          <p className="text-xs text-gray-400 font-mono">{weather.icao_code}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-orange-500" />
            <div>
              <p className="text-xs text-gray-400">Nhiệt độ</p>
              <p className="text-sm font-medium">
                {weather.temperature_c != null ? `${weather.temperature_c}°C` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-xs text-gray-400">Điểm sương</p>
              <p className="text-sm font-medium">
                {weather.dew_point_c != null ? `${weather.dew_point_c}°C` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-xs text-gray-400">Gió</p>
              <p className="text-sm font-medium">
                {weather.wind_speed_kt != null ? `${weather.wind_speed_kt} kt` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-teal-500" />
            <div>
              <p className="text-xs text-gray-400">Hướng gió</p>
              <p className="text-sm font-medium">
                {weather.wind_direction_deg != null ? `${weather.wind_direction_deg}°` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-500" />
            <div>
              <p className="text-xs text-gray-400">Tầm nhìn</p>
              <VisibilityIndicator miles={weather.visibility_miles} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Mây</p>
              <p className="text-xs font-medium truncate" title={weather.cloud_cover ?? ''}>
                {formatCloudCover(weather.cloud_cover)}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Cập nhật: {formatDateTime(weather.report_time_vn)}
          </p>
          <p className="text-xs text-gray-300 mt-1 font-mono" title={weather.raw_metar}>
            METAR: {weather.raw_metar}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
