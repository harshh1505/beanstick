import { NextResponse } from 'next/server';

const AGENT_SERVER = process.env.AGENT_SERVER_URL || 'http://127.0.0.1:4002';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${AGENT_SERVER}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error('[API /commit] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
