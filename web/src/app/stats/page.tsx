// import { getFlightsWithPredictions } from '@/lib/queries/getFlights';
// import { getWeatherHistory } from '@/lib/queries/getWeather';
// import { StatsClient } from './StatsClient';

// export const revalidate = 300;

// export default async function StatsPage() {
//   let flights: Awaited<ReturnType<typeof getFlightsWithPredictions>> = [];
//   let rawWeatherHistory: Awaited<ReturnType<typeof getWeatherHistory>> = [];

//   try {
//     flights = await getFlightsWithPredictions();
//     rawWeatherHistory = await getWeatherHistory();
//   } catch (err) {
//     console.error('Failed to load stats:', err);
//   }

//   return <StatsClient flights={flights} rawWeatherHistory={rawWeatherHistory} />;
// }


import { getFlightsWithPredictions } from '@/lib/queries/getFlights';
import { getWeatherHistory } from '@/lib/queries/getWeather';
import { StatsClient } from './StatsClient';

// Tắt cache cứng để đảm bảo khi đổi ngày trên URL, dữ liệu sẽ được fetch mới
export const revalidate = 0; 

export default async function StatsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ start?: string; end?: string }> 
}) {
  // 1. Đợi tham số từ URL
  const params = await searchParams;
  
  // 2. Thiết lập ngày mặc định
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const startDate = params.start || formatDate(sevenDaysAgo);
  const endDate = params.end || formatDate(today);

  let flights: Awaited<ReturnType<typeof getFlightsWithPredictions>> = [];
  let rawWeatherHistory: Awaited<ReturnType<typeof getWeatherHistory>> = [];

  try {
    flights = await getFlightsWithPredictions();
    rawWeatherHistory = await getWeatherHistory(startDate, endDate);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }

  return (
    <StatsClient 
      flights={flights} 
      rawWeatherHistory={rawWeatherHistory} 
      serverDateRange={{ start: startDate, end: endDate }} // Truyền ngược lại cho Client để đồng bộ UI
    />
  );
}