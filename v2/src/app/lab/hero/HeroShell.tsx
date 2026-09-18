"use client";

// PROTOTYPE — throwaway. A copy of components/Hero.tsx with the aurora layers and
// glow pulled out into a `background` slot, so each /lab/hero variant draws the
// whole backdrop. Keep the markup in step with Hero.tsx while the lab exists.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import carSr26 from "../../../../public/homepage-car-sr26.png";
import { LabContext, emptyGeometry, type HeroGeometry } from "./lab";

// Car body inside homepage-car-sr26.png (4200x3000), measured from its alpha
// channel: bounding box and alpha centroid as fractions of the image. gx/gy is
// the middle of the three visible tyre contact patches (eyeballed at 1440x900).
const CAR_IN_PNG = { x0: 0.013, y0: 0.011, x1: 0.957, y1: 0.987, cx: 0.5, cy: 0.544, gx: 0.517, gy: 0.88 };
const PNG_ASPECT = 4200 / 3000;

export default function HeroShell({
  background,
  reducedMotion,
  hideCopy,
  hideCar,
}: {
  background: ReactNode;
  reducedMotion: boolean;
  hideCopy: boolean;
  hideCar: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const carBoxRef = useRef<HTMLDivElement>(null);
  const geometry = useRef<HeroGeometry>(emptyGeometry());

  useEffect(() => {
    const section = sectionRef.current!;
    const bg = bgRef.current!;
    const carBox = carBoxRef.current!;
    const g = geometry.current;
    const written: Record<string, number> = {};
    const write = (name: string, value: number, eps = 0.25) => {
      if (written[name] !== undefined && Math.abs(written[name] - value) < eps) return;
      written[name] = value;
      bg.style.setProperty(name, name === "--pointer" || name === "--scroll" ? value.toFixed(4) : `${value.toFixed(1)}px`);
    };

    const measure = () => {
      const s = section.getBoundingClientRect();
      const b = carBox.getBoundingClientRect();
      g.width = s.width;
      g.height = s.height;
      // object-contain, object-position: left center
      const scale = Math.min(b.width / PNG_ASPECT, b.height);
      const iw = scale * PNG_ASPECT;
      const ih = scale;
      const ix = b.left - s.left;
      const iy = b.top - s.top + (b.height - ih) / 2;
      g.car = {
        l: ix + CAR_IN_PNG.x0 * iw,
        t: iy + CAR_IN_PNG.y0 * ih,
        w: (CAR_IN_PNG.x1 - CAR_IN_PNG.x0) * iw,
        h: (CAR_IN_PNG.y1 - CAR_IN_PNG.y0) * ih,
        cx: ix + CAR_IN_PNG.cx * iw,
        cy: iy + CAR_IN_PNG.cy * ih,
        floor: iy + CAR_IN_PNG.y1 * ih,
        gx: ix + CAR_IN_PNG.gx * iw,
        gy: iy + CAR_IN_PNG.gy * ih,
      };
      write("--hero-w", g.width);
      write("--hero-h", g.height);
      write("--car-l", g.car.l);
      write("--car-t", g.car.t);
      write("--car-w", g.car.w);
      write("--car-h", g.car.h);
      write("--car-cx", g.car.cx);
      write("--car-cy", g.car.cy);
      write("--car-floor", g.car.floor);
      write("--car-gx", g.car.gx);
      write("--car-gy", g.car.gy);
    };
    measure();
    g.pointer.x = g.car.cx;
    g.pointer.y = g.car.cy;
    const ro = new ResizeObserver(measure);
    ro.observe(section);
    ro.observe(carBox);

    // Pointer target; the loop eases toward it so CSS variants get smooth motion for free.
    let tx = g.car.cx;
    let ty = g.car.cy;
    let over = false;
    const onMove = (e: PointerEvent) => {
      const s = section.getBoundingClientRect();
      tx = e.clientX - s.left;
      ty = e.clientY - s.top;
      over = true;
      kick();
    };
    const onLeave = () => {
      over = false;
      kick();
    };
    const onScroll = () => kick();
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * 6);
      const goalX = over ? tx : g.car.cx;
      const goalY = over ? ty : g.car.cy;
      g.pointer.x += (goalX - g.pointer.x) * k;
      g.pointer.y += (goalY - g.pointer.y) * k;
      g.pointer.active += ((over ? 1 : 0) - g.pointer.active) * k;
      g.scroll = Math.min(1, Math.max(0, window.scrollY / Math.max(1, g.height)));
      write("--mx", g.pointer.x);
      write("--my", g.pointer.y);
      write("--pointer", g.pointer.active, 0.002);
      write("--scroll", g.scroll, 0.002);
      const settled =
        Math.abs(goalX - g.pointer.x) < 0.3 &&
        Math.abs(goalY - g.pointer.y) < 0.3 &&
        Math.abs((over ? 1 : 0) - g.pointer.active) < 0.002;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    kick();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <LabContext.Provider value={{ geometry, reducedMotion }}>
      <section ref={sectionRef} className="relative h-dvh overflow-hidden bg-bg">
        {/* Variant background slot */}
        <div
          ref={bgRef}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          data-reduced-motion={reducedMotion ? "" : undefined}
        >
          {background}
        </div>

        {/* Constrained inner layout */}
        <div className="relative flex h-full max-w-[1600px] mx-auto">
          {/* Left panel — text content */}
          <div
            className="relative z-10 flex w-[42%] flex-col justify-start pt-[18%] px-8 pl-16 lg:pl-20 xl:pl-28"
            style={{ visibility: hideCopy ? "hidden" : undefined }}
          >
            <h1 className="leading-[1.05] text-white" style={{ fontSize: "clamp(3rem, 7vw, 7.5rem)" }}>
              <span className="block font-coolvetica font-bold leading-none">BUILT</span>
              <span className="block font-brier font-semibold text-livery-pop leading-none -mt-5">TO WIN.</span>
            </h1>

            <div className="mt-6">
              <p className="text-sm tracking-widest uppercase text-white/40 font-light">
                Built at Case.&nbsp;&nbsp;Raced Everywhere.
              </p>
            </div>

            <p className="mt-6 max-w-xs text-[0.82rem] leading-relaxed text-white/40">
              We design and manufacture a competition-grade off-road vehicle from
              scratch every year, then race it against hundreds of teams across
              North America.
            </p>

            <div className="mt-9 flex items-center gap-4">
              <Link
                href="/team"
                className="inline-flex items-center gap-2 bg-livery px-7 py-3 text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-on-livery hover:bg-livery-hover"
              >
                Meet the Team
              </Link>
              <Link
                href="/car"
                className="inline-flex items-center gap-2 border border-white/15 px-7 py-3 text-[0.7rem] font-semibold tracking-[0.2em] uppercase text-white/55 hover:border-white/30 hover:text-white"
              >
                View the Car
              </Link>
            </div>
          </div>

          {/* Car render — fully contained, scales with viewport */}
          <div
            ref={carBoxRef}
            className="absolute top-[4%] bottom-[2%] left-[40%] right-[1%]"
            style={{ visibility: hideCar ? "hidden" : undefined }}
          >
            <Image
              src={carSr26}
              alt="CWRU Motorsports Baja Car"
              fill
              sizes="59vw"
              className="object-contain"
              style={{ objectPosition: "left center" }}
              priority
            />
          </div>
        </div>
      </section>
    </LabContext.Provider>
  );
}
