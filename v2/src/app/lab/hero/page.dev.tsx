// PROTOTYPE — throwaway. /lab/hero?v=<id> compares background treatments for the
// landing-page hero (components/Hero.tsx) against the real navbar, car and copy.
// Dev only: 404s in production builds. Delete src/app/lab once a background is chosen.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import StatsSection from "@/components/StatsSection";
import SponsorsMarquee from "@/components/SponsorsMarquee";
import Footer from "@/components/Footer";
import LabHero from "./LabHero";

export const metadata: Metadata = {
  title: "Hero background lab",
  robots: { index: false, follow: false },
};

export default function HeroLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <Navbar />
      <Suspense>
        <LabHero />
      </Suspense>
      {/* Same sections as the home page, so scroll-reactive variants get the real scroll length. */}
      <StatsSection />
      <SponsorsMarquee />
      <Footer />
    </>
  );
}
