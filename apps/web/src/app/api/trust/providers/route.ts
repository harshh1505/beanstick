import { NextResponse } from 'next/server';
import { runQuery, getAuraDBDriver } from '@/lib/auradb';

export async function GET() {
  if (!getAuraDBDriver()) {
    return NextResponse.json({
      providers: [
        { wallet: '0xMockLP1', successRate: 100, settlementCount: 50, volume: 50000, trustScore: 98 },
        { wallet: '0xMockLP2', successRate: 90, settlementCount: 120, volume: 150000, trustScore: 85 }
      ],
      notice: 'Neo4j offline. Showing mock data.'
    });
  }

  const query = `
    MATCH (lp:LiquidityProvider)
    RETURN lp.wallet as wallet, 
           lp.successRate as successRate, 
           (lp.successCount + lp.failCount) as settlementCount,
           lp.totalVolume as volume
    ORDER BY lp.totalVolume DESC
    LIMIT 20
  `;

  try {
    const results = await runQuery(query);
    const providers = results.map(r => ({
      wallet: r.wallet,
      successRate: r.successRate || 100,
      settlementCount: r.settlementCount || 0,
      volume: r.volume || 0,
      // Mock trust score for now (full calculation is in backend)
      trustScore: ((r.successRate || 100) * 0.7) + (Math.min((r.volume || 0)/1000, 100) * 0.3)
    }));

    return NextResponse.json({ providers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
