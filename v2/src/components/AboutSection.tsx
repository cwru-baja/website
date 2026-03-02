"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";

const IMAGES = [
  "/images/about-1.jpg",
  "/images/about-2.jpg",
  "/images/about-3.jpg",
  "/images/about-4.jpg",
  "/images/about-5.jpg",
  "/images/about-6.jpg",
  "/images/about-7.jpg",
  "/images/about-8.jpg",
  "/images/about-9.jpg",
  "/images/about-10.jpg",
  "/images/about-11.jpg",
  "/images/about-12.jpg",
  "/images/about-13.jpg",
  "/images/about-14.jpg",
  "/images/about-15.jpg",
  "/images/about-16.jpg",
  "/images/about-17.jpg",
  "/images/about-18.jpg",
  "/images/about-19.jpg",
  "/images/about-20.jpg",
];

// Pixels scrolled before advancing to the next image
const PX_PER_IMAGE = 250;

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  // Entrance fade-in
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Scroll-driven image switching — only active while section is visible
  useEffect(() => {
    const isVisible = { current: false };

    const visObserver = new IntersectionObserver(
      ([entry]) => { isVisible.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    if (sectionRef.current) visObserver.observe(sectionRef.current);

    let lastY = window.scrollY;
    let accumulated = 0;
    let idx = 0;

    const onScroll = () => {
      if (!isVisible.current) return;

      const delta = window.scrollY - lastY;
      lastY = window.scrollY;
      accumulated += delta;

      // Advance forward
      while (accumulated >= PX_PER_IMAGE) {
        accumulated -= PX_PER_IMAGE;
        idx = (idx + 1) % IMAGES.length;
        setCurrentIndex(idx);
      }
      // Step backward
      while (accumulated <= -PX_PER_IMAGE) {
        accumulated += PX_PER_IMAGE;
        idx = (idx - 1 + IMAGES.length) % IMAGES.length;
        setCurrentIndex(idx);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      visObserver.disconnect();
    };
  }, []);

  return (
    <section ref={sectionRef} className="bg-bg overflow-hidden pt-24 lg:pt-48">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row">

        {/* Left — Photo */}
        <div
          className="relative lg:w-[56%] min-h-[360px] lg:min-h-[560px] overflow-hidden"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(-28px)",
            transition:
              "opacity 0.85s cubic-bezier(0.16,1,0.3,1), transform 0.85s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {/* Render all images, show only current — no transition for hard cut */}
          {IMAGES.map((src, i) => (
            <div
              key={src}
              className="absolute inset-0"
              style={{ opacity: i === currentIndex ? 1 : 0 }}
            >
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                style={{ objectPosition: "center 35%" }}
                sizes="(max-width: 1024px) 100vw, 56vw"
                priority={i < 3}
              />
            </div>
          ))}

          {/* Right-edge gradient */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                "linear-gradient(to right, transparent 55%, rgba(10,10,10,0.85) 85%, #0a0a0a 100%)",
            }}
          />
          {/* Bottom gradient */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                "linear-gradient(to top, rgba(10,10,10,0.55) 0%, transparent 35%)",
            }}
          />
          {/* Red glow */}
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                "radial-gradient(ellipse 50% 60% at 20% 70%, rgba(188,33,33,0.07) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Right — Text panel */}
        <div
          className="relative flex-1 flex flex-col justify-center px-8 py-14 lg:px-12 xl:px-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(22px)",
            transition:
              "opacity 0.85s cubic-bezier(0.16,1,0.3,1) 0.18s, transform 0.85s cubic-bezier(0.16,1,0.3,1) 0.18s",
          }}
        >
          <h2
            className="font-bebas leading-[0.88] tracking-tight text-white"
            style={{ fontSize: "clamp(4rem, 5.5vw, 7rem)" }}
          >
            WHO
            <br />
            <span className="text-red">WE ARE.</span>
          </h2>

          <p className="mt-6 max-w-sm text-[0.82rem] leading-relaxed text-white/40">
            CWRU Motorsports is a student-run engineering team at Case Western
            Reserve University. Every year we design, fabricate, and race a
            competition-grade off-road vehicle in the international Baja SAE
            series — pushing boundaries against hundreds of university teams
            across North America.
          </p>

          <div className="mt-9">
            <Link
              href="/team"
              className="inline-flex items-center gap-2 border border-white/10 px-6 py-2.5 text-[0.67rem] font-semibold tracking-[0.18em] uppercase text-white/40 transition-all duration-200 hover:border-white/25 hover:text-white"
            >
              Meet the Team
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
