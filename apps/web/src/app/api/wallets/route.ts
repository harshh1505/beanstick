import { NextRequest, NextResponse } from 'next/server';
import {
  getWalletsForParent,
  createWallet,
  deleteWallet,
  updateWalletLabel,
  updateWalletAgentStatus
} from '@/lib/db/wallets';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parent = searchParams.get('parent');

  if (!parent) {
    return NextResponse.json({ error: 'parent address required' }, { status: 400 });
  }

  const wallets = getWalletsForParent(parent);
  return NextResponse.json({ wallets });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { address, label, parentAddress } = body;

  if (!address || !parentAddress) {
    return NextResponse.json({ error: 'address and parentAddress required' }, { status: 400 });
  }

  const wallet = createWallet(address, label || 'Wallet', parentAddress);
  return NextResponse.json({ wallet });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, label, hasAgents } = body;

  if (!id) {
    return NextResponse.json({ error: 'wallet id required' }, { status: 400 });
  }

  if (label !== undefined) {
    updateWalletLabel(id, label);
  }
  if (hasAgents !== undefined) {
    updateWalletAgentStatus(id, hasAgents);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'wallet id required' }, { status: 400 });
  }

  const deleted = deleteWallet(id);
  return NextResponse.json({ deleted });
}
