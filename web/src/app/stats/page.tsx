import { getFlightsWithPredictions } from '@/lib/queries/getFlights';
import { getWeatherHistory } from '@/lib/queries/getWeather';
import { StatsClient } from './StatsClient';

export const revalidate = 300;

export default async function StatsPage() {
  let flights: Awaited<ReturnType<typeof getFlightsWithPredictions>> = [];
  let rawWeatherHistory: Awaited<ReturnType<typeof getWeatherHistory>> = [];

  try {
    flights = await getFlightsWithPredictions();
    rawWeatherHistory = await getWeatherHistory();
  } catch (err) {
    console.error('Failed to load stats:', err);
  }

  return <StatsClient flights={flights} rawWeatherHistory={rawWeatherHistory} />;
}
