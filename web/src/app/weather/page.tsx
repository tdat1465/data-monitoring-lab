import { CloudSun } from 'lucide-react';
import { getLatestWeather } from '@/lib/queries/getWeather';
import { WeatherGrid } from '@/components/weather/WeatherGrid';
import { Card, CardContent } from '@/components/ui/Card';

export const revalidate = 300;

export default async function WeatherPage() {
  let weather: Awaited<ReturnType<typeof getLatestWeather>> = [];

  try {
    weather = await getLatestWeather();
  } catch (err) {
    console.error('Failed to load weather:', err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <CloudSun className="w-8 h-8 text-yellow-500" />
          Thời tiết realtime
        </h1>
        <p className="text-gray-500 mt-1">
          Dữ liệu METAR từ NOAA — Cập nhật mỗi 30 phút
        </p>
      </div>

      {weather.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Không có dữ liệu thời tiết. Vui lòng kiểm tra kết nối database.
          </CardContent>
        </Card>
      ) : (
        <WeatherGrid weather={weather} />
      )}

      <Card>
        <CardContent className="text-sm text-gray-500 space-y-1">
          <p className="font-medium text-gray-700">Về dữ liệu METAR</p>
          <p>
            METAR (METeorological Aerodrome Report) là bản tin thời tiết hàng không tiêu chuẩn
            được cung cấp bởi NOAA Aviation Weather Center.
          </p>
          <p>
            <span className="text-green-600">● Tầm nhìn &gt; 5 dặm</span> — Điều kiện tốt.{' '}
            <span className="text-yellow-600">● Tầm nhìn 3–5 dặm</span> — Có thể ảnh hưởng.{' '}
            <span className="text-red-600">● Tầm nhìn &lt; 3 dặm</span> — Nguy cơ trễ cao.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
