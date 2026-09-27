"use client";

import { useSyncExternalStore } from "react";

// The host's password and whether they asked to stream, kept in sessionStorage:
// a reload mid-race picks up where it was, but closing the tab forgets the
// password (nothing is left behind on a borrowed laptop). Read through
// useSyncExternalStore so the prerendered page (no storage) and the browser
// agree during hydration.

const KEYS = { password: "hostPassword", streaming: "hostStreaming" } as const;
type Key = keyof typeof KEYS;

const listeners = new Set<() => void>();

function read(key: Key): string | null {
  try {
    return window.sessionStorage.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

export function setHostSession(key: Key, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(KEYS[key]);
    else window.sessionStorage.setItem(KEYS[key], value);
  } catch {
    // Storage blocked: the value lasts until the page closes, via memory below.
  }
  memory[key] = value;
  listeners.forEach((listener) => listener());
}

const memory: Record<Key, string | null | undefined> = { password: undefined, streaming: undefined };

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useHostSession(key: Key): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (memory[key] !== undefined ? memory[key] ?? null : read(key)),
    () => null,
  );
}
