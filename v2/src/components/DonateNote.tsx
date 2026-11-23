"use client";

import { useState, type Ref } from "react";

import { parseDareNote } from "@/lib/dareNote";

// The dare line (lib/dareNote.ts) the donor should paste into Blackbaud's
// "Other (optional)" box, shown above the form with a Copy button. We can't
// type into the cross-origin form; PasteArrow points from this card to the box.
//
// A pale teal panel with a solid livery edge (picked from six in a lab). On
// white, the livery teal is a fill only, and the Copy button takes near-black
// text on it.
const TEAL_TINT = "#E9F7F8";

export default function DonateNote({ note, ref }: { note: string; ref: Ref<HTMLElement> }) {
  const [copied, setCopied] = useState(false);
  // Shown as two lines; what's copied is the note exactly as it came.
  const parts = parseDareNote(note);

  return (
    <section
      ref={ref}
      aria-labelledby="dare-note-heading"
      className="mb-8 border-l-4 border-livery p-5 sm:mx-5 sm:p-6"
      style={{ background: TEAL_TINT }}
    >
      <h2
        id="dare-note-heading"
        className="font-coolvetica text-2xl leading-tight tracking-wide text-neutral-950 uppercase"
      >
        Paste your dare into the form
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 sm:text-base">
        Copy it, then paste it into{" "}
        <span className="font-semibold text-neutral-950">&ldquo;Other (optional)&rdquo;</span> below
        so we know who does what.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1 bg-white px-4 py-3 ring-1 ring-black/5">
          {parts ? (
            <>
              <p className="leading-snug font-medium break-words text-neutral-950 sm:text-lg">
                {parts.dares}
              </p>
              <p className="mt-0.5 text-sm break-words text-neutral-500">for {parts.who}</p>
            </>
          ) : (
            <p className="leading-snug font-medium break-words text-neutral-950 sm:text-lg">{note}</p>
          )}
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(note);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center bg-livery px-6 font-coolvetica text-sm tracking-[0.12em] text-on-livery uppercase hover:bg-livery-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950"
        >
          {/* Both labels share one grid cell and the idle one is hidden, so the
              button is always as wide as "Copied" and never jumps. */}
          <span className="grid">
            <span
              aria-hidden={copied}
              className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2.5 ${copied ? "invisible" : ""}`}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="5" y="5" width="8.5" height="8.5" />
                <path d="M11 5V2.5H2.5V11H5" />
              </svg>
              Copy
            </span>
            <span
              aria-hidden={!copied}
              className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2.5 ${copied ? "" : "invisible"}`}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8.5 6.5 12 13 4.5" />
              </svg>
              Copied
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
