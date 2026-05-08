import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Cast TEXT thành TIMESTAMP rồi mới timezone
    const result = await query(`
      SELECT
        scheduled_dt,
        scheduled_dt::timestamptz AT TIME ZONE '+07:00' AS scheduled_dt_vn
      FROM flights_current_snapshot
      LIMIT 3
    `);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message });
  }
}
