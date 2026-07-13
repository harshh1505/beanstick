// scripts/run-webhook-receiver.ts
//
// Long-running version of the §7 webhook receiver. Used in conjunction with a
// cloudflared / ngrok tunnel so KeeperHub's `Send Webhook` action can reach
// us. Order lookup is loaded from a JSON file at /tmp/beanstick-orders.json so we
// can register expected orders without restarting.

import 'dotenv/config';
import fs from 'node:fs';
import {
  createWebhookServer,
  type ExpectedOrder,
} from '../agents/payment-verify/webhook';

const PORT = Number(process.env.WEBHOOK_PORT ?? 4001);
const ORDERS_FILE = process.env.WEBHOOK_ORDERS_FILE ?? '/tmp/beanstick-orders.json';

function readOrders(): Record<string, ExpectedOrder> {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

console.log(`[receiver] orders file: ${ORDERS_FILE}`);
console.log('[receiver] starting on port', PORT);

createWebhookServer({
  port: PORT,
  skipPin: false,
  skipRelease: false,
  orderLookup: async (orderId) => readOrders()[orderId] ?? null,
});
