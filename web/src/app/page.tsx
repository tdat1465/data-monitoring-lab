import { Suspense } from 'react';
import { Plane, CloudSun } from 'lucide-react';
import { getFlightsWithPredictions } from '@/lib/queries/getFlights';
import { getLatestWeather } from '@/lib/queries/getWeather';
import { FlightTable } from '@/components/flights/FlightTable';
import { DateFilter } from '@/components/flights/DateFilter';
import { WeatherGrid } from '@/components/weather/WeatherGrid';
import { Card, CardContent } from '@/components/ui/Card';

export const revalidate = 300;

interface DashboardPageProps {
  searchParams: Promise<{ date?: string }>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const selectedDate = params.date ?? new Date().toISOString().split('T')[0];

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Tổng chuyến bay"
          value={total}
          icon={Plane}
          color="bg-blue-500"
        />
        <StatCard
          label="Trễ (≥15p)"
          value={delayed}
          icon={Plane}
          color="bg-red-500"
        />
        <StatCard
          label="Đúng giờ"
          value={onTime}
          icon={Plane}
          color="bg-green-500"
        />
        <StatCard
          label="Tỷ lệ trễ"
          value={`${delayRate}%`}
          icon={Plane}
          color="bg-orange-500"
        />
      </div>

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
          Danh sách chuyến bay ngày {displayDate.split(',')[0]}
        </h2>
        <Suspense fallback={<div className="text-gray-400">Đang tải dữ liệu...</div>}>
          <FlightTable initialFlights={flights} />
        </Suspense>
      </section>
    </div>
  );
}
