"use client";

import { useEffect, useState } from "react";

import { recordDare, type DareDraft } from "@/lib/dareLog";

// Records the dare on /donate, quietly. The donor hasn't given yet, and an
// error here could cost the gift, which matters more than the dare line. So
// nothing is shown while it saves: it tries on arrival and retries a few
// times, again whenever the browser comes back online, and records the dare
// once more, finished, when Blackbaud's form shows its thank-you. Only if that
// last one fails too does the page learn about it (`unsaved`), so it can ask
// the donor to send the dare another way.
//
// Every call is the same idempotent record (lib/dareLog.ts), so the arrival
// retries and the finish can overlap in any order.

/** Blackbaud's form iframe, and the bare string it posts on its thank-you page. */
const BLACKBAUD_FORM_ORIGIN = "https://host.nxt.blackbaud.com";
const BLACKBAUD_SUCCESS_MESSAGE = "donation success ready";

/** Waits before each try, in ms. */
const ON_ARRIVAL = [0, 2_000, 5_000, 10_000];
const ON_FINISH = [0, 2_000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tries `attempt` after each delay until it succeeds, the delays run out, or `stopped()`. */
async function retry(attempt: () => Promise<boolean>, delays: number[], stopped: () => boolean) {
  for (const delay of delays) {
    await wait(delay);
    if (stopped()) return false;
    if (await attempt()) return true;
  }
  return false;
}

export function useDareRecord(draft: DareDraft | null) {
  const [unsaved, setUnsaved] = useState(false);

  useEffect(() => {
    if (!draft) return;
    let stopped = false;
    const isStopped = () => stopped;
    const record = (done: boolean) => () => recordDare(draft, done);

    void retry(record(false), ON_ARRIVAL, isStopped);
    const onOnline = () => void record(false)();

    // The message carries no gift and anyone can fake it, so the team reads
    // it as "finished the form", not as proof of payment.
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== BLACKBAUD_FORM_ORIGIN || e.data !== BLACKBAUD_SUCCESS_MESSAGE) return;
      if (!(await retry(record(true), ON_FINISH, isStopped)) && !stopped) setUnsaved(true);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("message", onMessage);
    return () => {
      stopped = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("message", onMessage);
    };
  }, [draft]);

  return { unsaved };
}
