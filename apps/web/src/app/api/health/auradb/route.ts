import { NextResponse } from 'next/server';
import { getAuraDBDriver, checkAuraDBHealth } from '@/lib/auradb';

export async function GET() {
  const driver = getAuraDBDriver();
  const isHealthy = checkAuraDBHealth() && driver !== null;
  
  if (isHealthy) {
    return NextResponse.json({ status: 'healthy' }, { status: 200 });
  } else {
    return NextResponse.json({ status: 'degraded' }, { status: 503 });
  }
}
