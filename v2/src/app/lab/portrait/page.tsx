// PROTOTYPE — throwaway. /lab/portrait compares framing options for the phone
// (4:5 portrait) renders of /car, played through the whole sequence side by side
// with today's letterboxed 16:9 frames:
//
//   k055  K 0.55 everywhere - the whole car fits every shot
//   k070  K 0.70 everywhere - bigger closeups, side views clip
//   kvar  K per shot, changing only where the camera orbits or has nearly stopped
//
// K is how wide the phone camera sees (the portrait frame's vertical field of
// view is 1/K times the desktop frame's). The previews are low-quality Blender
// renders in public/renders-sr26/portrait-preview/<option>/, which is not
// committed. See artifacts/render_profile.py.
//
// Dev only: 404s in production builds unless built with LAB_BUILD=1. Delete
// src/app/lab/portrait once an option is chosen.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PortraitLab from "./PortraitLab";

export const metadata: Metadata = {
  title: "Portrait framing lab",
  robots: { index: false, follow: false },
};

export default function PortraitLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.LAB_BUILD !== "1") notFound();
  return <PortraitLab />;
}
