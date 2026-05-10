import { NextRequest, NextResponse } from 'next/server';
import { getFlightByKey, getFlightHistory } from '@/lib/queries/getFlightByKey';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ flightKey: string }> }
) {
  try {
    const { flightKey } = await params;
    const flight = await getFlightByKey(flightKey);
    if (!flight) return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    const history = await getFlightHistory(flightKey);
    return NextResponse.json({ ...flight, history });
  } catch (error) {
    console.error('[API /flights/[key]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
