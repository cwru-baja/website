"use client";

import { useState } from "react";
import Link from "next/link";

import { readStashedDare } from "@/lib/dareLog";
import { useDareRecord } from "@/lib/useDareRecord";

// Records the dare from /dares while the donor fills in the form
// (useDareRecord). It shows nothing when all is well: the form is the page.
// It only speaks up when the dare would otherwise be lost: this tab can't find
// it, or the gift went through but every save failed.
const NOTICE =
  "mb-8 border-l-4 border-livery bg-[#E9F7F8] p-5 text-sm leading-relaxed text-neutral-700 sm:mx-5 sm:p-6 sm:text-base";
const LINK = "font-semibold text-neutral-950 underline underline-offset-4";

export default function DareRecorder({ dareId }: { dareId: string }) {
  // Read once: the dare never changes while the page is open.
  const [draft] = useState(() => readStashedDare(dareId));
  const { unsaved } = useDareRecord(draft);

  if (!draft) {
    return (
      <p role="status" className={NOTICE}>
        This tab lost track of your dare. Go{" "}
        <Link href="/dares" className={LINK}>
          back to the dares
        </Link>{" "}
        and press Donate again.
      </p>
    );
  }

  if (unsaved) {
    return (
      <p role="status" className={NOTICE}>
        Thanks, {draft.from}! Your gift went through, but we couldn&rsquo;t reach our server, so{" "}
        <a href="https://www.instagram.com/cwrubaja/" target="_blank" rel="noopener" className={LINK}>
          DM your dare to @cwrubaja
        </a>{" "}
        and we&rsquo;ll make sure it happens.
      </p>
    );
  }

  return null;
}
