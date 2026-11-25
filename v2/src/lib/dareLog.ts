import type { Dare } from "@/lib/dares";
import { relayHttpUrl } from "@/lib/relay";

// The dare log: who dared whom, recorded on the live relay (live-relay/src/dares.ts)
// because the Blackbaud form's "Other" box never reaches the team.
//
// /dares builds the dare and hands it to /donate through localStorage, under
// an id that is the only thing in /donate's URL. Blackbaud's loader sends the
// page's whole URL to Blackbaud (its `host` parameter), so the donor's name
// must never be in it. /donate records the dare (useDareRecord.ts), and records
// it again, finished, when the form says "donation success ready". That message
// carries no gift and can be faked, so the team reads it as "finished the
// form", not as proof of payment.
//
// The key, made with the dare, is what lets this browser (and only it) mark
// that dare's form as finished.

// ---- Wire contract (mirror of live-relay/src/state.ts) ----------------------

/** One dare as the donor built it on /dares. */
export type DareDraft = {
  id: string;
  key: string;
  from: string;
  /** How to reach the donor; required on /dares, checked for shape only (looksLikeEmail). */
  email: string;
  members: string[];
  /** Each dare, its times, and its price per person in dollars (null: the member names it). */
  dares: DareLine[];
  /** What the priced dares cost for everyone picked, in dollars. null when none are priced. */
  total: number | null;
  /** Anything else the donor wants the team to know, or null. */
  message: string | null;
};

export type DareLine = { title: string; count: number; price: number | null };

/** A finished dare, as /dares/update lists it. */
export type DareEntry = Omit<DareDraft, "key" | "email"> & {
  /** null on dares logged before /dares asked for an email. */
  email: string | null;
  createdAt: string;
  /** When the Blackbaud form reported success on the donor's page. */
  completedAt: string;
};

/**
 * Something@something.tld: catches blanks and keyboard mashing, not made-up
 * addresses. Mirror of EMAIL_PATTERN in live-relay/src/state.ts, which has the
 * final say; change both together.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const looksLikeEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

// ---- Building and describing a dare -----------------------------------------

/** The board's picks as dare lines. A custom dare carries its text in its title. */
export function buildDareLines(chosen: { dare: Dare; count: number }[], customText: string): DareLine[] {
  return chosen.map(({ dare, count }) => ({
    title: dare.price === null ? `Custom dare: ${customText.trim()}` : dare.title,
    count,
    price: dare.price,
  }));
}

/** "Pie to the face! ×2" */
export const describeDareLine = ({ title, count }: DareLine) => (count > 1 ? `${title} ×${count}` : title);

/** "Pie to the face! ×2 + Spicy ramen challenge" */
export const describeDares = (lines: DareLine[]) => lines.map(describeDareLine).join(" + ");

/** A new dare with a fresh id and key. */
export function newDareDraft(fields: Omit<DareDraft, "id" | "key">): DareDraft {
  const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return { id: crypto.randomUUID(), key, ...fields };
}

// ---- Handing it from /dares to /donate --------------------------------------

const STORAGE_PREFIX = "dare:";
const KEEP_MS = 7 * 24 * 60 * 60_000;

/** Leaves the dare for /donate to pick up, and clears out week-old ones. */
export function stashDare(draft: DareDraft) {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const name = localStorage.key(i);
      if (!name?.startsWith(STORAGE_PREFIX)) continue;
      const at = (JSON.parse(localStorage.getItem(name) ?? "null") as { at?: number } | null)?.at;
      if (typeof at !== "number" || now - at > KEEP_MS) localStorage.removeItem(name);
    }
    localStorage.setItem(STORAGE_PREFIX + draft.id, JSON.stringify({ at: now, draft }));
  } catch {
    // Storage off or full: /donate will say it couldn't find the dare.
  }
}

/** The dare /dares left under this id, or null. */
export function readStashedDare(id: string): DareDraft | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_PREFIX + id) ?? "null") as {
      draft?: DareDraft;
    } | null;
    return stored?.draft?.id === id ? stored.draft : null;
  } catch {
    return null;
  }
}

// ---- Talking to the relay ---------------------------------------------------

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const response = await fetch(relayHttpUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

/**
 * Records the dare, or marks it finished. Safe to repeat and to send in
 * either order: the relay keeps the first copy and the first finish.
 */
export async function recordDare(draft: DareDraft, finished: boolean): Promise<boolean> {
  return (await post("/dares/log", { ...draft, finished })).ok;
}

/** The finished dares, newest first, for the team (the team password). */
export async function listDares(
  password: string,
): Promise<{ ok: true; entries: DareEntry[] } | { ok: false; message: string }> {
  const r = await post("/dares/log/list", { password });
  const body = r.body as { entries?: DareEntry[]; error?: unknown } | null;
  if (r.ok && Array.isArray(body?.entries)) return { ok: true, entries: body.entries };
  if (typeof body?.error === "string") return { ok: false, message: body.error };
  return {
    ok: false,
    message:
      r.status === 0
        ? "Couldn't reach the server. Check your connection."
        : `Couldn't load (error ${r.status}).`,
  };
}
