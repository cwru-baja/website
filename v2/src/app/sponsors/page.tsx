import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageContainer from "@/components/PageContainer";
import Image from "next/image";

type Sponsor = { name: string; file: string; url: string; png?: boolean };

const tiers: {
  label: string;
  key: string;
  logoHeight: string;
  sponsors: Sponsor[];
}[] = [
  {
    label: "Ultimate",
    key: "ultimate",
    logoHeight: "h-20",
    sponsors: [
      { name: "Fox", file: "fox", url: "https://ridefox.com/" },
      { name: "BMT Aerospace", file: "bmt-aerospace", url: "https://bmtaerospace.com/" },
      { name: "Enterline Foundation", file: "enterline-foundation", url: "https://enterlinefoundation.org/" },
      { name: "Case Alumni Association", file: "case-alumni-association", url: "https://casealumni.org/" },
    ],
  },
  {
    label: "Platinum",
    key: "platinum",
    logoHeight: "h-16",
    sponsors: [
      { name: "Siemens", file: "siemens", url: "https://www.siemens.com/global/en.html" },
      { name: "SKB Cases", file: "skb-cases", url: "https://www.skbcases.com/", png: true },
      { name: "Kenesto", file: "kenesto", url: "https://www.kenesto.com/" },
      { name: "KISSsoft", file: "kissoft", url: "https://www.kisssoft.com/en" },
      { name: "Hexagon", file: "hexagon", url: "https://hexagon.com/" },
      { name: "nTop", file: "ntop", url: "https://www.ntop.com/" },
      { name: "SolidWorks", file: "solidworks_logo", url: "https://www.solidworks.com/", png: true },
      { name: "ANSYS", file: "ansys", url: "https://www.ansys.com/" },
      { name: "Parker", file: "parker", url: "https://www.parker.com/us/en/home.html" },
    ],
  },
  {
    label: "Gold",
    key: "gold",
    logoHeight: "h-14",
    sponsors: [
      { name: "Spee-D Metals", file: "spee-d-metals", url: "https://speedmetals.com/" },
      { name: "Jergens", file: "jergens", url: "https://www.jergensinc.com/" },
      { name: "GMN Bearing", file: "gmn-bearing", url: "https://www.gmnbt.com/" },
      { name: "SKF", file: "skf", url: "https://www.skf.com/us" },
      { name: "Magna", file: "magna", url: "https://www.magna.com/" },
      { name: "Skamar", file: "skamar", url: "https://skamar.com/" },
      { name: "Gene Haas Foundation", file: "gene-haas-foundation", url: "https://www.ghaasfoundation.org/" },
      { name: "Cleveland Cliffs", file: "cleveland-cliffs-logo", url: "https://www.clevelandcliffs.com/", png: true },
      { name: "Misa Metal", file: "misa-metal", url: "https://www.misametal.com/", png: true },
      { name: "Michigan Scientific", file: "michigan-scientific", url: "https://www.michsci.com/" },
      { name: "Alro", file: "alro", url: "https://www.alro.com/" },
      { name: "Tylok", file: "tylok", url: "https://www.tylok.com/" },
      { name: "Talan Products", file: "talan-products", url: "https://www.talanproducts.com/" },
    ],
  },
  {
    label: "Silver",
    key: "silver",
    logoHeight: "h-12",
    sponsors: [
      { name: "Gates", file: "gates-logo", url: "https://www.gates.com/us/en.html", png: true },
      { name: "GMP Friction", file: "gmp-friction", url: "https://gmpfriction.com/" },
      { name: "SGS", file: "sgs", url: "https://www.sgs.com/en" },
      { name: "Sears think[box]", file: "thinkbox", url: "https://case.edu/thinkbox/" },
      { name: "Mastercam", file: "mastercam", url: "https://www.mastercam.com/" },
      { name: "Blaser Swisslube", file: "blaser-swisslube", url: "https://blaser.com/" },
      { name: "AutomationDirect", file: "automation-direct", url: "https://www.automationdirect.com/" },
      { name: "American Friction", file: "american-friction-technologies", url: "https://www.americanfriction.net/" },
      { name: "Clark", file: "clark", url: "http://www.clark-metal.com/" },
      { name: "Anodizing Specialists", file: "asi", url: "https://www.anodizingspecialists.com/" },
      { name: "Schunk", file: "schunk", url: "https://schunk.com/us/en" },
      { name: "Summit Racing", file: "summit-racing-logo", url: "https://www.summitracing.com/", png: true },
      { name: "3Dconnexion", file: "3dconnexion", url: "https://3dconnexion.com/us/" },
      { name: "HyperMill", file: "hypermill", url: "https://www.openmind-tech.com/en-us/cam/product-overview/" },
    ],
  },
  {
    label: "Bronze",
    key: "bronze",
    logoHeight: "h-10",
    sponsors: [
      { name: "Nord-Lock Group", file: "nord-lock-group", url: "https://www.nord-lock.com/en-us/" },
      { name: "Holley", file: "holley", url: "https://www.holley.com/", png: true },
      { name: "Southington Offroad", file: "southington", url: "https://southingtonoffroad.com/" },
      { name: "Performance Titanium Group", file: "ptg", url: "https://performancetitanium.com/" },
      { name: "Bolt Depot", file: "bolt-depot", url: "https://boltdepot.com/" },
      { name: "FK Rod Ends", file: "fk-rod-ends", url: "https://www.fkrodends.com/" },
      { name: "Fathom Realty", file: "fathom-realty-logo", url: "https://fathomrealty.com/", png: true },
      { name: "Micro-Measurements", file: "micro-measurements-logo", url: "https://www.micro-measurements.com/", png: true },
      { name: "OSH Cut", file: "oshcut-logo", url: "https://www.oshcut.com/", png: true },
      { name: "Stampede Die", file: "stampede-die-logo", url: "https://stampededie.com/", png: true },
      { name: "Zintilon", file: "zintilon", url: "https://www.zintilon.com/" },
      { name: "NSK", file: "nsk-logo", url: "https://www.nsk.com/", png: true },
      { name: "Commercial Steel Treating", file: "commercial-steel-logo", url: "https://www.commercialsteeltreating.com/", png: true },
      { name: "T-Mac Machine", file: "tmac-machine-logo", url: "", png: true },
      { name: "PPG", file: "ppg-logo", url: "https://www.ppg.com/", png: true },
      { name: "Carbide Depot", file: "carbide-depot", url: "https://www.carbidedepot.com/" },
      { name: "Titanium Joe", file: "titanium-joe", url: "https://www.titaniumjoe.com/" },
      { name: "SendCutSend", file: "sendcutsend", url: "https://sendcutsend.com/" },
      { name: "Bicycle Frame Depot", file: "bicycle-frame-depot", url: "https://bicycleframedepot.us/" },
      { name: "TrippWells", file: "trippwells", url: "https://www.trippwells.com/" },
      { name: "MoTeC", file: "motec", url: "https://www.milspecwiring.com/MoTeC_c_335.html" },
      { name: "Extreme Powder Coating", file: "extreme-powder-coating", url: "https://ohiopowdercoat.com/" },
      { name: "SimuTech Group", file: "simutech-group", url: "https://simutechgroup.com/" },
      { name: "Raising Cane's", file: "raising-canes", url: "https://raisingcanes.com/" },
      { name: "Meridian Laboratory", file: "meridian-laboratory", url: "https://www.meridianlab.com/" },
    ],
  },
];

