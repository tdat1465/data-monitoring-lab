import { WeatherCard } from './WeatherCard';
import type { WeatherMETAR } from '@/types/weather';

interface WeatherGridProps {
  weather: WeatherMETAR[];
}

export function WeatherGrid({ weather }: WeatherGridProps) {
  if (!weather || weather.length === 0) {
    return (
      <p className="text-gray-400 text-sm">Không có dữ liệu thời tiết.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {weather.map((w) => (
        <WeatherCard key={w.icao_code} weather={w} />
      ))}
    </div>
  );
}
