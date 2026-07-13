// apps/web/src/app/api/orders/[orderId]/proof/route.ts
//
// API route for order proof timeline (G.12.7)

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrderTimeline,
  createOrderTimeline,
  updateOrderPhase,
  setOrderEvidence,
  getPaymentEventsForOrder,
  getAttestationsForOrder,
} from '../../../../../lib/db/payment-events';
import { ProofPhase } from '../../../../../types/lp';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  let timeline = getOrderTimeline(orderId);
  if (!timeline) {
    timeline = createOrderTimeline(orderId);
  }

  const paymentEvents = getPaymentEventsForOrder(orderId);
  const attestations = getAttestationsForOrder(orderId);

  return NextResponse.json({
    timeline,
    paymentEvents,
    attestations,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  try {
    const body = await request.json();
    const { phase, txHash, details } = body;

    if (!phase) {
      return NextResponse.json(
        { error: 'phase is required' },
        { status: 400 }
      );
    }

    const validPhases: ProofPhase[] = [
      'AWAITING_LOCK',
      'LOCKED',
      'AWAITING_FIAT_DETAILS',
      'AWAITING_PAYMENT',
      'PAYMENT_OBSERVED',
      'GENERATING_PROOF',
      'PROOF_GENERATED',
      'VERIFYING_PROOF',
      'PROOF_VERIFIED',
      'RELEASING_FUNDS',
      'RELEASED',
      'PROOF_FAILED',
      'TIMEOUT',
      'DISPUTED',
    ];

    if (!validPhases.includes(phase)) {
      return NextResponse.json(
        { error: `Invalid phase. Must be one of: ${validPhases.join(', ')}` },
        { status: 400 }
      );
    }

    const timeline = updateOrderPhase(orderId, phase, { txHash, details });
    return NextResponse.json({ ok: true, timeline });
  } catch (err) {
    console.error('[API] Update proof phase error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  try {
    const body = await request.json();
    const { evidenceHash, storageRootHash } = body;

    if (!evidenceHash || !storageRootHash) {
      return NextResponse.json(
        { error: 'evidenceHash and storageRootHash are required' },
        { status: 400 }
      );
    }

    const success = setOrderEvidence(orderId, evidenceHash, storageRootHash);
    if (!success) {
      return NextResponse.json(
        { error: 'Order timeline not found' },
        { status: 404 }
      );
    }

    const timeline = getOrderTimeline(orderId);
    return NextResponse.json({ ok: true, timeline });
  } catch (err) {
    console.error('[API] Set evidence error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
