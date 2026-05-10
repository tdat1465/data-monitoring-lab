import { NextResponse } from 'next/server';
import { getLatestWeather } from '@/lib/queries/getWeather';

export async function GET() {
  try {
    const weather = await getLatestWeather();
    return NextResponse.json(
      {
        data: weather,
        meta: {
          count: weather.length,
          last_updated: weather[0]?.report_time_vn ?? null,
        },
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      }
    );
  } catch (error) {
    console.error('[API /weather]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
