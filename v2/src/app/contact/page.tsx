import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import EmailRow from "./EmailRow";
import * as cls from "./rows";

export const metadata = {
  title: "Contact — CWRU Motorsports",
  description: "Email CWRU Motorsports or find the team on Instagram, LinkedIn, YouTube and Facebook.",
};

const EMAIL = "baja-exec@case.edu";

const socials = [
  { name: "Instagram", detail: "@cwrubaja", href: "https://www.instagram.com/cwrubaja/", blurb: "Behind-the-scenes content and team updates." },
  { name: "LinkedIn", detail: "CWRU Motorsports", href: "https://www.linkedin.com/company/cwru-motorsports/", blurb: "Professional updates and networking." },
  { name: "YouTube", detail: "@CWRUMotorsports", href: "https://www.youtube.com/@CWRUMotorsports", blurb: "Technical videos and event coverage." },
  { name: "Facebook", detail: "@cwrubaja", href: "https://www.facebook.com/cwrubaja/", blurb: "Event announcements and team news." },
];

const numbered = (index: number) => String(index + 1).padStart(2, "0");

export default function ContactPage() {
  return (
    <>
      <Navbar />

      <main className="bg-bg pt-36 pb-24 sm:pt-40">
        <PageContainer>
          <PageTitle lead="GET IN" accent="TOUCH." />

          {/* The ledger's top rule doubles as the hairline every page has under its title. */}
          <ol className="mt-8 border-t border-white/8">
            <li className="border-b border-white/8">
              <EmailRow
                number={numbered(0)}
                email={EMAIL}
                blurb="Sponsorship, joining the team and everything else. Read by the executive board."
              />
            </li>
            {socials.map(({ name, detail, href, blurb }, i) => (
              <li key={name} className="border-b border-white/8">
                <a href={href} target="_blank" rel="noopener noreferrer" className={cls.row}>
                  <span className={cls.number}>{numbered(i + 1)}</span>
                  <span className={cls.name}>
                    {name.toUpperCase()}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                  <span className={cls.blurb}>{blurb}</span>
                  <span className={`${cls.detail} text-white/45`}>{detail}</span>
                  <svg
                    viewBox="5 5 14 14"
                    fill="none"
                    aria-hidden="true"
                    className={`${cls.icon} text-white/30`}
                  >
                    <path d="M6 18 18 6M8 6h10v10" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </a>
              </li>
            ))}
          </ol>
        </PageContainer>
      </main>

      <Footer />
    </>
  );
}
