import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-bg overflow-hidden pt-24">
      {/* Logo + flanking text */}
      <div className="relative flex justify-center">
        {/* Giant logo — bleeds off bottom */}
        <Image
          src="/logo/team/cwru-motorsports-white-no-text-logo.png"
          alt="CWRU Motorsports"
          width={1200}
          height={1200}
          className="w-[90vw] max-w-[900px] translate-y-[22%] opacity-90 select-none pointer-events-none"
          priority={false}
          draggable={false}
        />

        {/* Follow — left of logo */}
        <div
          className="absolute top-[18%]"
          style={{ right: "calc(50% + min(45vw, 450px) + 2rem)" }}
        >
          <ul className="flex flex-col items-end space-y-2">
            {[
              { label: "Instagram", href: "https://www.instagram.com/cwrubaja/", mr: "-mr-18" },
              { label: "LinkedIn", href: "https://www.linkedin.com/company/cwru-motorsports/", mr: "-mr-13" },
              { label: "YouTube", href: "https://www.youtube.com/@CWRUMotorsports", mr: "-mr-8" },
            ].map(({ label, href, mr }) => (
              <li key={label} className={mr}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/70 hover:text-white transition-colors whitespace-nowrap"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal — right of logo */}
        <div
          className="absolute top-[18%]"
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
