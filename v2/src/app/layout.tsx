import type { Metadata } from "next";
import { Bebas_Neue, Geist_Mono } from "next/font/google";
import "./globals.css";
import ScrollToTop from "@/components/ScrollToTop";

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
    <html lang="en" className="dark">
      <head>
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
      </head>
      <body
        className={`${bebasNeue.variable} ${geistMono.variable} font-sans antialiased bg-bg text-white`}
      >
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
