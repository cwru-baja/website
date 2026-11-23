"use client";

import { useRef, useSyncExternalStore } from "react";
import Link from "next/link";

import BlackbaudForm from "@/components/BlackbaudForm";
import DonateNote from "@/components/DonateNote";
import PasteArrow from "@/components/PasteArrow";

// /donate is opened in a new tab from /support or /dares, so it is nothing but
// the form: a white page (the form is white, so it has no card edge to sit in)
// and a way back. The amount arrives in this page's query string, which
// Blackbaud's loader reads itself (see BlackbaudForm.tsx).
//
// From /dares, ?note= also carries the dare line. It is read here, once: it
// decides the Back link, shows the note card, and draws the arrow from the
// card to the form's "Other" box. The query string never changes while the
// page is open (no-op subscribe), and the static HTML has none (empty server
// snapshot), so Back says /support until hydration.
//
// Width: Blackbaud caps its own content at ~730px and centres it, so a wider
// iframe only adds white margin. 52rem minus the 2rem gutters is a 768px
// iframe, the narrowest that keeps State and ZIP on one row. The form insets
// its content ~20px (~15px on phones), so the Back link is nudged in to line
// up with it.
const noSubscribe = () => () => {};
const readNote = () => new URLSearchParams(window.location.search).get("note")?.slice(0, 1000) ?? "";

export default function DonateView() {
  const note = useSyncExternalStore(noSubscribe, readNote, () => "");
  const pageRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-[52rem] px-4 pt-4 sm:px-8 sm:pt-6">
        <Link
          href={note ? "/dares" : "/support"}
          className="ml-1.5 inline-flex min-h-11 items-center gap-2 px-2 text-sm text-neutral-500 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-900 sm:ml-3"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M13 8H3M7.5 3.5 3 8l4.5 4.5" />
          </svg>
          Back
        </Link>
      </div>

      <main ref={pageRef} className="relative mx-auto max-w-[52rem] px-4 pt-2 pb-16 sm:px-8">
        <h1 className="sr-only">Donate to CWRU Baja SAE</h1>
        {note && <DonateNote ref={cardRef} note={note} />}
        <BlackbaudForm ref={formRef} />
        {note && <PasteArrow page={pageRef} card={cardRef} form={formRef} />}
      </main>
    </div>
  );
}
