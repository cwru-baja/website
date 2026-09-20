import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import Image from "next/image";
import { SEASON } from "@/lib/events";
import { logoBox, logoSrc, phoneLogoHeight, type TierKey } from "@/lib/logoSizing";

type Sponsor = { name: string; file: string; url: string; png?: boolean };

const tiers: {
  label: string;
  key: TierKey;
  sponsors: Sponsor[];
}[] = [
  {
    label: "Ultimate",
    key: "ultimate",
    sponsors: [
      { name: "Fox", file: "fox", url: "https://ridefox.com/" },
      { name: "BMT Aerospace", file: "bmt-aerospace", url: "https://bmtaerospace.com/" },
      { name: "Enterline Foundation", file: "enterline-foundation", url: "https://enterlinefoundation.org/" },
      { name: "Case Alumni Association", file: "case-alumni-association", url: "https://casealumni.org/" },
      { name: "Cleveland Cliffs", file: "cleveland-cliffs-logo", url: "https://www.clevelandcliffs.com/", png: true },
    ],
  },
  {
    label: "Platinum",
    key: "platinum",
    sponsors: [
      { name: "Siemens", file: "siemens", url: "https://www.siemens.com/global/en.html" },
      { name: "SKB Cases", file: "skb-cases", url: "https://www.skbcases.com/", png: true },
      { name: "Kenesto", file: "kenesto", url: "https://www.kenesto.com/" },
      { name: "KISSsoft", file: "kissoft", url: "https://www.kisssoft.com/en" },
      { name: "Hexagon", file: "hexagon", url: "https://hexagon.com/" },
      { name: "nTop", file: "ntop", url: "https://www.ntop.com/" },
      { name: "SolidWorks", file: "solidworks_logo", url: "https://www.solidworks.com/", png: true },
      { name: "ANSYS", file: "ansys", url: "https://www.ansys.com/" },
      { name: "Altium", file: "altium", url: "https://www.altium.com/" },
      { name: "Parker", file: "parker", url: "https://www.parker.com/us/en/home.html" },
    ],
  },
  {
    label: "Gold",
    key: "gold",
    sponsors: [
      { name: "Spee-D Metals", file: "spee-d-metals", url: "https://speedmetals.com/" },
      { name: "Jergens", file: "jergens", url: "https://www.jergensinc.com/" },
      { name: "GMN Bearing", file: "gmn-bearing", url: "https://www.gmnbt.com/" },
      { name: "SKF", file: "skf", url: "https://www.skf.com/us" },
      { name: "Magna", file: "magna", url: "https://www.magna.com/" },
      { name: "Skamar", file: "skamar", url: "https://skamar.com/" },
      { name: "Gene Haas Foundation", file: "gene-haas-foundation", url: "https://www.ghaasfoundation.org/" },
      { name: "Misa Metal", file: "misa-metal", url: "https://www.misametal.com/", png: true },
      { name: "Michigan Scientific", file: "michigan-scientific", url: "https://www.michsci.com/" },
      { name: "Alro", file: "alro", url: "https://www.alro.com/" },
      { name: "Tylok", file: "tylok", url: "https://www.tylok.com/" },
      { name: "Talan Products", file: "talan-products", url: "https://www.talanproducts.com/" },
      { name: "Gates", file: "gates-logo", url: "https://www.gates.com/us/en.html", png: true },
      { name: "Sears think[box]", file: "thinkbox", url: "https://case.edu/thinkbox/" },
      { name: "Mastercam", file: "mastercam", url: "https://www.mastercam.com/" },
      { name: "Blaser Swisslube", file: "blaser-swisslube", url: "https://blaser.com/" },
      { name: "Clark", file: "clark", url: "http://www.clark-metal.com/" },
      { name: "HyperMill", file: "hypermill", url: "https://www.openmind-tech.com/en-us/cam/product-overview/" },
      { name: "Carbide Depot", file: "carbide-depot", url: "https://www.carbidedepot.com/" },
      { name: "Neway Stamping", file: "neway-stamping", url: "https://www.newaystamping.com/", png: true },
    ],
  },
  {
    label: "Silver",
    key: "silver",
    sponsors: [
      { name: "SGS", file: "sgs", url: "https://www.sgs.com/en" },
      { name: "AutomationDirect", file: "automation-direct", url: "https://www.automationdirect.com/" },
      { name: "American Friction", file: "american-friction-technologies", url: "https://www.americanfriction.net/" },
      { name: "Anodizing Specialists", file: "asi", url: "https://www.anodizingspecialists.com/" },
      { name: "Schunk", file: "schunk", url: "https://schunk.com/us/en" },
      { name: "3Dconnexion", file: "3dconnexion", url: "https://3dconnexion.com/us/" },
      { name: "Fathom Realty", file: "fathom-realty-logo", url: "https://fathomrealty.com/", png: true },
      { name: "T-Mac Machine", file: "tmac-machine-logo", url: "", png: true },
      { name: "Lincoln Electric", file: "lincoln-electric", url: "https://www.lincolnelectric.com/" },
      { name: "Curbell Plastics", file: "curbell-plastics", url: "https://www.curbellplastics.com/" },
      { name: "Joslyn Manufacturing", file: "joslyn-manufacturing", url: "" },
      { name: "Exact Tool & Die", file: "etdtransparent", url: "", png: true },
      { name: "Electron Beam Industries", file: "ebiweld_logo", url: "https://www.ebiweld.com/", png: true },
      { name: "TMS Titanium", file: "tms-logo", url: "https://www.tmstitanium.com/", png: true },
      { name: "Online Carbide", file: "online-carbide", url: "https://www.onlinecarbide.com/", png: true },
    ],
  },
  {
    label: "Bronze",
    key: "bronze",
    sponsors: [
      { name: "Nord-Lock Group", file: "nord-lock-group", url: "https://www.nord-lock.com/en-us/" },
      { name: "Holley", file: "holley", url: "https://www.holley.com/", png: true },
      { name: "Southington Offroad", file: "southington", url: "https://southingtonoffroad.com/" },
      { name: "Performance Titanium Group", file: "ptg", url: "https://performancetitanium.com/" },
      { name: "Bolt Depot", file: "bolt-depot", url: "https://boltdepot.com/" },
      { name: "FK Rod Ends", file: "fk-rod-ends", url: "https://www.fkrodends.com/" },
      { name: "Micro-Measurements", file: "micro-measurements-logo", url: "https://www.micro-measurements.com/", png: true },
      { name: "OSH Cut", file: "oshcut-logo", url: "https://www.oshcut.com/", png: true },
      { name: "Stampede Die", file: "stampede-die-logo", url: "https://stampededie.com/", png: true },
      { name: "Zintilon", file: "zintilon", url: "https://www.zintilon.com/" },
      { name: "NSK", file: "nsk-logo", url: "https://www.nsk.com/", png: true },
      { name: "Commercial Steel Treating", file: "commercial-steel-logo", url: "https://www.commercialsteeltreating.com/", png: true },
      { name: "PPG", file: "ppg-logo", url: "https://www.ppg.com/", png: true },
      { name: "Titanium Joe", file: "titanium-joe", url: "https://www.titaniumjoe.com/" },
      { name: "SendCutSend", file: "sendcutsend", url: "https://sendcutsend.com/" },
      { name: "Bicycle Frame Depot", file: "bicycle-frame-depot", url: "https://bicycleframedepot.us/" },
      { name: "TrippWells", file: "trippwells", url: "https://www.trippwells.com/" },
      { name: "MoTeC", file: "motec", url: "https://www.milspecwiring.com/MoTeC_c_335.html" },
      { name: "Extreme Powder Coating", file: "extreme-powder-coating", url: "https://ohiopowdercoat.com/" },
      { name: "SimuTech Group", file: "simutech-group", url: "https://simutechgroup.com/" },
      { name: "Raising Cane's", file: "raising-canes", url: "https://raisingcanes.com/" },
      { name: "Meridian Laboratory", file: "meridian-laboratory", url: "https://www.meridianlab.com/" },
      { name: "Extreme Canopy", file: "extreme-canopy", url: "https://www.extremecanopy.com/" },
      { name: "Wicks Aircraft Supply", file: "wicks-aircraft", url: "https://www.wicksaircraft.com/" },
      { name: "Fastenal", file: "fastenal", url: "https://www.fastenal.com/" },
      { name: "My Perfect Color", file: "my-perfect-color", url: "https://www.myperfectcolor.com/" },
      { name: "Dewesoft", file: "dewesoft", url: "https://dewesoft.com/" },
      { name: "GMP Friction", file: "gmp-friction", url: "https://gmpfriction.com/" },
      { name: "Summit Racing", file: "summit-racing-logo", url: "https://www.summitracing.com/", png: true },
      { name: "DragonPlate", file: "dragonplate", url: "https://dragonplate.com/" },
      { name: "Rock West Composites", file: "rock-west-composites", url: "https://www.rockwestcomposites.com/", png: true },
      { name: "Atlas Bronze", file: "atlasbronze", url: "https://www.atlasbronze.com/", png: true },
      { name: "Pro Tapes", file: "protapestransparent", url: "https://www.protapes.com/", png: true },
    ],
  },
];

