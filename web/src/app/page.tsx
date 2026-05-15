import { Suspense } from 'react';
import { Plane, CloudSun } from 'lucide-react';
import { getFlightsWithPredictions } from '@/lib/queries/getFlights';
import { getLatestWeather } from '@/lib/queries/getWeather';
import { FlightTable } from '@/components/flights/FlightTable';
import { DateFilter } from '@/components/flights/DateFilter';
import { WeatherGrid } from '@/components/weather/WeatherGrid';
import { StatsWrapper } from '@/app/StatsWrapper';
import { getVietnamDateString } from '@/lib/utils';

export const revalidate = 300;

interface DashboardPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const selectedDate = params.date ?? getVietnamDateString();

  let flights: Awaited<ReturnType<typeof getFlightsWithPredictions>> = [];
  let weather: Awaited<ReturnType<typeof getLatestWeather>> = [];

  try {
    [flights, weather] = await Promise.all([
      getFlightsWithPredictions(selectedDate),
      getLatestWeather(),
    ]);
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }

  const total = flights.length;
  const noPrediction = flights.filter(
    (f) => f.predict_delay_minutes == null
  ).length;

  const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Danh sách các chuyến bay</h1>
          <p className="text-gray-500 mt-1">
            Theo dõi chuyến bay — {displayDate}
          </p>
        </div>
        <Suspense fallback={<div className="h-10" />}>
          <DateFilter />
        </Suspense>
      </div>

      {/* Stats */}
      <StatsWrapper flights={flights} />

      {/* Weather */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CloudSun className="w-5 h-5 text-yellow-500" />
          Thời tiết hiện tại
        </h2>
        <WeatherGrid weather={weather} />
      </section>

      {/* Flights */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plane className="w-5 h-5 text-blue-500" />
          Danh sách chuyến bay {displayDate}
        </h2>
        <Suspense fallback={<div className="text-gray-400">Đang tải dữ liệu...</div>}>
          <FlightTable initialFlights={flights} />
        </Suspense>
      </section>
    </div>
  );
}
