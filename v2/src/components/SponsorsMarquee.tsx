"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import PageContainer from "@/components/PageContainer";

type Sponsor = { name: string; file: string; url: string; png?: boolean };

const sponsors: Sponsor[] = [
  { name: "Fox", file: "fox", url: "https://ridefox.com/" },
  {
    name: "BMT Aerospace",
    file: "bmt-aerospace",
    url: "https://bmtaerospace.com/",
  },
  {
    name: "Enterline Foundation",
    file: "enterline-foundation",
    url: "https://enterlinefoundation.org/",
  },
  {
    name: "Case Alumni Association",
    file: "case-alumni-association",
    url: "https://casealumni.org/",
  },
  {
    name: "Spee-D Metals",
    file: "spee-d-metals",
    url: "https://speedmetals.com/",
  },
  {
    name: "Siemens",
    file: "siemens",
    url: "https://www.siemens.com/global/en.html",
  },
  { name: "Kenesto", file: "kenesto", url: "https://www.kenesto.com/" },
  { name: "Altair", file: "altair", url: "https://altair.com/" },
  { name: "KISSsoft", file: "kissoft", url: "https://www.kisssoft.com/en" },
  { name: "Jergens", file: "jergens", url: "https://www.jergensinc.com/" },
  { name: "BWXT", file: "bwxt", url: "https://www.bwxt.com/" },
  { name: "GMN Bearing", file: "gmn-bearing", url: "https://www.gmnbt.com/" },
  { name: "SKF", file: "skf", url: "https://www.skf.com/us" },
  { name: "Magna", file: "magna", url: "https://www.magna.com/" },
  { name: "ANSYS", file: "ansys", url: "https://www.ansys.com/" },
  { name: "Skamar", file: "skamar", url: "https://skamar.com/" },
  {
    name: "Gene Haas Foundation",
    file: "gene-haas-foundation",
    url: "https://www.ghaasfoundation.org/",
  },
  {
    name: "Michigan Scientific",
    file: "michigan-scientific",
    url: "https://www.michsci.com/",
  },
  { name: "Alro", file: "alro", url: "https://www.alro.com/" },
  {
    name: "Parker",
    file: "parker",
    url: "https://www.parker.com/us/en/home.html",
  },
  { name: "Tylok", file: "tylok", url: "https://www.tylok.com/" },
  {
    name: "GMP Friction",
    file: "gmp-friction",
    url: "https://gmpfriction.com/",
  },
  { name: "SGS", file: "sgs", url: "https://www.sgs.com/en" },
  {
    name: "Sears think[box]",
    file: "thinkbox",
    url: "https://case.edu/thinkbox/",
  },
  { name: "Mastercam", file: "mastercam", url: "https://www.mastercam.com/" },
  {
    name: "Blaser Swisslube",
    file: "blaser-swisslube",
    url: "https://blaser.com/",
  },
  {
    name: "AutomationDirect",
    file: "automation-direct",
    url: "https://www.automationdirect.com/",
  },
  {
    name: "American Friction Technologies",
    file: "american-friction-technologies",
    url: "https://www.americanfriction.net/",
  },
  { name: "Clark", file: "clark", url: "http://www.clark-metal.com/" },
  {
    name: "Anodizing Specialists",
    file: "asi",
    url: "https://www.anodizingspecialists.com/",
  },
  { name: "Schunk", file: "schunk", url: "https://schunk.com/us/en" },
  {
    name: "Summit Racing",
    file: "summit-racing-logo",
    url: "https://www.summitracing.com/",
    png: true,
  },
  {
    name: "Nord-Lock Group",
    file: "nord-lock-group",
    url: "https://www.nord-lock.com/en-us/",
  },
  {
    name: "Southington Offroad",
    file: "southington",
    url: "https://southingtonoffroad.com/",
  },
  {
    name: "Performance Titanium Group",
    file: "ptg",
    url: "https://performancetitanium.com/",
  },
  { name: "Bolt Depot", file: "bolt-depot", url: "https://boltdepot.com/" },
  {
    name: "FK Rod Ends",
    file: "fk-rod-ends",
    url: "https://www.fkrodends.com/",
  },
  {
    name: "Orange Vise",
    file: "orange-vise",
    url: "https://www.orangevise.com/",
  },
  { name: "Zintilon", file: "zintilon", url: "https://www.zintilon.com/" },
  { name: "Altium", file: "altium", url: "https://www.altium.com/" },
  { name: "Stifel", file: "stifel", url: "https://www.stifel.com/" },
  // PNG-only sponsors
  {
    name: "SKB Cases",
    file: "skb-cases",
    url: "https://www.skbcases.com/",
    png: true,
  },
  {
    name: "Cleveland Cliffs",
    file: "cleveland-cliffs-logo",
    url: "https://www.clevelandcliffs.com/",
    png: true,
  },
  {
    name: "Misa Metal",
    file: "misa-metal",
    url: "https://www.misametal.com/",
    png: true,
  },
  {
    name: "SolidWorks",
    file: "solidworks_logo",
    url: "https://www.solidworks.com/",
    png: true,
  },
  {
    name: "Fathom Realty",
    file: "fathom-realty-logo",
    url: "https://fathomrealty.com/",
    png: true,
  },
  {
    name: "Gates",
    file: "gates-logo",
    url: "https://www.gates.com/us/en.html",
    png: true,
  },
  {
    name: "Micro-Measurements",
    file: "micro-measurements-logo",
    url: "https://www.micro-measurements.com/",
    png: true,
  },
  {
    name: "OSH Cut",
    file: "oshcut-logo",
    url: "https://www.oshcut.com/",
    png: true,
  },
  {
    name: "Stampede Die",
    file: "stampede-die-logo",
    url: "https://stampededie.com/",
    png: true,
  },
  { name: "NSK", file: "nsk-logo", url: "https://www.nsk.com/", png: true },
  {
    name: "Commercial Steel Treating",
    file: "commercial-steel-logo",
    url: "https://www.commercialsteeltreating.com/",
    png: true,
  },
  { name: "T-Mac Machine", file: "tmac-machine-logo", url: "", png: true },
  { name: "PPG", file: "ppg-logo", url: "https://www.ppg.com/", png: true },
];

