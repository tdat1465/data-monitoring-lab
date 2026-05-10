import { NextRequest, NextResponse } from 'next/server';
import { getFlightsWithPredictions } from '@/lib/queries/getFlights';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  const source = searchParams.get('source');
  const direction = searchParams.get('direction');
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const sortBy = (searchParams.get('sortBy') ?? 'scheduled_dt') as keyof Record<string, unknown>;
  const sortOrder = searchParams.get('sortOrder') ?? 'asc';
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '50');

  try {
    let flights = await getFlightsWithPredictions(date);

    if (source) flights = flights.filter((f) => f.source_airport === source);
    if (direction) flights = flights.filter((f) => f.direction === direction);
    if (status) flights = flights.filter((f) => f.status_group === status);
    if (search)
      flights = flights.filter((f) =>
        f.flight_number.toLowerCase().includes(search.toLowerCase())
      );

    flights.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a];
      const bVal = b[sortBy as keyof typeof b];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortOrder === 'asc'
        ? aVal < bVal
          ? -1
          : 1
        : aVal > bVal
          ? -1
          : 1;
    });

    const total = flights.length;
    const offset = (page - 1) * limit;
    const paginated = flights.slice(offset, offset + limit);

    return NextResponse.json(
      {
        data: paginated,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          last_updated: flights[0]?.predicted_at ?? null,
        },
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      }
    );
  } catch (error) {
    console.error('[API /flights]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
