// apps/web/src/lib/db/lp-registrations.ts
//
// JSON file-based storage for LP rail registrations (G.12.1)
// In production, migrate to SQLite or Postgres.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LpProfile, LpRailRegistration, RailType } from '../../types/lp';

const DATA_DIR = process.env.BEANSTICK_DATA_DIR || '/tmp/beanstick';
const LP_PROFILES_FILE = path.join(DATA_DIR, 'lp-profiles.json');
const RAIL_REGISTRATIONS_FILE = path.join(DATA_DIR, 'rail-registrations.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err);
  }
  return defaultValue;
}

function writeJson<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function computeReceiverCommitment(canonicalPayload: string): string {
  return '0x' + crypto.createHash('sha256').update(canonicalPayload).digest('hex');
}

export function computeQrCommitment(qrPayload: string): string {
  return '0x' + crypto.createHash('sha256').update(qrPayload).digest('hex');
}

export function canonicalizeReceiverPayload(railType: RailType, details: Record<string, string>): string {
  const parts: string[] = [railType];
  const sortedKeys = Object.keys(details).sort();
  for (const key of sortedKeys) {
    parts.push(`${key}=${details[key]}`);
  }
  return parts.join('|').toLowerCase();
}

export function getLpProfiles(): Record<string, LpProfile> {
  return readJson<Record<string, LpProfile>>(LP_PROFILES_FILE, {});
}

export function getLpProfile(walletAddress: string): LpProfile | null {
  const profiles = getLpProfiles();
  return profiles[walletAddress.toLowerCase()] || null;
}

export function saveLpProfile(profile: LpProfile): void {
  const profiles = getLpProfiles();
  profiles[profile.walletAddress.toLowerCase()] = profile;
  writeJson(LP_PROFILES_FILE, profiles);
}

export function createLpProfile(walletAddress: string, axlPubkey: string): LpProfile {
  const profile: LpProfile = {
    walletAddress: walletAddress.toLowerCase(),
    axlPubkey,
    registeredAt: Date.now(),
    active: true,
    reputation: {
      score: 100,
      totalTrades: 0,
      completionRate: 1.0,
      averageSettleTimeSeconds: 0,
      slashCount: 0,
    },
  };
  saveLpProfile(profile);
  return profile;
}

export function getRailRegistrations(): Record<string, LpRailRegistration> {
  return readJson<Record<string, LpRailRegistration>>(RAIL_REGISTRATIONS_FILE, {});
}

export function getRailRegistration(id: string): LpRailRegistration | null {
  const registrations = getRailRegistrations();
  return registrations[id] || null;
}

export function getRailRegistrationsForLp(lpId: string): LpRailRegistration[] {
  const registrations = getRailRegistrations();
  return Object.values(registrations).filter(r => r.lpId === lpId.toLowerCase());
}

export function getRailRegistrationByCommitment(receiverCommitment: string): LpRailRegistration | null {
  const registrations = getRailRegistrations();
  return Object.values(registrations).find(r => r.receiverCommitment === receiverCommitment) || null;
}

export function saveRailRegistration(registration: LpRailRegistration): void {
  const registrations = getRailRegistrations();
  registrations[registration.id] = registration;
  writeJson(RAIL_REGISTRATIONS_FILE, registrations);
}

export function createRailRegistration(
  lpId: string,
  railType: RailType,
  details: {
    receiverLabel: string;
    beneficiaryName: string;
    receiverPayload: Record<string, string>;
    qrPayload?: string;
    region: string;
    currency: string;
    minAmount: string;
    maxAmount: string;
    reversibilityClass: 'instant' | 'reversible' | 'final';
  }
): LpRailRegistration {
  const canonicalPayload = canonicalizeReceiverPayload(railType, details.receiverPayload);
  const receiverCommitment = computeReceiverCommitment(canonicalPayload);

  const registration: LpRailRegistration = {
    id: `rail_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    lpId: lpId.toLowerCase(),
    railType,
    receiverLabel: details.receiverLabel,
    beneficiaryName: details.beneficiaryName,
    canonicalReceiverPayload: canonicalPayload,
    receiverCommitment,
    qrPayload: details.qrPayload,
    qrCommitment: details.qrPayload ? computeQrCommitment(details.qrPayload) : undefined,
    region: details.region,
    currency: details.currency,
    minAmount: details.minAmount,
    maxAmount: details.maxAmount,
    reversibilityClass: details.reversibilityClass,
    ownershipVerificationStatus: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveRailRegistration(registration);
  return registration;
}

export function updateRailRegistrationStatus(
  id: string,
  status: 'pending' | 'verified' | 'failed'
): boolean {
  const registration = getRailRegistration(id);
  if (!registration) return false;

  registration.ownershipVerificationStatus = status;
  registration.updatedAt = Date.now();
  saveRailRegistration(registration);
  return true;
}

export function deleteRailRegistration(id: string): boolean {
  const registrations = getRailRegistrations();
  if (!registrations[id]) return false;

  delete registrations[id];
  writeJson(RAIL_REGISTRATIONS_FILE, registrations);
  return true;
}
