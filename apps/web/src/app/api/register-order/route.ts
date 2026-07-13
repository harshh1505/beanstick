import { NextResponse } from 'next/server';
import fs from 'node:fs';

const ORDERS_FILE = '/tmp/beanstick-orders.json';

export async function POST(req: Request) {
  const { orderId, amount, currency, receiver } = await req.json();

  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'Missing orderId' }, { status: 400 });
  }

  let orders: Record<string, any> = {};
  try {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {}

  orders[orderId] = {
    expectedAmount: amount || '100.00',
    expectedCurrency: currency || 'INR',
    expectedReceiver: receiver || 'lp@banksim',
  };

  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

  return NextResponse.json({ ok: true });
}
