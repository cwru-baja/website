import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import type { CSSProperties } from "react";
import "./globals.css";
import ScrollToTop from "@/components/ScrollToTop";
import { CARS, CURRENT_CAR, CURRENT_THEME, liveryVariables } from "@/lib/livery";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// openGraph deliberately carries no title or description: a child page that
// does not declare its own openGraph inherits this whole object, and Next
// fills og:title and og:description from that page's own title/description
// only while they are absent here. Setting them would stamp the home page's
// words on every card.
export const metadata: Metadata = {
  // Makes the relative image URL below absolute. Every unfurler needs a whole
  // URL; none of them have a page to resolve a path against.
  metadataBase: new URL(SITE_URL),
  title: "CWRU Motorsports — Baja SAE",
  description: "Case Western Reserve University's Baja SAE racing team. We design, build, and race off-road vehicles.",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: `${CARS[CURRENT_CAR].name}, the team's Baja SAE car`,
      },
    ],
  },
  // Platforms that read the Twitter tags in preference to Open Graph would
  // otherwise show the card cropped to a small square.
  twitter: { card: "summary_large_image" },
};

// Mobile browsers tint their toolbars with themeColor, so it matches the page
// background; colorScheme keeps native controls and scrollbars dark. The
// width=device-width, initial-scale=1 default is left alone. viewportFit:
// "cover" waits for safe-area padding on the gutters, or sideways phones would
// put text under the notch.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

// Runs while <head> is parsed, before anything paints, so a skipped intro never
// flashes its dark overlay. The server renders data-intro="play"; this rewrites
// it to "skip" and globals.css hides the overlay. Kept in sync with
// INTRO_ATTR / SEEN_KEY in components/LogoIntro.tsx.
const introGate = `(function(){try{var s=window.sessionStorage.getItem("mIntroSeen")==="1";if(!s&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)s=true;if(s)document.documentElement.setAttribute("data-intro","skip");}catch(e){}})();`;

// A plain <script> is required: next/script's beforeInteractive strategy does
// not run inline code early enough to beat the first paint in the App Router.
// React warns about script tags it renders, since they never execute on client
// navigations — text/plain on the client silences that without changing the
// server-parsed behaviour this relies on.
function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: introGate rewrites data-intro before React
    // hydrates, so the DOM wins over the rendered "play". It is shallow, so
    // mismatches on children still surface.
    // style carries the current car's livery colours (globals.css maps them to
    // the livery-* utilities); server-rendered, so the first paint is themed.
    <html
      lang="en"
      className="dark"
      data-intro="play"
      style={liveryVariables(CURRENT_THEME) as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={introGate} />
      </head>
      <body
        className={`${geistMono.variable} font-sans antialiased bg-bg text-white`}
      >
        <ScrollToTop />
        {children}
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
