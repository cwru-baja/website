import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Bebas_Neue, Geist_Mono } from "next/font/google";
import Script from "next/script";
import type { CSSProperties } from "react";
import "./globals.css";
import ScrollToTop from "@/components/ScrollToTop";
import { CURRENT_THEME, liveryVariables } from "@/lib/livery";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas-neue",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CWRU Motorsports — Baja SAE",
  description: "Case Western Reserve University's Baja SAE racing team. We design, build, and race off-road vehicles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // style carries the current car's livery colours (globals.css maps them to
    // the livery-* utilities); server-rendered, so the first paint is themed.
    <html
      lang="en"
      className="dark"
      style={liveryVariables(CURRENT_THEME) as CSSProperties}
    >
      <body
        className={`${bebasNeue.variable} ${geistMono.variable} font-sans antialiased bg-bg text-white`}
      >
        <ScrollToTop />
        {children}
        <Analytics />
        <SpeedInsights />
        {/* Figma html-to-design capture, for pushing pages into Figma. Dev only,
            so production visitors never load a third-party script. */}
        {process.env.NODE_ENV !== "production" && (
          <Script
            src="https://mcp.figma.com/mcp/html-to-design/capture.js"
            strategy="lazyOnload"
          />
        )}
      </body>
    </html>
  );
}
