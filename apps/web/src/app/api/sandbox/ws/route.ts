// apps/web/src/app/api/sandbox/ws/route.ts
import { NextResponse } from 'next/server';

const AXL_URL = process.env.AXL_BRIDGE_URL || 'http://127.0.0.1:9002';

export async function GET() {
  return NextResponse.json({
    message: 'WebSocket endpoint',
    hint: 'Connect via Socket.IO client',
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, payload } = body;

  try {
    switch (action) {
      case 'topology':
        const topologyRes = await fetch(`${AXL_URL}/topology`);
        return NextResponse.json(await topologyRes.json());

      case 'send':
        const sendRes = await fetch(`${AXL_URL}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Destination-Peer-Id': payload.peerId,
          },
          body: JSON.stringify(payload.message),
        });
        return NextResponse.json({ success: sendRes.ok });

      case 'mcp':
        const mcpRes = await fetch(`${AXL_URL}/mcp/${payload.peerId}/${payload.service}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.request),
        });
        return NextResponse.json(await mcpRes.json());

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
