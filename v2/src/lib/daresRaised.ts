"use client";

import { useSyncExternalStore } from "react";

import { relayHttpUrl } from "@/lib/relay";

// The Giving Tuesday total. Blackbaud gives us no way to read gifts, so a team
// member types the total into /dares/update, which stores it on the live relay
// (live-relay/src/dares.ts, team password). Pages read it back from GET /dares,
// which the relay's edge caches for 30 s.
//
// One store for the whole page: however many components show the total (the
// site-wide bar, the meter on /dares, the update page), there is one request
// and one timer, running while at least one of them is mounted. The value
// outlives them, so the next page starts with it.

const ENDPOINT = relayHttpUrl("/dares");
const REFRESH_MS = 60_000;

export type Raised = { raised: number; updatedAt: string | null };

/**
 * Milestones along the bar, in dollars, smallest first. The last one is the
 * goal. A label (what the team does when it's reached) shows under the bar if given.
 */
export const DARES_MILESTONES: { amount: number; label?: string }[] = [
  { amount: 2500 },
  { amount: 5000 },
  { amount: 7500 },
  { amount: 10000 },
];

function parseRaised(value: unknown): Raised | null {
  if (typeof value !== "object" || value === null) return null;
  const { raised, updatedAt } = value as Record<string, unknown>;
  if (typeof raised !== "number" || !Number.isFinite(raised) || raised < 0) return null;
  return { raised, updatedAt: typeof updatedAt === "string" ? updatedAt : null };
}

let current: Raised | null = null;
const listeners = new Set<() => void>();
let timer: number | undefined;

function publish(value: Raised) {
  current = value;
  listeners.forEach((notify) => notify());
}

async function load() {
  try {
    const response = await fetch(ENDPOINT);
    const value = response.ok ? parseRaised(await response.json()) : null;
    if (value) publish(value);
  } catch {
    // Offline or the relay is down: keep whatever we last had.
  }
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  if (listeners.size === 1) {
    void load();
    timer = window.setInterval(load, REFRESH_MS);
  }
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) window.clearInterval(timer);
  };
}

/** The total, refreshed once a minute. null until it first loads (and on the server). */
export function useDaresRaised(): Raised | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

export type SaveResult = { ok: true; value: Raised } | { ok: false; message: string };

/**
 * Sets the total (POST /dares) with the team password. On success every
 * component showing the total updates at once, without waiting for the timer.
 */
export async function saveDaresRaised(password: string, raised: number): Promise<SaveResult> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, raised }),
    });
    const body: unknown = await response.json().catch(() => null);
    const value = response.ok ? parseRaised(body) : null;
    if (value) {
      publish(value);
      return { ok: true, value };
    }
    const error = (body as { error?: unknown } | null)?.error;
    return {
      ok: false,
      message: typeof error === "string" ? error : `Didn't save (error ${response.status}).`,
    };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection." };
  }
}