const totalSponsors = tiers.reduce((acc, t) => acc + t.sponsors.length, 0);

export default function SponsorsPage() {
  return (
    <>
      <Navbar />

      {/* Page header */}
      <section className="bg-bg pt-40 pb-0">
        <PageContainer>
          <PageTitle lead="OUR" accent="SPONSORS." />

          <div className="mt-8 h-px w-full bg-white/8" />

          {/* Stats row, with the blurb pulled to the far edge on desktop */}
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap gap-x-10 gap-y-2">
              {[
                { value: totalSponsors, label: "Sponsors & Partners" },
                { value: tiers.length, label: "Tiers" },
                { value: SEASON, label: "Season" },
              ].map(({ value, label }) => (
                <div key={label} className="flex items-baseline gap-2">
                  <span className="font-clash font-medium text-2xl tracking-wide text-white">
                    {value}
                  </span>
                  <span className="text-[0.7rem] font-medium tracking-[0.18em] uppercase text-white/35">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <p className="max-w-xl text-base leading-relaxed text-white/60 lg:text-right lg:text-lg">
              Every season runs on materials, software, and manufacturing support from the
              companies backing this team.
            </p>
          </div>
        </PageContainer>
      </section>

      {/* Tier sections */}
      <section className="bg-bg py-20">
        <PageContainer>
          <div className="flex flex-col gap-24">
            {tiers.map((tier, i) => {
              const right = i % 2 === 1;
              return (
              // A size container, so phone logos and gaps can be sized in cqi.
              <div key={tier.key} className={`@container ${right ? "text-right" : ""}`}>
                {/* Tier header */}
                <div className="leading-none mb-12">
                  <div className="font-coolvetica font-bold text-[clamp(2rem,4vw,4rem)] tracking-wide text-white leading-none">
                    {tier.label.toUpperCase()}
                  </div>
                  <div className="font-brier font-semibold text-[clamp(2rem,4vw,4rem)] tracking-wide text-livery-pop leading-none -mt-2">
                    SPONSORS
                  </div>
                </div>

                {/* Logo row. On phones the column gap scales with the row
                    like the logos do (28px on a 390px phone), see
                    phoneLogoHeight. */}
                <div className={`flex flex-wrap items-center gap-x-[min(8.6cqi,2.5rem)] gap-y-9 sm:gap-x-20 sm:gap-y-12 ${right ? "justify-end" : ""}`}>
                  {tier.sponsors.map((sponsor) => {
                    const box = logoBox(sponsor.file, tier.key);
                    return (
                      <a
                        key={sponsor.name}
                        href={sponsor.url || undefined}
                        target={sponsor.url ? "_blank" : undefined}
                        rel={sponsor.url ? "noopener noreferrer" : undefined}
                        // A 320px phone draws logos as small as 26px wide and
                        // 12px tall; the padding makes every link at least a
                        // 44px target without moving anything.
                        className="group -mx-2.5 -my-4 px-2.5 py-4"
                      >
                        <Image
                          src={logoSrc(sponsor.file, sponsor.png)}
                          unoptimized={logoSrc(sponsor.file, sponsor.png).endsWith(".svg")}
                          alt={sponsor.name}
                          width={box.width}
                          height={box.height}
                          className="h-(--logo-h) w-auto max-w-full object-contain max-sm:h-(--logo-h-phone)"
                          style={
                            {
                              "--logo-h": `${box.height}px`,
                              "--logo-h-phone": phoneLogoHeight(box),
                              filter: "brightness(0) invert(1)",
                            } as React.CSSProperties
                          }
                        />
                      </a>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </PageContainer>
      </section>


<Footer />
    </>
  );
}
