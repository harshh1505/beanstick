// protocol/x402/middleware.ts
//
// x402 v2 server-side Express integration. Builds an x402ResourceServer that
// talks to a remote HTTP facilitator (default: https://facilitator.x402.org)
// and exposes route-level paywalls via @x402/express.
//
// Reference: https://github.com/x402-foundation/x402  (@x402/express v2.10)

import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient, type RoutesConfig } from '@x402/core/server';
import type { RequestHandler } from 'express';

const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || 'https://www.x402.org/facilitator';

export interface RoutePaymentConfig {
  /** Human-readable price string the facilitator understands, e.g. "$0.01". */
  price: string;
  /** Recipient address (the seller / LP). */
  payTo: string;
  /** CAIP-2 network, e.g. "eip155:84532" (Base Sepolia). */
  network: `${string}:${string}`;
  /** Description shown on the paywall / 402 response. */
  description: string;
  /** How long the facilitator should hold the payment intent open. */
  maxTimeoutSeconds?: number;
}

export interface BuildMiddlewareOptions {
  /**
   * Map of `"METHOD /path"` → payment config for that route. Wildcards in the
   * path (e.g. `"GET /api/premium/*"`) are supported by @x402/express.
   */
  routes: Record<string, RoutePaymentConfig>;
  /** Override the facilitator URL (defaults to env / x402.org). */
  facilitatorUrl?: string;
  /** Bearer token / custom auth headers for a private facilitator. */
  facilitatorAuth?: () => Promise<{
    verify: Record<string, string>;
    settle: Record<string, string>;
    supported: Record<string, string>;
  }>;
  /**
   * Whether to sync supported payment kinds from the facilitator on startup.
   * Defaults to true (recommended for production). Set to false for offline
   * smoke-tests where the facilitator is unreachable.
   */
  syncFacilitatorOnStart?: boolean;
}

/**
 * Build an Express middleware that gates the configured routes behind x402
 * payments. The returned middleware is mounted with `app.use(...)`.
 */
export function buildX402Middleware(opts: BuildMiddlewareOptions): RequestHandler {
  const facilitator = new HTTPFacilitatorClient({
    url: opts.facilitatorUrl ?? FACILITATOR_URL,
    ...(opts.facilitatorAuth ? { createAuthHeaders: opts.facilitatorAuth } : {}),
  });

  // The server-side ExactEvmScheme verifies/settles on every supported network
  // by delegating to the facilitator — no signer is needed here.
  const resourceServer = new x402ResourceServer(facilitator).register(
    'eip155:*',
    new ExactEvmScheme(),
  );

  const routes: RoutesConfig = {};
  for (const [route, cfg] of Object.entries(opts.routes)) {
    (routes as Record<string, unknown>)[route] = {
      accepts: {
        scheme: 'exact',
        price: cfg.price,
        network: cfg.network,
        payTo: cfg.payTo,
        ...(cfg.maxTimeoutSeconds !== undefined
          ? { maxTimeoutSeconds: cfg.maxTimeoutSeconds }
          : {}),
      },
      description: cfg.description,
    };
  }

  return paymentMiddleware(
    routes,
    resourceServer,
    undefined,
    undefined,
    opts.syncFacilitatorOnStart ?? true,
  ) as unknown as RequestHandler;
}
