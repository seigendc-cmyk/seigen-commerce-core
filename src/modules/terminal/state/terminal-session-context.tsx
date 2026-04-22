"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TerminalProfile, TerminalSession, TerminalShift } from "../types/terminal-types";
import { resolveTerminalProfileForEntry, verifyTerminalEntryPin } from "../services/terminal-access-service";
import {
  endTerminalSession,
  getPersistedActiveSession,
  revokeTerminalSession,
  startTerminalSession,
  touchTerminalSession,
} from "../services/terminal-session-service";
import { getOpenTerminalShift } from "../services/terminal-shift-service";

export type TerminalSessionContextValue = {
  accessCode: string;
  loading: boolean;
  error: string | null;
  profile: TerminalProfile | null;
  session: TerminalSession | null;
  openShift: TerminalShift | null;
  online: boolean;
  refreshShift: () => void;
  authenticateWithPin: (pin: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => void;
  terminalAllows: (key: string) => boolean;
};

const Ctx = createContext<TerminalSessionContextValue | null>(null);

export function useTerminalSession(): TerminalSessionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTerminalSession must be used under TerminalSessionProvider");
  return v;
}

function useOnlineFlag(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

export function TerminalSessionProvider({
  accessCode,
  children,
}: {
  accessCode: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const online = useOnlineFlag();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TerminalProfile | null>(null);
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [shiftTick, setShiftTick] = useState(0);

  const refreshShift = useCallback(() => setShiftTick((t) => t + 1), []);

  const openShift = useMemo(() => {
    void shiftTick;
    if (!profile) return null;
    return getOpenTerminalShift(profile.id);
  }, [profile, shiftTick]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const resolved = resolveTerminalProfileForEntry(accessCode);
    if (!resolved.ok) {
      if (!cancelled) {
        setProfile(resolved.profile ?? null);
        setSession(null);
        setError(resolved.error);
        setLoading(false);
      }
      return;
    }
    const p = resolved.profile;
    let existing = getPersistedActiveSession(p);
    if (!existing && !p.requiresPin) {
      existing = startTerminalSession(p, "code");
    }
    if (!cancelled) {
      setProfile(p);
      setSession(existing);
      setError(null);
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [accessCode]);

  useEffect(() => {
    if (!profile || !session) return;
    touchTerminalSession(session);
  }, [profile, session, pathname]);

  useEffect(() => {
    const onProfiles = () => {
      const resolved = resolveTerminalProfileForEntry(accessCode);
      if (resolved.ok) {
        setProfile(resolved.profile);
        setSession((cur) => {
          if (!cur) return cur;
          if (cur.sessionStatus !== "active" || cur.endedAt) return null;
          if (cur.profileUpdatedAtSnapshot && cur.profileUpdatedAtSnapshot !== resolved.profile.updatedAt) {
            revokeTerminalSession(resolved.profile, cur, "Profile changed since session start");
            return null;
          }
          return cur;
        });
      }
    };
    window.addEventListener("seigen-terminal-profiles-updated", onProfiles);
    return () => window.removeEventListener("seigen-terminal-profiles-updated", onProfiles);
  }, [accessCode]);

  const shiftRequiredRedirect = useMemo(() => {
    if (!profile || !session || !pathname) return false;
    const base = `/terminal/${accessCode}`;
    if (!pathname.startsWith(base)) return false;
    if (pathname === `${base}/shift` || pathname.startsWith(`${base}/shift`)) return false;
    return !openShift;
  }, [profile, session, pathname, openShift, accessCode]);

  useEffect(() => {
    if (!shiftRequiredRedirect) return;
    router.replace(`/terminal/${accessCode}/shift`);
  }, [shiftRequiredRedirect, router, accessCode]);

  const authenticateWithPin = useCallback(
    async (pin: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (!profile) return { ok: false, message: "Terminal not loaded." };
      const okPin = await verifyTerminalEntryPin(profile, pin);
      if (!okPin) return { ok: false, message: "Incorrect PIN." };
      const next = startTerminalSession(profile, "pin");
      setSession(next);
      return { ok: true };
    },
    [profile],
  );

  const signOut = useCallback(() => {
    if (profile && session) endTerminalSession(profile, session);
    setSession(null);
  }, [profile, session]);

  const terminalAllows = useCallback(
    (key: string) => {
      if (!profile) return false;
      if (session?.permissionsSnapshot) return session.permissionsSnapshot.includes(key);
      return profile.permissions.includes(key);
    },
    [profile, session],
  );

  const value = useMemo<TerminalSessionContextValue>(
    () => ({
      accessCode,
      loading,
      error,
      profile,
      session,
      openShift,
      online,
      refreshShift,
      authenticateWithPin,
      signOut,
      terminalAllows,
    }),
    [
      accessCode,
      loading,
      error,
      profile,
      session,
      openShift,
      online,
      refreshShift,
      authenticateWithPin,
      signOut,
      terminalAllows,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