const repeatedSponsors = [
  ...sponsors.map((sponsor) => ({ sponsor, copy: "first" })),
  ...sponsors.map((sponsor) => ({ sponsor, copy: "second" })),
];

export default function SponsorsMarquee() {
  const container = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const marquee = marqueeRef.current;
      if (!marquee) return;

      gsap.to(marquee, {
        xPercent: -50,
        repeat: -1,
        duration: 120,
        ease: "none",
      });
    },
    { scope: container },
  );

  return (
    <section className="py-24" ref={container}>
      <PageContainer>
        {/* Header row */}
        <div className="flex items-start justify-between mb-25">
          {/* Big stacked title */}
          <div className="leading-none">
            <div className="font-coolvetica font-bold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-white leading-none">
              PARTNERS
            </div>
            <div className="font-brier font-semibold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-red leading-none -mt-3">
              &amp;SPONSORS
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div
          className="relative overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          }}
        >
          {/* Removed animate-marquee from className */}
          <div className="flex w-max" ref={marqueeRef}>
            {repeatedSponsors.map(({ sponsor, copy }) => (
              <a
                key={`${copy}-${sponsor.file}`}
                href={sponsor.url || undefined}
                target={sponsor.url ? "_blank" : undefined}
                rel={sponsor.url ? "noopener noreferrer" : undefined}
                className="flex items-center justify-center px-12 shrink-0 opacity-100 transition-opacity duration-300"
              >
                <Image
                  src={
                    sponsor.png
                      ? `/logo/sponsor/${sponsor.file}.png`
                      : `/logo/sponsor/svg/${sponsor.file}.svg`
                  }
                  alt={sponsor.name}
                  width={200}
                  height={48}
                  className="h-12 w-auto"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              </a>
            ))}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
