"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import DaresBar from "@/components/DaresBar";
import MLogo from "@/components/MLogo";
import { useDaresLive } from "@/lib/useDaresLive";

const links = [
  { label: "Team", href: "/team" },
  { label: "Competition", href: "/competition" },
  { label: "Car", href: "/car" },
  { label: "Sponsors", href: "/sponsors" },
  { label: "Support", href: "/support" },
  { label: "Contact", href: "/contact" },
];

/**
 * The site's navbar, rendered once per route group (app/(site), app/(tools)).
 * `daresBar`: the "Dare us!" bar rides above it while the event is live. Pages
 * that size to the header (/car) read --nav-h, which grows while the bar shows
 * (globals.css).
 */
export default function Navbar({ daresBar }: { daresBar: boolean }) {
  const pathname = usePathname();
  const daresLive = useDaresLive();
  // While the dares run they lead the nav.
  const navLinks = daresLive ? [{ label: "Dares", href: "/dares" }, ...links] : links;
  const [scrolled, setScrolled] = useState(false);
  // The page the menu was opened on. Tying "open" to the path means any
  // navigation closes it, back and forward included, with no effect to sync.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // While the menu is open the page behind it can't scroll, Escape closes it
  // and hands focus back to the toggle, and widening past md closes it (the
  // menu is hidden there, and the scroll lock would otherwise stay on).
  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      toggleRef.current?.focus();
    };
    const wide = window.matchMedia("(min-width: 768px)");
    const onWide = () => {
      if (wide.matches) setOpenOn(null);
    };
    document.addEventListener("keydown", onKeyDown);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      wide.removeEventListener("change", onWide);
    };
  }, [menuOpen]);

  return (
    <nav
      // Tabbing out of the open menu closes it. A blur with no new focus
      // target (a tap on empty space) is left to the backdrop.
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (menuOpen && next instanceof Node && !event.currentTarget.contains(next)) {
          setOpenOn(null);
        }
      }}
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-500 max-md:bg-bg max-md:backdrop-blur-none ${
        scrolled
          ? "bg-bg/60 backdrop-blur-xl border-white/10 shadow-[0_1px_24px_rgba(0,0,0,0.5)]"
          : "bg-white/[0.02] backdrop-blur-md border-white/5"
      }`}
    >
      {daresBar && daresLive && (
        <DaresBar />
      )}
      <div className="flex h-16 max-w-[1600px] items-center justify-between px-8 lg:px-16 xl:px-24 mx-auto">
        {/* Logo */}
        <Link href="/" className="inline-flex min-h-11 items-center hover:opacity-80">
          <MLogo role="img" aria-label="CWRU Motorsports" className="h-6 w-auto text-livery" />
        </Link>

        {/* Nav links */}
        <ul className="hidden items-center gap-5 md:flex lg:gap-8">
          {navLinks.map(({ label, href }) => (
            <li key={label}>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                // Padding on an inline link grows its tap target to 44px without
                // moving anything: vertical padding doesn't touch the line box,
                // and the negative margin cancels the horizontal.
                className={`-mx-2 px-2 py-3.5 text-sm tracking-[0.1em] uppercase font-clash lg:tracking-[0.15em] ${
                  pathname === href
                    ? "text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          ref={toggleRef}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setOpenOn(menuOpen ? null : pathname)}
          className="min-h-11 px-2 font-clash text-xs font-medium uppercase tracking-[0.18em] text-white md:hidden"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* The backdrop dims the page and takes the tap that closes the menu, so
          that tap can't land on a link underneath. absolute, not fixed: the
          nav's backdrop-filter makes it the containing block for fixed
          children. */}
      {menuOpen && (
        <div
          aria-hidden
          onClick={() => setOpenOn(null)}
          className="absolute inset-x-0 top-full h-[100lvh] bg-black/60 md:hidden"
        />
      )}
      {menuOpen && (
        <div
          id="mobile-navigation"
          className="absolute top-full left-0 right-0 border-b border-white/10 bg-bg px-8 py-6 shadow-[0_16px_40px_rgba(0,0,0,0.45)] md:hidden"
        >
          <ul className="flex flex-col">
            {navLinks.map(({ label, href }, index) => (
              <li key={label} className={index === 0 ? "" : "border-t border-white/10"}>
                <Link
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  onClick={() => setOpenOn(null)}
                  className={`flex min-h-14 items-center justify-between font-clash text-sm uppercase tracking-[0.16em] ${
                    pathname === href ? "text-white" : "text-white/55"
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-[0.65rem] text-white/25">0{index + 1}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
