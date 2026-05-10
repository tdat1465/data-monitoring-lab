import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const checks: Record<string, boolean> = { postgres: false };
  try {
    await query('SELECT 1');
    checks.postgres = true;
  } catch {}

  const healthy = checks.postgres;
  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