const totalSponsors = tiers.reduce((acc, t) => acc + t.sponsors.length, 0);

function logoSrc(sponsor: Sponsor) {
  return sponsor.png
    ? `/logo/sponsor/${sponsor.file}.png`
    : `/logo/sponsor/svg/${sponsor.file}.svg`;
}

export default function SponsorsPage() {
  return (
    <>
      <Navbar />

      {/* Page header */}
      <section className="bg-bg pt-40 pb-0">
        <PageContainer>
          <h1
            className="font-coolvetica font-bold leading-[0.88] text-white"
            style={{ fontSize: "clamp(5rem, 10vw, 11rem)" }}
          >
            OUR <span className="text-red">SPONSORS.</span>
          </h1>

          <div className="mt-8 h-px w-full bg-white/8" />

          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-2">
            {[
              { value: String(totalSponsors) + "+", label: "Sponsors & Partners" },
              { value: String(tiers.length), label: "Tiers" },
              { value: "2026", label: "Season" },
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
        </PageContainer>
      </section>

      {/* Tier sections */}
      <section className="bg-bg py-20">
        <PageContainer>
          <div className="flex flex-col gap-24">
            {tiers.map((tier, i) => {
              const right = i % 2 === 1;
              return (
              <div key={tier.key} className={right ? "text-right" : ""}>
                {/* Tier header */}
                <div className="leading-none mb-12">
                  <div className="font-coolvetica font-bold text-[clamp(2rem,4vw,4rem)] tracking-wide text-white leading-none">
                    {tier.label.toUpperCase()}
                  </div>
                  <div className="font-brier font-semibold text-[clamp(2rem,4vw,4rem)] tracking-wide text-red leading-none -mt-2">
                    SPONSORS
                  </div>
                </div>

                {/* Logo row */}
                <div className={`flex flex-wrap items-center gap-x-20 gap-y-12 ${right ? "justify-end" : ""}`}>
                  {tier.sponsors.map((sponsor) => (
                    <a
                      key={sponsor.name}
                      href={sponsor.url || undefined}
                      target={sponsor.url ? "_blank" : undefined}
                      rel={sponsor.url ? "noopener noreferrer" : undefined}
                      className="group"
                    >
                      <Image
                        src={logoSrc(sponsor)}
                        alt={sponsor.name}
                        width={300}
                        height={100}
                        className={`${tier.logoHeight} w-auto max-w-full object-contain`}
                        style={{ filter: "brightness(0) invert(1)" }}
                      />
                    </a>
                  ))}
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
