"use client";

import { useState } from "react";

import { formatUsd } from "@/lib/money";
import { describeDareLine, listDares, type DareEntry } from "@/lib/dareLog";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; entries: DareEntry[]; at: Date }
  | { kind: "error"; message: string };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Each dare with its price: "Pie to the face! ×2 ($7 each) + …" */
const dareText = (e: DareEntry) =>
  e.dares
    .map(
      (line) =>
        `${describeDareLine(line)} (${line.price === null ? "they name it" : `${formatUsd(line.price)} each`})`,
    )
    .join(" + ");

/** "$28", "$28 + they name it" (some dares unpriced), or "they name it" (none priced). */
const totalText = (e: DareEntry) => {
  const named = e.dares.some((d) => d.price === null);
  if (e.total === null) return "they name it";
  return named ? `${formatUsd(e.total)} + they name it` : formatUsd(e.total);
};

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

function toCsv(entries: DareEntry[]) {
  const rows = [["When", "From", "Dare", "For", "Total", "Note", "Finished form"]];
  for (const e of entries) {
    rows.push([
      e.createdAt,
      e.from,
      dareText(e),
      e.members.join(", "),
      totalText(e),
      e.message ?? "",
      e.completedAt ?? "",
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/**
 * Every dare logged from /dares, newest first, behind the team password.
 * "Finished form" means Blackbaud's form showed its thank-you on the donor's
 * page: a strong hint they paid, not proof. Check against the total.
 */
export default function DareLogList({ password }: { password: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setStatus({ kind: "loading" });
    const result = await listDares(password);
    setStatus(
      result.ok
        ? { kind: "loaded", entries: result.entries, at: new Date() }
        : { kind: "error", message: result.message },
    );
  };

  const entries = status.kind === "loaded" ? status.entries : [];
  const finished = entries.filter((e) => e.completedAt).length;

  return (
    <section className="mt-16 border-t border-white/10 pt-10" aria-labelledby="dare-log-heading">
      <h2 id="dare-log-heading" className="font-coolvetica text-2xl tracking-wide text-white uppercase">
        Dare log
      </h2>
      <p className="mt-2 max-w-xl text-sm text-white/55">
        Who dared whom, from the Donate button on /dares. &ldquo;Finished form&rdquo; means Blackbaud showed
        its thank-you page; check gifts against the total before doing a dare.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={load}
          disabled={!password || status.kind === "loading"}
          className="min-h-12 border border-white/20 px-6 font-coolvetica text-sm tracking-[0.12em] text-white uppercase hover:border-white/50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          {status.kind === "loading" ? "Loading…" : status.kind === "loaded" ? "Refresh" : "Show dares"}
        </button>
        {status.kind === "loaded" && entries.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(toCsv(entries));
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="min-h-12 px-4 text-sm text-white/60 underline underline-offset-4 hover:text-white"
          >
            {copied ? "Copied" : "Copy as CSV"}
          </button>
        )}
        {!password && <span className="text-sm text-white/45">Enter the team password above first.</span>}
      </div>

      <p role="status" className="mt-4 min-h-5 text-sm">
        {status.kind === "error" && <span className="text-livery-pop">{status.message}</span>}
        {status.kind === "loaded" && (
          <span className="text-white/55">
            {entries.length} {entries.length === 1 ? "dare" : "dares"} · {finished} finished the form · as of{" "}
            {status.at.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </p>

      {entries.length > 0 && (
        <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {entries.map((e) => (
            <li key={e.id} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr_auto] sm:gap-6">
              <span className="text-sm text-white/45 tabular-nums">{when(e.createdAt)}</span>
              <div className="min-w-0">
                <p className="break-words text-white">{dareText(e)}</p>
                <p className="mt-0.5 break-words text-sm text-white/55">
                  for {e.members.join(", ")} · from <span className="text-white">{e.from}</span>
                </p>
                {e.message && (
                  <p className="mt-2 border-l-2 border-white/15 pl-3 text-sm break-words text-white/70">
                    {e.message}
                  </p>
                )}
              </div>
              <div className="flex items-baseline gap-3 sm:flex-col sm:items-end sm:gap-1">
                <span className="font-satoshi text-white tabular-nums">{totalText(e)}</span>
                <span
                  className={`text-xs uppercase tracking-[0.12em] ${e.completedAt ? "text-livery-pop" : "text-white/35"}`}
                >
                  {e.completedAt ? "Finished form" : "Not finished"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
