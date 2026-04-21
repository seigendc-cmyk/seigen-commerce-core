import type { StaffDeskProfile } from "@/modules/desk/types/desk-profile";
import { dispatchDeskProfilesUpdated } from "@/modules/desk/services/desk-events";
import { readDeskDb, writeDeskDb } from "@/modules/desk/services/desk-storage";

type Db = { profiles: StaffDeskProfile[] };

function uid(): string {
  return `desk_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getDb(): Db {
  return readDeskDb<Db>("desk_profiles", { profiles: [] });
}

function setDb(db: Db) {
  writeDeskDb("desk_profiles", db);
  dispatchDeskProfilesUpdated();
}

export function listDeskProfiles(): StaffDeskProfile[] {
  return getDb()
    .profiles.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDeskProfileByStaffId(staffId: string): StaffDeskProfile | undefined {
  return getDb().profiles.find((p) => p.staffId === staffId);
}

export function upsertDeskProfile(input: Omit<StaffDeskProfile, "id" | "createdAt" | "updatedAt"> & { id?: string }): StaffDeskProfile {
  const db = getDb();
  const ts = nowIso();
  const existingIdx = db.profiles.findIndex((p) => p.staffId === input.staffId);
  if (existingIdx >= 0) {
    const prev = db.profiles[existingIdx]!;
    const next: StaffDeskProfile = {
      ...prev,
      ...input,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: ts,
    };
    db.profiles[existingIdx] = next;
    setDb(db);
    return next;
  }
  const row: StaffDeskProfile = {
    id: input.id ?? uid(),
    createdAt: ts,
    updatedAt: ts,
    ...input,
  };
  db.profiles.push(row);
  setDb(db);
  return row;
}

