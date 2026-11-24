"use client";

import { useState } from "react";

import { listDares, type DareEntry } from "@/lib/dareLog";

// The team's view of the dare log on /dares/update. Unlocking and refreshing
// are the same request: the relay checks the team password and returns the
// log, so a password that works always comes with the log it unlocked. The
// password lives in memory only; a reload or lock() asks for it again.

export type DareLog = { entries: DareEntry[]; at: Date };

/** Unlocked: the password the relay accepted, and the log as of its last load. */
type Session = { password: string; log: DareLog };

export function useDareLog() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (password: string) => {
    setLoading(true);
    setError(null);
    const result = await listDares(password);
    setLoading(false);
    if (result.ok) setSession({ password, log: { entries: result.entries, at: new Date() } });
    else setError(result.message);
  };

  return {
    session,
    loading,
    error,
    unlock: load,
    refresh: () => (session ? load(session.password) : undefined),
    lock: () => {
      setSession(null);
      setError(null);
    },
  };
}
