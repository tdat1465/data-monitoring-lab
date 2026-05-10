import { getAllFlights } from '@/lib/queries/getFlights';
import { getWeatherHistory } from '@/lib/queries/getWeather';
import { StatsClient } from './StatsClient';

export const revalidate = 0;

export default async function StatsPage() {
  let flights: Awaited<ReturnType<typeof getAllFlights>> = [];
  let rawWeatherHistory: Awaited<ReturnType<typeof getWeatherHistory>> = [];

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const serverDateRange = {
    start: formatDate(sevenDaysAgo),
    end: formatDate(today),
  };

  try {
    flights = await getAllFlights();
    rawWeatherHistory = await getWeatherHistory();
  } catch (err) {
    console.error('Failed to load stats:', err);
  }

  return <StatsClient flights={flights} rawWeatherHistory={rawWeatherHistory} serverDateRange={serverDateRange} />;
}