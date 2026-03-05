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
      <div className="flex items-center justify-between h-full max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24">
        {/* Logo */}
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Image
            src="/logo/team/m-logo-minimal.png"
            alt="CWRU Motorsports"
            width={100}
            height={100}
            className="h-6 w-auto object-contain"
            priority
          />
        </Link>

        {/* Nav links */}
        <ul className="flex items-center gap-8">
          {links.map(({ label, href }) => (
            <li key={label}>
              <Link
                href={href}
                className={`text-sm tracking-[0.15em] uppercase transition-colors duration-200 font-clash ${
                pathname === href ? "text-white" : "text-white/50 hover:text-white"
              }`}
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
