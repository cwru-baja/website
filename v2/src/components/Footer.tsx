import Image from "next/image";

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/cwrubaja/", mr: "-mr-18", hoverColor: "hover:text-[#E1306C]" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/cwru-motorsports/", mr: "-mr-13", hoverColor: "hover:text-[#0A66C2]" },
  { label: "YouTube", href: "https://www.youtube.com/@CWRUMotorsports", mr: "-mr-8", hoverColor: "hover:text-[#FF0000]" },
];

export default function Footer() {
  return (
    <footer className="overflow-hidden border-t border-white/5 bg-bg pt-16 sm:pt-24">
      <div className="flex justify-between gap-8 px-8 pb-8 md:hidden">
        <div>
          <p className="mb-4 font-clash text-[0.65rem] uppercase tracking-[0.18em] text-white/30">
            Follow
          </p>
          <ul className="space-y-2">
            {socialLinks.map(({ label, href, hoverColor }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm text-white/70 transition-colors ${hoverColor}`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-right">
          <p className="mb-4 font-clash text-[0.65rem] uppercase tracking-[0.18em] text-white/30">
            CWRU Motorsports
          </p>
          <p className="text-sm text-white/70">© 2026</p>
          <p className="mt-2 text-sm text-white/50">All rights reserved</p>
          <p className="mt-5 text-xs text-white/30">
            built by{" "}
            <a
              href="https://aretelew.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white/70"
            >
              Anthony
            </a>{" "}
            :)
          </p>
        </div>
      </div>

      {/* Logo + flanking text */}
      <div className="relative flex justify-center">
        {/* Giant logo — bleeds off bottom */}
        <Image
          src="/logo/team/cwru-motorsports-white-no-text-logo.png"
          alt="CWRU Motorsports"
          width={1200}
          height={1200}
          className="w-[110vw] max-w-[900px] translate-y-[16%] opacity-90 select-none pointer-events-none sm:w-[90vw] md:translate-y-[22%]"
          priority={false}
          draggable={false}
        />

        {/* Follow — left of logo */}
        <div
          className="absolute top-[18%] hidden md:block"
          style={{ right: "calc(50% + min(45vw, 450px) + 2rem)" }}
        >
          <ul className="flex flex-col items-end space-y-2">
            {socialLinks.map(({ label, href, mr, hoverColor }) => (
              <li key={label} className={mr}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm text-white/70 transition-colors whitespace-nowrap ${hoverColor}`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal — right of logo */}
        <div
          className="absolute top-[18%] hidden md:block"
          style={{ left: "calc(50% + min(45vw, 450px) + 2rem)" }}
        >
          <ul className="flex flex-col items-start space-y-2">
            {[
              { label: "© 2026", ml: "ml-1" },
              { label: "All rights reserved", ml: "-ml-4" },
            ].map(({ label, ml }) => (
              <li key={label} className={`text-sm text-white/70 whitespace-nowrap ${ml}`}>
                {label}
              </li>
            ))}
            <li className="text-sm text-white/30 whitespace-nowrap mt-4 -ml-8">
              built by{" "}
              <a href="https://aretelew.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Anthony</a>{" "}:)
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
