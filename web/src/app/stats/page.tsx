import { getFlightsWithPredictions } from '@/lib/queries/getFlights';
import { StatsClient } from './StatsClient';

export const revalidate = 300;

export default async function StatsPage() {
  let flights: Awaited<ReturnType<typeof getFlightsWithPredictions>> = [];

  try {
    flights = await getFlightsWithPredictions();
  } catch (err) {
    console.error('Failed to load stats:', err);
  }

  return <StatsClient flights={flights} />;
}
