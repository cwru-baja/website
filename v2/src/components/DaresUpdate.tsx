"use client";

import { useState } from "react";

import { formatUsd } from "@/lib/money";
import DareLogList from "@/components/DareLogList";
import { saveDaresRaised, useDaresRaised, type Raised } from "@/lib/daresRaised";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; value: Raised }
  | { kind: "error"; message: string };

const field =
  "mt-2 block min-h-12 w-full border border-white/15 bg-transparent px-4 text-base text-white placeholder:text-white/30 focus:border-white focus:outline-none";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "never";

/**
 * Sets the Giving Tuesday total. The relay checks the team password (the one
 * /host uses) and locks an address out for 10 minutes after five wrong ones.
 * The page itself isn't secret; nothing changes without the password.
 */
export default function DaresUpdate() {
  const current = useDaresRaised();
  const [password, setPassword] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // "$1,240" and "1240" both mean 1240; cents are dropped by the server's rules.
  const digits = amount.replace(/[$,\s]/g, "");
  const raised = /^\d+$/.test(digits) ? Number(digits) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (raised === null || !password) return;
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
    <>
      <div className="mt-6 max-w-md">
        <p className="text-sm text-white/55">
          Now showing{" "}
          <span className="font-satoshi font-bold text-white tabular-nums">
            {current ? formatUsd(current.raised) : "…"}
          </span>
          {current && <> · updated {when(current.updatedAt)}</>}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
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
          <label className="block">
            <span className="text-sm text-white/70">Team password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={field}
            />
          </label>
          <button
            type="submit"
            disabled={raised === null || !password || status.kind === "saving"}
            className="min-h-12 w-full bg-livery px-6 font-coolvetica text-sm tracking-[0.12em] text-on-livery uppercase hover:bg-livery-hover disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
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
      </div>
      <DareLogList password={password} />
    </>
  );
}
