import { NextResponse } from 'next/server';
import { runQuery, getAuraDBDriver } from '@/lib/auradb';

export async function GET() {
  if (!getAuraDBDriver()) {
    return NextResponse.json({
      highRiskEntities: [
        { wallet: '0xMockFraud1', riskScore: 85, reasons: ['Suspicious clustering detected'] }
      ],
      notice: 'Neo4j offline. Showing mock data.'
    });
  }

  // Very simplified fraud detection query for the dashboard
  const query = `
    MATCH (lp:LiquidityProvider)
    WHERE (lp.failCount > 3 AND (tofloat(lp.failCount) / (lp.failCount + lp.successCount)) > 0.3)
    RETURN lp.wallet as wallet, 
           lp.failCount as failCount, 
           lp.successCount as successCount
    ORDER BY lp.failCount DESC
    LIMIT 10
  `;

  try {
    const results = await runQuery(query);
    const highRiskEntities = results.map(r => ({
      wallet: r.wallet,
      riskScore: 70 + (r.failCount * 2), // Rough heuristic
      reasons: [`High rate of failed settlements (${r.failCount} fails vs ${r.successCount} successes)`]
    }));

    return NextResponse.json({ highRiskEntities });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
