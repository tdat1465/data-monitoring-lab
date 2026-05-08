import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();

  try {
    const result = await query('SELECT 1 AS health_check');
    const latency = Date.now() - start;

    if (result.rows[0]?.health_check === 1) {
      return NextResponse.json(
        {
          status: 'ok',
          database: 'connected',
          latency_ms: latency,
          timestamp: new Date().toISOString(),
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return NextResponse.json(
      {
        status: 'error',
        message: 'Database query returned unexpected result',
        latency_ms: latency,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  } catch (err) {
    const latency = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown database error';

    console.error('[Health Check] Database connection failed:', message);

    return NextResponse.json(
      {
        status: 'error',
        message: `Kết nối database thất bại: ${message}`,
        latency_ms: latency,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
