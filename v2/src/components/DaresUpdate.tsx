"use client";

import { useState } from "react";

import DareLogList from "@/components/DareLogList";
import { formatWhen } from "@/lib/formatWhen";
import { formatUsd } from "@/lib/money";
import { useDareLog } from "@/lib/useDareLog";
import { saveDaresRaised, useDaresRaised, type Raised } from "@/lib/daresRaised";

// The team's page for the Giving Tuesday fundraiser: the team password first,
// then the total (to update) and the dare log side by side. useDareLog holds
// the password and the log; the relay checks the password on every request
// and locks an address out for 10 minutes after five wrong ones.

const field =
  "mt-2 block min-h-12 w-full border border-white/15 bg-transparent px-4 text-base text-white placeholder:text-white/30 focus:border-white focus:outline-none";
const primaryButton =
  "min-h-12 w-full bg-livery px-6 font-coolvetica text-sm tracking-[0.12em] text-on-livery uppercase hover:bg-livery-hover disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

export default function DaresUpdate() {
  const { session, loading, error, unlock, refresh, lock } = useDareLog();

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-coolvetica text-2xl tracking-wide text-white uppercase">Dares</h1>
        {session && (
          <button
            type="button"
            onClick={lock}
            className="min-h-11 px-2 text-sm text-white/45 underline underline-offset-4 hover:text-white"
          >
            Lock
          </button>
        )}
      </div>
      {session ? (
        <div className="mt-8 grid gap-16 xl:grid-cols-[22rem_1fr]">
          <TotalForm password={session.password} />
          <DareLogList log={session.log} loading={loading} error={error} onRefresh={refresh} />
        </div>
      ) : (
        <PasswordGate onSubmit={unlock} checking={loading} error={error} />
      )}
    </>
  );
}

function PasswordGate({
  onSubmit,
  checking,
  error,
}: {
  onSubmit: (password: string) => void;
  checking: boolean;
  error: string | null;
}) {
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (password) onSubmit(password);
      }}
      className="mt-8 max-w-md space-y-5"
    >
      <label className="block">
        <span className="text-sm text-white/70">Team password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          className={field}
        />
      </label>
      <button type="submit" disabled={!password || checking} className={primaryButton}>
        {checking ? "Checking…" : "Unlock"}
      </button>
      <p role="status" className="min-h-5 text-sm text-livery-pop">
        {error}
      </p>
    </form>
  );
}

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; value: Raised }
  | { kind: "error"; message: string };

/** Sets the total shown on /dares and in the site-wide bar. */
function TotalForm({ password }: { password: string }) {
  const current = useDaresRaised();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  // "$1,240" and "1240" both mean 1240; cents are dropped by the server's rules.
  const digits = amount.replace(/[$,\s]/g, "");
  const raised = /^\d+$/.test(digits) ? Number(digits) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (raised === null) return;
    setStatus({ kind: "saving" });
    const result = await saveDaresRaised(password, raised);
    if (result.ok) {
      setAmount("");
      setStatus({ kind: "saved", value: result.value });
    } else {
      setStatus({ kind: "error", message: result.message });
    }
  };

  return (
    <section aria-labelledby="total-heading" className="max-w-md xl:max-w-none">
      <h2 id="total-heading" className="font-coolvetica text-xl tracking-wide text-white uppercase">
        Total
      </h2>
      <p className="mt-2 text-sm text-white/55">
        Now showing{" "}
        <span className="font-satoshi font-bold text-white tabular-nums">
          {current ? formatUsd(current.raised) : "…"}
        </span>
        {current && <> · updated {current.updatedAt ? formatWhen(current.updatedAt) : "never"}</>}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <label className="block">
          <span className="text-sm text-white/70">New total raised (whole dollars)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="1240"
            autoComplete="off"
            className={field}
          />
        </label>
        <button
          type="submit"
          disabled={raised === null || status.kind === "saving"}
          className={primaryButton}
        >
          {status.kind === "saving" ? "Saving…" : "Update total"}
        </button>
        <p role="status" className="min-h-5 text-sm">
          {status.kind === "saved" && (
            <span className="text-white">
              Saved: {formatUsd(status.value.raised)}. The site shows it within a minute.
            </span>
          )}
          {status.kind === "error" && <span className="text-livery-pop">{status.message}</span>}
          {status.kind === "idle" && amount !== "" && raised === null && (
            <span className="text-white/55">Numbers only, like 1240.</span>
          )}
        </p>
      </form>
    </section>
  );
}
