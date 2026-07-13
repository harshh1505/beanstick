// agents/payment-verify/banksim.ts
// [DEMO-ONLY] Pretends to be a PSP firing a webhook after a payment lands.

import crypto from 'node:crypto';
import type { PaymentWebhookPayload } from './webhook';

export async function simulatePayment(
  webhookUrl: string,
  payload: PaymentWebhookPayload,
  secret: string = process.env.PAYMENT_WEBHOOK_SECRET ?? '',
): Promise<unknown> {
  if (!secret) throw new Error('PAYMENT_WEBHOOK_SECRET missing');
  const body = JSON.stringify(payload);
  const signature =
    'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body,
  });

  const result = await res.json();
  console.log(`[BankSim] → ${webhookUrl} status=${res.status} body=${JSON.stringify(result)}`);
  return result;
}
