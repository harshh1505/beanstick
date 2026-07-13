import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

const SECRET = process.env.PAYMENT_WEBHOOK_SECRET!;
const WEBHOOK_URL = process.env.WEBHOOK_RECEIVER_URL || 'http://127.0.0.1:4001/webhook/payment';

export async function POST(req: Request) {
  const { orderRefId, amount, currency } = await req.json();

  if (!orderRefId) {
    return NextResponse.json({ ok: false, error: 'Missing orderRefId' }, { status: 400 });
  }

  // Fire BankSim webhook to the real webhook receiver
  // This simulates what a PSP would send after fiat payment
  const payload = {
    orderId: orderRefId,
    amount: amount || '100.00',
    currency: currency || 'INR',
    sender: 'buyer@banksim',
    receiver: 'lp@banksim',
    transactionId: `tx-${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    rail: 'banksim',
  };

  const body = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
    });

    const text = await res.text();
    try {
      const result = JSON.parse(text);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ ok: false, error: `Webhook returned: ${text || '(empty)'}` }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
