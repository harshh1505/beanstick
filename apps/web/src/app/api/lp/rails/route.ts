// apps/web/src/app/api/lp/rails/route.ts
//
// API route for LP rail registration and management

import { NextRequest, NextResponse } from 'next/server';
import {
  getRailRegistrationsForLp,
  createRailRegistration,
  getRailRegistration,
  updateRailRegistrationStatus,
  deleteRailRegistration,
} from '../../../../lib/db/lp-registrations';
import { RailType, ReversibilityClass, RAIL_POLICIES } from '../../../../types/lp';

export async function GET(request: NextRequest) {
  const lpId = request.nextUrl.searchParams.get('lpId');

  if (!lpId) {
    return NextResponse.json(
      { error: 'lpId is required' },
      { status: 400 }
    );
  }

  const rails = getRailRegistrationsForLp(lpId);
  return NextResponse.json({ rails });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lpId,
      railType,
      receiverLabel,
      beneficiaryName,
      receiverPayload,
      qrPayload,
      region,
      currency,
      minAmount,
      maxAmount,
    } = body;

    if (!lpId || !railType || !receiverLabel || !beneficiaryName || !receiverPayload) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const validRails: RailType[] = ['banksim', 'upi', 'venmo', 'revolut', 'ach'];
    if (!validRails.includes(railType)) {
      return NextResponse.json(
        { error: `Invalid railType. Must be one of: ${validRails.join(', ')}` },
        { status: 400 }
      );
    }

    const policy = RAIL_POLICIES[railType as RailType];
    const reversibilityClass: ReversibilityClass = policy?.reversibilityClass || 'reversible';

    const registration = createRailRegistration(lpId, railType as RailType, {
      receiverLabel,
      beneficiaryName,
      receiverPayload,
      qrPayload,
      region: region || 'global',
      currency: currency || 'USD',
      minAmount: minAmount || '1',
      maxAmount: maxAmount || '10000',
      reversibilityClass,
    });

    return NextResponse.json({ ok: true, registration });
  } catch (err) {
    console.error('[API] Rail register error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'id and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'verified', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = updateRailRegistrationStatus(id, status);
    if (!updated) {
      return NextResponse.json(
        { error: 'Rail registration not found' },
        { status: 404 }
      );
    }

    const registration = getRailRegistration(id);
    return NextResponse.json({ ok: true, registration });
  } catch (err) {
    console.error('[API] Rail update error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400 }
    );
  }

  const deleted = deleteRailRegistration(id);
  if (!deleted) {
    return NextResponse.json(
      { error: 'Rail registration not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
