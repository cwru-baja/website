// PROTOTYPE — throwaway. /lab/button compares two ways of animating a press on
// the steering-wheel buttons in the cockpit still (renders-sr26/layers/cockpit-dive-0040.webp):
//
//   STYLISED — pure CSS on a masked copy of the shipped still. No new assets.
//   RENDERED — 108x108 Cycles crops of the dome descending into its collar,
//              rendered from the same camera as the still (artifacts/export-button-press.mjs).
//
// Both run off one clock so they can be compared frame for frame. The stylised
// defaults are calibrated against the rendered ladder, not guessed — see CALIBRATION
// in ButtonLab.tsx.
//
// Dev only: 404s in production builds. Delete src/app/lab/button once a treatment is chosen.
// LAB_BUILD=1 at build time lets it through, for a local `next build && next start`:
// headless Chromium never hydrates the dev server, so that is the only way to watch
// the game actually run (see artifacts/shoot-car.mjs for the same trap).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ButtonLab from "./ButtonLab";

export const metadata: Metadata = {
  title: "Button press lab",
  robots: { index: false, follow: false },
};

export default function ButtonLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.LAB_BUILD !== "1") notFound();
  return <ButtonLab />;
}
