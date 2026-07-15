"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import Image from "next/image";

const links = [
  { label: "Team", href: "/team" },
  { label: "Competition", href: "/competition" },
  { label: "Car", href: "/car" },
  { label: "Sponsors", href: "/sponsors" },
  { label: "Support", href: "/support" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 border-b transition-all duration-500 ${
        scrolled
          ? "bg-bg/60 backdrop-blur-xl border-white/10 shadow-[0_1px_24px_rgba(0,0,0,0.5)]"
          : "bg-white/[0.02] backdrop-blur-md border-white/5"
      }`}
    >
      <div className="flex h-full max-w-[1600px] items-center justify-between px-5 sm:px-8 lg:px-16 xl:px-24 mx-auto">
        {/* Logo */}
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Image
            src="/logo/team/m-logo.svg"
            alt="CWRU Motorsports"
            width={100}
            height={100}
            className="h-6 w-auto object-contain"
            priority
          />
        </Link>

        {/* Nav links */}
        <ul className="hidden items-center gap-8 md:flex">
          {links.map(({ label, href }) => (
            <li key={label}>
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`text-sm tracking-[0.15em] uppercase transition-colors duration-200 font-clash ${
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
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="min-h-11 px-2 font-clash text-xs font-medium uppercase tracking-[0.18em] text-white md:hidden"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {menuOpen && (
        <div
          id="mobile-navigation"
          className="absolute top-full left-0 right-0 border-b border-white/10 bg-bg px-5 py-6 shadow-[0_16px_40px_rgba(0,0,0,0.45)] md:hidden"
        >
          <ul className="flex flex-col">
            {links.map(({ label, href }, index) => (
              <li key={label} className={index === 0 ? "" : "border-t border-white/10"}>
                <Link
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
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
