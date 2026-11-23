"use client";

// PROTOTYPE — throwaway. Picks the background variant from ?v= and mounts the switcher.

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import HeroShell from "./HeroShell";
import Switcher from "./Switcher";
import { useOsReducedMotion } from "./lab";
import { VARIANTS } from "./variants";

export default function LabHero() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const found = VARIANTS.findIndex((v) => v.id === params.get("v"));
  const index = found === -1 ? 0 : found;
  const variant = VARIANTS[index];

  const osReduced = useOsReducedMotion();
  const [toggles, setToggles] = useState({ hideCopy: false, hideCar: false, reducedMotion: false, hideBar: false });
  const onToggle = useCallback((key: keyof typeof toggles) => setToggles((t) => ({ ...t, [key]: !t[key] })), []);
  const onSelect = useCallback(
    (i: number) => router.replace(`${pathname}?v=${VARIANTS[i].id}`, { scroll: false }),
    [router, pathname],
  );

  const reducedMotion = osReduced || toggles.reducedMotion;
  const Background = variant.Component;

  return (
    <>
      <HeroShell
        // Remount per variant (and per motion mode) so each starts from a clean slate.
        key={`${variant.id}-${reducedMotion}`}
        background={<Background />}
        reducedMotion={reducedMotion}
        hideCopy={toggles.hideCopy}
        hideCar={toggles.hideCar}
      />
      {process.env.NODE_ENV !== "production" && (
        <Switcher variants={VARIANTS} index={index} onSelect={onSelect} toggles={toggles} onToggle={onToggle} />
      )}
    </>
  );
}
