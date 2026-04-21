"use client";

import { readVendorCore, writeVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";
import { SEIGEN_SUPPORT_STAFF_ID, SYSADMIN_STAFF_ID } from "@/modules/desk/services/sysadmin-bootstrap";

type StaffAccessCodeRow = {
  staffId: string;
  salt: string;
  codeHash: string;
  mustChange: boolean;
  updatedAt: string;
  updatedByStaffId: string | null;
};

type Db = { rows: StaffAccessCodeRow[] };

const KEY = "staff_access_codes";
const STARTUP_VERSION_KEY = "staff_access_startup_version";
/** Bump when default startup codes change — reapplies hashes for preset staff rows. */
const STAFF_ACCESS_STARTUP_VERSION = 3;

/** Vendor instance SysAdmin — deterministic startup (local-first). */
export const VENDOR_SYSADMIN_STARTUP_CODE = "12345678";
/** seiGEN Commerce support team — deterministic startup (local-first). */
export const SEIGEN_SUPPORT_STARTUP_CODE = "99999930";

const BOOTSTRAP_SALT = "seigen-vendor-core-v3";
/** SHA-256 hex of `${BOOTSTRAP_SALT}:${VENDOR_SYSADMIN_STARTUP_CODE}` */
const BOOT_HASH_SYSADMIN = "a37bfb9c44f0357fcc9cb6ab7cc31639563c0c13ff0cd907f3fe0f964edcc917";
/** SHA-256 hex of `${BOOTSTRAP_SALT}:${SEIGEN_SUPPORT_STARTUP_CODE}` */
const BOOT_HASH_SUPPORT = "f6e6faf0d05558c37fa67408e5b0446ac5fe0f1c8a8c89511915022829f77268";

function notifyStaffAccessCodesUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("seigen-staff-access-codes-updated"));
}

function nowIso() {
  return new Date().toISOString();
}

function getDb(): Db {
  return { rows: readVendorCore<StaffAccessCodeRow[]>(KEY, []) };
}

function setDb(db: Db) {
  writeVendorCore(KEY, db.rows);
  notifyStaffAccessCodesUpdated();
}

function randomSalt(): string {
  // short, non-secret; used to prevent simple rainbow tables in local storage
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

function newHumanCode(): string {
  // 6 digits (PIN-like) for initial access; can be changed by staff.
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashCode(salt: string, code: string): Promise<string> {
  return sha256Hex(`${salt}:${code}`);
}

export type StaffAccessCodeStatus =
  | { status: "missing" }
  | { status: "configured"; mustChange: boolean; updatedAt: string };

export function getStaffAccessCodeStatus(staffId: string): StaffAccessCodeStatus {
  const row = getDb().rows.find((r) => r.staffId === staffId);
  if (!row) return { status: "missing" };
  return { status: "configured", mustChange: row.mustChange, updatedAt: row.updatedAt };
}

/**
 * Writes deterministic startup codes for preset SysAdmin + seiGEN Support staff.
 * Synchronous so the staff gate can read codes on first paint after `VendorStaffProvider` init.
 */
export function applyStartupStaffAccessCodesIfNeededSync(): boolean {
  const current = readVendorCore<number>(STARTUP_VERSION_KEY, 0);
  if (current >= STAFF_ACCESS_STARTUP_VERSION) return false;

  const db = getDb();
  const ts = nowIso();
  const upsert = (staffId: string, codeHash: string) => {
    const row: StaffAccessCodeRow = {
      staffId,
      salt: BOOTSTRAP_SALT,
      codeHash,
      mustChange: false,
      updatedAt: ts,
      updatedByStaffId: null,
    };
    const idx = db.rows.findIndex((r) => r.staffId === staffId);
    if (idx >= 0) db.rows[idx] = row;
    else db.rows.push(row);
  };
  upsert(SYSADMIN_STAFF_ID, BOOT_HASH_SYSADMIN);
  upsert(SEIGEN_SUPPORT_STAFF_ID, BOOT_HASH_SUPPORT);
  writeVendorCore(KEY, db.rows);
  writeVendorCore(STARTUP_VERSION_KEY, STAFF_ACCESS_STARTUP_VERSION);
  notifyStaffAccessCodesUpdated();
  return true;
}

export async function issueInitialStaffAccessCode(input: {
  staffId: string;
  actorStaffId: string | null;
}): Promise<{ code: string; updatedAt: string }> {
  const code = newHumanCode();
  const salt = randomSalt();
  const codeHash = await hashCode(salt, code);
  const db = getDb();
  const ts = nowIso();
  const existingIdx = db.rows.findIndex((r) => r.staffId === input.staffId);
  const row: StaffAccessCodeRow = {
    staffId: input.staffId,
    salt,
    codeHash,
    mustChange: true,
    updatedAt: ts,
    updatedByStaffId: input.actorStaffId,
  };
  if (existingIdx >= 0) db.rows[existingIdx] = row;
  else db.rows.push(row);
  setDb(db);
  return { code, updatedAt: ts };
}

export async function verifyStaffAccessCode(input: { staffId: string; code: string }): Promise<boolean> {
  const row = getDb().rows.find((r) => r.staffId === input.staffId);
  if (!row) return false;
  const h = await hashCode(row.salt, input.code.trim());
  return h === row.codeHash;
}

export async function changeStaffAccessCode(input: {
  staffId: string;
  oldCode: string;
  newCode: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const row = db.rows.find((r) => r.staffId === input.staffId);
  if (!row) return { ok: false, error: "No access code is configured yet. Ask SysAdmin to issue one." };
  const ok = await verifyStaffAccessCode({ staffId: input.staffId, code: input.oldCode });
  if (!ok) return { ok: false, error: "Old access code is incorrect." };
  const newCode = input.newCode.trim();
  if (newCode.length < 4) return { ok: false, error: "New access code must be at least 4 characters." };
  row.salt = randomSalt();
  row.codeHash = await hashCode(row.salt, newCode);
  row.mustChange = false;
  row.updatedAt = nowIso();
  row.updatedByStaffId = input.staffId;
  setDb(db);
  return { ok: true };
}

