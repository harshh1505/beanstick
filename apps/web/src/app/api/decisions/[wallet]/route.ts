import { NextResponse } from 'next/server';

const AGENT_SERVER = process.env.AGENT_SERVER_URL || 'http://127.0.0.1:4002';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const res = await fetch(`${AGENT_SERVER}/decisions/${wallet}`);
    if (!res.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[API /decisions] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
