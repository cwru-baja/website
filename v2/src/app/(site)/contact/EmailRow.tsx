"use client";

import { useEffect, useRef, useState } from "react";
import * as cls from "./rows";

const COPIED_MS = 2000;

/** The email as a ledger row. A click copies the address rather than opening a
    mail app, which does nothing for anyone on webmail. */
export default function EmailRow({ number, email, blurb }: { number: string; email: string; blurb: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // No clipboard (an insecure origin, or permission denied): never claim a
      // copy that didn't happen. Hand the address to the mail app instead.
      window.location.href = `mailto:${email}`;
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <button type="button" onClick={copy} className={`${cls.row} cursor-pointer`}>
      <span className={cls.number}>{number}</span>
      <span className={cls.name}>
        EMAIL
        <span className="sr-only"> (copies the address)</span>
      </span>
      <span className={cls.blurb}>{blurb}</span>
      {/* The confirmation replaces the address in the same cell, so a copy
          moves nothing. Brighter than the handles below it: on this page the
          address is the thing people came for. */}
      <span aria-live="polite" className={`${cls.detail} ${copied ? "text-livery-ink" : "text-white/80"}`}>
        {copied ? "Copied to clipboard" : email}
      </span>
      <svg
        viewBox="4 4 16 16"
        fill="none"
        aria-hidden="true"
        className={`${cls.icon} ${copied ? "text-livery-ink" : "text-white/30"}`}
      >
        {copied ? (
          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="1.5" />
        ) : (
          <path d="M9 9V5h10v10h-4M5 9h10v10H5z" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
    </button>
  );
}
