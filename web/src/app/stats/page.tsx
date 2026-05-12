import { getFlightsByDateRange } from '@/lib/queries/getFlights';
import { getWeatherHistory } from '@/lib/queries/getWeather';
import { StatsClient } from './StatsClient';

export const revalidate = 0;

export default async function StatsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ start?: string; end?: string }> 
}) {
  const params = await searchParams;
  let flights: Awaited<ReturnType<typeof getFlightsByDateRange>> = [];
  let rawWeatherHistory: Awaited<ReturnType<typeof getWeatherHistory>> = [];

  // Helper: get date string in Asia/Ho_Chi_Minh
  function getVietnamDateString(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : '';
  }
  const now = new Date();
  const todayVN = getVietnamDateString(now);
  const sevenDaysAgoVN = getVietnamDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const serverDateRange = {
    start: sevenDaysAgoVN,
    end: todayVN,
  };

  const startDate = params.start || sevenDaysAgoVN;
  const endDate = params.end || todayVN;

  try {
    flights = await getFlightsByDateRange(startDate, endDate);
    rawWeatherHistory = await getWeatherHistory(startDate, endDate);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }

  return <StatsClient flights={flights} rawWeatherHistory={rawWeatherHistory} serverDateRange={serverDateRange} />;
}