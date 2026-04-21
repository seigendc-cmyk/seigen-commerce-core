"use client";

import { useLayoutEffect, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useVendorStaff } from "@/modules/dashboard/settings/staff/vendor-staff-context";
import {
  getActiveStaffId,
  SEIGEN_SUPPORT_STAFF_ID,
  setActiveStaffId,
  SYSADMIN_STAFF_ID,
} from "@/modules/desk/services/sysadmin-bootstrap";
import {
  changeStaffAccessCode,
  getStaffAccessCodeStatus,
  issueInitialStaffAccessCode,
  SEIGEN_SUPPORT_STARTUP_CODE,
  verifyStaffAccessCode,
  VENDOR_SYSADMIN_STARTUP_CODE,
} from "@/modules/dashboard/settings/staff/staff-access-codes";

const STAFF_SESSION_KEY = "seigen.staff.session";
/** Keep signed in across normal work weeks without retyping after refresh. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function readSession(): { staffId: string; verifiedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { staffId?: string; verifiedAt?: number };
    if (!o.staffId || typeof o.verifiedAt !== "number") return null;
    return { staffId: o.staffId, verifiedAt: o.verifiedAt };
  } catch {
    return null;
  }
}

function writeSession(staffId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify({ staffId, verifiedAt: Date.now() }));
  } catch {
    // ignore
  }
}

function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STAFF_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function StaffSessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { staffMembers } = useVendorStaff();
  const [staffId, setStaffId] = useState<string>(() => getActiveStaffId() ?? "");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [codesTick, setCodesTick] = useState(0);

  const staff = useMemo(() => staffMembers.find((s) => s.id === staffId) ?? null, [staffMembers, staffId]);
  const codeStatus = useMemo(
    () => (staff ? getStaffAccessCodeStatus(staff.id) : { status: "missing" as const }),
    [staff, codesTick],
  );

  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");

  useEffect(() => {
    const on = () => setCodesTick((t) => t + 1);
    window.addEventListener("seigen-staff-access-codes-updated", on);
    return () => window.removeEventListener("seigen-staff-access-codes-updated", on);
  }, []);

  useEffect(() => {
    // If no staff selected yet, pick active staff or first available once list is ready.
    if (staffId) return;
    const active = getActiveStaffId();
    const next = active ?? staffMembers[0]?.id ?? "";
    if (next) setStaffId(next);
  }, [staffId, staffMembers]);

  useLayoutEffect(() => {
    const s = readSession();
    if (!s) return;
    if (Date.now() - s.verifiedAt > SESSION_TTL_MS) {
      clearSession();
      return;
    }
    const exists = staffMembers.some((m) => m.id === s.staffId);
    if (!exists) {
      clearSession();
      return;
    }
    const st = getStaffAccessCodeStatus(s.staffId);
    if (st.status === "missing") return;
    setActiveStaffId(s.staffId);
    setStaffId(s.staffId);
    setVerified(true);
  }, [staffMembers, codesTick]);

  if (verified) return <>{children}</>;

  async function doSignIn() {
    if (!staff) return;
    setStatus(null);
    if (codeStatus.status === "missing") {
      setStatus("No access code configured yet. SysAdmin must issue an initial code in Staff settings.");
      return;
    }
    const ok = await verifyStaffAccessCode({ staffId: staff.id, code });
    if (!ok) {
      setStatus("Invalid access code.");
      return;
    }
    setActiveStaffId(staff.id);
    writeSession(staff.id);
    setVerified(true);
    router.replace("/dashboard/desk");
  }

  async function issueForSysAdmin() {
    if (!staff) return;
    const issued = await issueInitialStaffAccessCode({ staffId: staff.id, actorStaffId: "preset-sysadmin-staff" });
    setStatus(`Initial code issued: ${issued.code} (share securely). Staff must change on first login.`);
  }

  async function doChangeCode() {
    if (!staff) return;
    const r = await changeStaffAccessCode({ staffId: staff.id, oldCode, newCode });
    if (!r.ok) {
      setStatus(r.error);
      return;
    }
    setStatus("Access code changed successfully. Sign in with your new code.");
    setCode("");
    setOldCode("");
    setNewCode("");
  }

  const startupHint =
    staff?.id === SYSADMIN_STAFF_ID
      ? `Vendor SysAdmin startup code: ${VENDOR_SYSADMIN_STARTUP_CODE}`
      : staff?.id === SEIGEN_SUPPORT_STAFF_ID
        ? `seiGEN Support startup code: ${SEIGEN_SUPPORT_STARTUP_CODE}`
        : null;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(720px 420px at 12% 18%, rgb(45 212 191 / 0.16), transparent 55%), radial-gradient(560px 360px at 88% 12%, rgb(163 230 53 / 0.09), transparent 50%)",
        }}
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-4xl items-center px-4 py-8">
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-teal-50/40 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-teal-800/80">seiGEN Vendor Core</div>
            <div className="mt-1 font-heading text-lg font-semibold tracking-tight text-slate-900">Staff sign-in</div>
            <div className="mt-1 text-sm text-slate-600">
              Enter your staff access code to open your Dashboard/Desk. After sign-in you land on Desk; your session
              persists across refreshes. SysAdmin can issue/reset codes in Settings.
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs text-slate-600">
                <span className="mb-1 block font-semibold text-slate-800">Staff</span>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/25"
                  value={staffId}
                  onChange={(e) => {
                    setStaffId(e.target.value);
                    setActiveStaffId(e.target.value || null);
                    setStatus(null);
                  }}
                >
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.firstName} ${s.lastName}`.trim() || s.email || s.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-slate-600">
                <span className="mb-1 block font-semibold text-slate-800">Access code</span>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/25"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code"
                />
              </label>
            </div>

            {startupHint ? <p className="mt-3 text-xs text-slate-500">{startupHint}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500/60"
                onClick={() => void doSignIn()}
              >
                Sign in
              </button>
              {codeStatus.status === "missing" ? (
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => void issueForSysAdmin()}
                  title="Demo convenience: issue a code if missing"
                >
                  SysAdmin issue code
                </button>
              ) : null}
            </div>

            {codeStatus.status === "configured" && codeStatus.mustChange ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="text-sm font-semibold text-amber-900">First login: change your access code</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                    value={oldCode}
                    onChange={(e) => setOldCode(e.target.value)}
                    placeholder="Old code"
                  />
                  <input
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-200"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="New code"
                  />
                </div>
                <button
                  type="button"
                  className="mt-3 rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                  onClick={() => void doChangeCode()}
                >
                  Change code
                </button>
              </div>
            ) : null}

            {status ? <div className="mt-4 text-sm text-slate-700">{status}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
