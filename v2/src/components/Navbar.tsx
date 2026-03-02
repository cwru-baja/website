"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import Image from "next/image";

const links = [
  { label: "Team", href: "/team" },
  { label: "Car", href: "/car" },
  { label: "Sponsors", href: "/sponsors" },
  { label: "Support", href: "/support" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/5 transition-all duration-500 ${
        scrolled
          ? "bg-bg/95 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="flex items-center justify-between h-full max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24">
        {/* Logo */}
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Image
            src="/logo/team/m-logo.png"
            alt="CWRU Motorsports"
            width={100}
            height={100}
            className="h-14 w-auto object-contain"
            priority
          />
        </Link>

        {/* Nav links */}
        <ul className="flex items-center gap-8">
          {links.map(({ label, href }) => (
            <li key={label}>
              <Link
                href={href}
                className="text-sm tracking-[0.15em] uppercase text-white/50 hover:text-white transition-colors duration-200 font-medium"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
