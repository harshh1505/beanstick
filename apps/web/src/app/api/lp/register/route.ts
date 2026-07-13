// apps/web/src/app/api/lp/register/route.ts
//
// API route for LP registration

import { NextRequest, NextResponse } from 'next/server';
import { getLpProfile, createLpProfile } from '../../../../lib/db/lp-registrations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, axlPubkey } = body;

    if (!walletAddress || !axlPubkey) {
      return NextResponse.json(
        { error: 'walletAddress and axlPubkey are required' },
        { status: 400 }
      );
    }

    const existing = getLpProfile(walletAddress);
    if (existing) {
      return NextResponse.json(
        { error: 'LP already registered', profile: existing },
        { status: 409 }
      );
    }

    const profile = createLpProfile(walletAddress, axlPubkey);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error('[API] LP register error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const walletAddress = request.nextUrl.searchParams.get('walletAddress');

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'walletAddress is required' },
      { status: 400 }
    );
  }

  const profile = getLpProfile(walletAddress);
  if (!profile) {
    return NextResponse.json(
      { error: 'LP not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ profile });
}
