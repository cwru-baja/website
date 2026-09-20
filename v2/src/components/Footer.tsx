import Image from "next/image";

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/cwrubaja/", mr: "-mr-18", hoverColor: "hover:text-[#E1306C]", icon: <InstagramIcon /> },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/cwru-motorsports/", mr: "-mr-14", hoverColor: "hover:text-[#0A66C2]", icon: <LinkedInIcon /> },
  { label: "YouTube", href: "https://www.youtube.com/@CWRUMotorsports", mr: "-mr-10", hoverColor: "hover:text-[#FF0000]", icon: <YouTubeIcon /> },
];

export default function Footer() {
  // The rule sits inside a padded wrapper, not on the footer, so it can sit
  // closer to the icons than to the page above without a margin that could
  // collapse into whatever precedes the footer.
  return (
    <footer className="overflow-hidden bg-bg pt-7 sm:pt-8 xl:pt-0">
      <div className="border-t border-white/5 pt-6 sm:pt-8 xl:pt-24">
        {/* Stacked until xl: between md and xl the columns flanking the logo ran
            off the screen edges. From sm the block spans the logo's width, so it
            lines up with the logo's left end, and sits just above the logo rather
            than floating between it and the page. The icons are 44px tap targets. */}
        <div className="px-6 pb-4 sm:mx-auto sm:w-[90vw] sm:max-w-[900px] sm:px-0 xl:hidden">
          <ul className="flex gap-2">
            {socialLinks.map(({ label, href, hoverColor, icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`grid size-11 place-items-center rounded-full border border-white/15 text-white/75 transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-livery ${hoverColor}`}
                >
                  {icon}
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs leading-5 text-white/50">
            © 2026 CWRU Motorsports. All rights reserved.{" "}
            {/* Kept whole, so a narrow phone breaks before "Built", not inside it. */}
            <span className="whitespace-nowrap">
              Built by{" "}
              {/* ::after grows the hit area past the line, so the link needs no 44px row. */}
              <CreditLink className="relative after:absolute after:-inset-x-2 after:-inset-y-3.5" />
            </span>
          </p>
        </div>

        {/* Logo + flanking text */}
        <div className="relative flex justify-center">
          {/* Giant logo: edge to edge on phones, bleeds off the bottom */}
          <Image
            src="/logo/team/cwru-motorsports-teal-no-text-logo.png"
            alt="CWRU Motorsports"
            width={1547}
            height={299}
            className="w-full max-w-[900px] translate-y-[16%] opacity-90 select-none pointer-events-none sm:w-[90vw] md:translate-y-[22%]"
            priority={false}
            draggable={false}
          />

          {/* Follow — left of logo */}
          <div
            className="absolute top-[18%] hidden xl:block"
            style={{ right: "calc(50% + min(45vw, 450px) + 2rem)" }}
          >
            <ul className="flex flex-col items-end space-y-2">
              {socialLinks.map(({ label, href, mr, hoverColor }) => (
                <li key={label} className={`text-sm ${mr}`}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-white/70 whitespace-nowrap ${hoverColor}`}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal — right of logo */}
          <div
            className="absolute top-[18%] hidden xl:block"
            style={{ left: "calc(50% + min(45vw, 450px) + 2rem)" }}
          >
            <ul className="flex flex-col items-start space-y-2">
              <li className="text-sm text-white/70 whitespace-nowrap ml-1">© 2026</li>
              <li className="text-sm text-white/70 whitespace-nowrap -ml-3">All rights reserved</li>
              <li className="text-sm text-white/70 whitespace-nowrap -ml-7">
                Built by <CreditLink />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Underlined, with a new-tab arrow, so it reads as a link at the same brightness as the text around it. */
function CreditLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://aretelew.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-0.5 underline decoration-white/30 underline-offset-2 hover:text-white hover:decoration-white/70 ${className}`}
    >
      Anthony
      <span className="sr-only"> (opens in a new tab)</span>
      <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className="size-2.5">
        <path d="M3 9 9 3M4 3h5v5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </a>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px]">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px]">
      <rect x="3" y="3" width="18" height="18" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.25" cy="7.9" r="1.2" fill="currentColor" />
      <path d="M8.25 10.5v6.25M12 16.75V10.5m0 2.9c0-1.7 1.1-2.9 2.6-2.9s2.4 1 2.4 2.9v3.35" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px]">
      <rect x="2" y="5" width="20" height="14" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" />
    </svg>
  );
}
