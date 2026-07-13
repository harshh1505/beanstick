import { NextResponse } from 'next/server';

const AGENT_SERVER = process.env.AGENT_SERVER_URL || 'http://127.0.0.1:4002';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ rfqId: string }> }
) {
  try {
    const { rfqId } = await params;
    const url = new URL(req.url);
    const wallet = url.searchParams.get('wallet');

    const res = await fetch(`${AGENT_SERVER}/quotes/${rfqId}?wallet=${wallet}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[API /quotes] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
