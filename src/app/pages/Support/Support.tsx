import styles from './Support.module.css';
import { Image, Button } from '@mantine/core';

import { HeaderSimple } from '../../../components/HeaderSimple/HeaderSimple.tsx';
import { FooterSocial } from '../../../components/FooterSocial/FooterSocial.tsx';
import { FadeIn } from '../../../components/FadeIn/FadeIn.tsx';
import { HeroSection } from "../../../components/HeroSection/HeroSection.tsx";
import heroImage from "../../../assets/images/LMF82642.jpg";
import tshirtImage from '../../../assets/images/cwru-baja-tshirt.png'

// ULTIMATE SPONSORS
import fox from '../../../assets/logo/sponsor/svg/fox.svg';
import bmt from '../../../assets/logo/sponsor/svg/bmt-aerospace.svg';
import enterline from '../../../assets/logo/sponsor/svg/enterline-foundation.svg';
import stifel from '../../../assets/logo/sponsor/svg/stifel.svg';
import caseAlumniAssociation from '../../../assets/logo/sponsor/svg/case-alumni-association.svg';

// PLATINUM SPONSORS
import speedMetals from '../../../assets/logo/sponsor/svg/spee-d-metals.svg';
import siemens from '../../../assets/logo/sponsor/svg/siemens.svg';
import altium from '../../../assets/logo/sponsor/svg/altium.svg';
import parker from '../../../assets/logo/sponsor/svg/parker.svg';

// GOLD SPONSORS
import jergens from '../../../assets/logo/sponsor/svg/jergens.svg';
import bwxt from '../../../assets/logo/sponsor/svg/bwxt.svg';
import orangeVise from '../../../assets/logo/sponsor/svg/orange-vise.svg';
import gmnBearing from '../../../assets/logo/sponsor/svg/gmn-bearing.svg';
import kissoft from '../../../assets/logo/sponsor/svg/kissoft.svg';
import skf from '../../../assets/logo/sponsor/svg/skf.svg';
import magna from '../../../assets/logo/sponsor/svg/magna.svg';
import ansys from '../../../assets/logo/sponsor/svg/ansys.svg';
import skamar from '../../../assets/logo/sponsor/svg/skamar.svg';
import haas from '../../../assets/logo/sponsor/svg/gene-haas-foundation.svg';

// SILVER SPONSORS
import tylok from '../../../assets/logo/sponsor/svg/tylok.svg';
import gmp from '../../../assets/logo/sponsor/svg/gmp-friction.svg';
import sgs from '../../../assets/logo/sponsor/svg/sgs.svg';
import kenesto from '../../../assets/logo/sponsor/svg/kenesto.svg';
import thinkbox from '../../../assets/logo/sponsor/svg/thinkbox.svg';
import michiganScientific from '../../../assets/logo/sponsor/svg/michigan-scientific.svg';
import mastercam from '../../../assets/logo/sponsor/svg/mastercam.svg';
import blaser from '../../../assets/logo/sponsor/svg/blaser-swisslube.svg';
import automationDirect from '../../../assets/logo/sponsor/svg/automation-direct.svg';
import americanFriction from '../../../assets/logo/sponsor/svg/american-friction-technologies.svg';
import clark from '../../../assets/logo/sponsor/svg/clark.svg';
import asi from '../../../assets/logo/sponsor/svg/asi.svg';
import schunk from '../../../assets/logo/sponsor/svg/schunk.svg';

// BRONZE SPONSORS
import nordlock from '../../../assets/logo/sponsor/svg/nord-lock-group.svg';
import southington from '../../../assets/logo/sponsor/svg/southington.svg';
import ptg from '../../../assets/logo/sponsor/svg/ptg.svg';
import boltDepot from '../../../assets/logo/sponsor/svg/bolt-depot.svg';
import fkRodEnds from '../../../assets/logo/sponsor/svg/fk-rod-ends.svg';
import altair from '../../../assets/logo/sponsor/svg/altair.svg';
import alro from '../../../assets/logo/sponsor/svg/alro.svg';

const sponsors = {
    ultimate: [
        {
            name: "Fox",
            logo: fox,
            url: "https://ridefox.com/",
            scale: 1
        },
        {
            name: "BMT Aerospace",
            logo: bmt,
            url: "https://bmtaerospace.com/",
            scale: 1
        },
        {
            name: "Enterline Foundation",
            logo: enterline,
            url: "https://enterlinefoundation.org/",
            scale: 1
        },
        {
            name: "Stifel",
            logo: stifel,
            url: "https://www.stifel.com/",
            scale: 1
        },
        {
            name: "Case Alumni Association",
            logo: caseAlumniAssociation,
            url: "https://casealumni.org/",
            scale: 1.25
        },
    ],
    platinum: [
        {
            name: "Speed Metals",
            logo: speedMetals,
            url: "https://speedmetals.com/",
            scale: 1
        },
        {
            name: "Siemens",
            logo: siemens,
            url: "https://www.siemens.com/global/en.html",
            scale: 1
        },
        {
            name: "Altium",
            logo: altium,
            url: "https://www.altium.com/",
            scale: 1.0
        },
        {
            name: "Parker",
            logo: parker,
            url: "https://www.parker.com/us/en/home.html",
            scale: 1.0
        },
    ],
    gold: [
        {
            name: "Jergens",
            logo: jergens,
            url: "https://www.jergensinc.com/",
            scale: 1.0
        },
        {
            name: "BWXT",
            logo: bwxt,
            url: "https://www.bwxt.com/",
            scale: 1.0
        },
        {
            name: "Orange Vise",
            logo: orangeVise,
            url: "https://www.orangevise.com/",
            scale: 1.0
        },
        {
            name: "GMN Bearing",
            logo: gmnBearing,
            url: "https://www.gmnbt.com/",
            scale: 1.0
        },
        {
            name: "KISSsoft",
            logo: kissoft,
            url: "https://www.kisssoft.com/en",
            scale: 1.0
        },
        {
            name: "SKF",
            logo: skf,
            url: "https://www.skf.com/us",
            scale: 1.0
        },
        {
            name: "Magna",
            logo: magna,
            url: "https://www.magna.com/",
            scale: 1.0
        },
        {
            name: "ANSYS",
            logo: ansys,
            url: "https://www.ansys.com/",
            scale: 1.0
        },
        {
            name: "Skamar",
            logo: skamar,
            url: "https://skamar.com/",
            scale: 1.0
        },
        {
            name: "Gene Haas Foundation",
            logo: haas,
            url: "https://www.ghaasfoundation.org/",
            scale: 1.0
        },
    ],
    silver: [
        {
            name: "Tylok",
            logo: tylok,
            url: "https://www.tylok.com/",
            scale: 1.0
        },
        {
            name: "GMP Friction",
            logo: gmp,
            url: "https://gmpfriction.com/",
            scale: 1.0
        },
        {
            name: "SGS",
            logo: sgs,
            url: "https://www.kyocera-sgstool.com/",
            scale: 1.0
        },
        {
            name: "Kenesto",
            logo: kenesto,
            url: "https://www.kenesto.com/",
            scale: 1.0
        },
        {
            name: "Sears think[box]",
            logo: thinkbox,
            url: "https://case.edu/thinkbox/",
            scale: 1.0
        },
        {
            name: "Michigan Scientific",
            logo: michiganScientific,
            url: "https://www.michsci.com/",
            scale: 1.0
        },
        {
            name: "Mastercam",
            logo: mastercam,
            url: "https://www.mastercam.com/",
            scale: 1.0
        },
        {
            name: "Blaser Swisslube",
            logo: blaser,
            url: "https://blaser.com/",
            scale: 1.0
        },
        {
            name: "AutomationDirect",
            logo: automationDirect,
            url: "https://www.automationdirect.com/adc/home/home",
            scale: 1.0
        },
        {
            name: "American Friction",
            logo: americanFriction,
            url: "https://www.americanfriction.net/",
            scale: 1.0
        },
        {
            name: "Clark",
            logo: clark,
            url: "http://www.clark-metal.com/",
            scale: 1.0
        },
        {
            name: "Anodizing Specialists",
            logo: asi,
            url: "https://www.anodizingspecialists.com/",
            scale: 1.0
        },
        {
            name: "Schunk",
            logo: schunk,
            url: "https://schunk.com/us/en",
            scale: 1.0
        },
    ],
    bronze: [
        {
            name: "Nord-Lock Group",
            logo: nordlock,
            url: "https://www.nord-lock.com/en-us/",
            scale: 1.0
        },
        {
            name: "Southington Offroad",
            logo: southington,
            url: "https://southingtonoffroad.com/",
            scale: 1.0
        },
        {
            name: "Performance Titanium Group",
            logo: ptg,
            url: "https://performancetitanium.com/",
            scale: 1.0
        },
        {
            name: "Bolt Depot",
            logo: boltDepot,
            url: "https://boltdepot.com/",
            scale: 1.0
        },
        {
            name: "FK Rod Ends",
            logo: fkRodEnds,
            url: "https://www.fkrodends.com/",
            scale: 1.0
        },
        {
            name: "Altair",
            logo: altair,
            url: "https://altair.com/",
            scale: 1.0
        },
        {
            name: "Alro",
            logo: alro,
            url: "https://www.alro.com/",
            scale: 1.0
        },
    ],
};

interface Sponsor {
    name: string;
    logo: string;
    url: string;
    scale: number;
}

function DonationSection() {
    return (
        <FadeIn>
            <div className={styles.donationSection}>
                <h2 className={styles.donationTitle}>Donate</h2>
                <p className={styles.donationText}>
                    Your generous contribution helps CWRU Baja SAE continue to design, build, and compete with our off-road vehicles. 
                    Donations directly support new equipment, materials, competition fees, and travel expenses for our team members.
                </p>
                <div className={styles.donationInstructions}>
                    <strong>Important:</strong> Once reaching the giving form, check "other" in the gift designation field and enter "Baja".
                </div>
                <Button
                    component="a"
                    href="https://www.givecampus.com/71er24"
                    target="_blank"
                    rel="noopener noreferrer"
                    size="lg"
                    className={styles.donationButton}
                    color="red"
                >
                    Donate Now
                </Button>
            </div>
        </FadeIn>
    );
}

function ApparelSection() {
    return (
        <FadeIn>
            <   div className={styles.apparelSection}>
                <h2 className={styles.apparelTitle}>Apparel</h2>
                <div className={styles.apparelGrid}>
                    <img src={tshirtImage} alt="CWRU Baja SAE Merch" className={styles.apparelImage} />
                    <p className={styles.apparelText}>
                        Support our team with official CWRU Motorsports apparel.
                        By purchasing these items, you not only show your school spirit but also directly help fund new equipment, travel expenses, and competition fees for our team.                    </p>
                </div>

                <Button
                    component="a"
                    href="https://cwrubaja.printful.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    size="lg"
                    className={styles.apparelButton}
                    color="red"
                >
                    Purchase
                </Button>
            </div>
        </FadeIn>
    );
}

function SponsorTier({ title, sponsors, tierClass }: {
    title: string;
    sponsors: Array<Sponsor>;
    tierClass: string;
}) {
    return (
        <FadeIn>
            <div className={`${styles.tierSection} ${styles[tierClass]}`}>
                <h2 className={styles.tierTitle}>{title} Sponsors</h2>
                <div className={styles.sponsorsGrid}>
                    {sponsors.map((sponsor, index) => (
                        <FadeIn key={sponsor.name} delay={index * 0.1}>
                            <a
                                href={sponsor.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.sponsorLink}
                            >
                                <div className={styles.sponsorWrapper}>
                                    <Image
                                        src={sponsor.logo}
                                        alt={`${sponsor.name} logo`}
                                        className={`${styles.sponsorLogo} ${styles.dynamicScale}`}
                                        data-scale={sponsor.scale}
                                        fit="contain"
                                    />
                                </div>
                            </a>
                        </FadeIn>
                    ))}
                </div>
            </div>
        </FadeIn>
    );
}

export default function Support() {
    return (
        <>
            <HeaderSimple />
                <div className={styles.mainContainer}>
                    <HeroSection
                        backgroundImage={heroImage}
                        title={"SUPPORT"}
                    />

                    <div className={styles.supportContainer}>
                        <DonationSection />
                        <ApparelSection />
                    </div>

                    <SponsorTier
                        title="Ultimate"
                        sponsors={sponsors.ultimate}
                        tierClass="ultimate"
                    />
                    <SponsorTier
                        title="Platinum"
                        sponsors={sponsors.platinum}
                        tierClass="platinum"
                    />
                    <SponsorTier
                        title="Gold"
                        sponsors={sponsors.gold}
                        tierClass="gold"
                    />
                    <SponsorTier
                        title="Silver"
                        sponsors={sponsors.silver}
                        tierClass="silver"
                    />
                    <SponsorTier
                        title="Bronze"
                        sponsors={sponsors.bronze}
                        tierClass="bronze"
                    />
                </div>
            <FooterSocial />
        </>
    );
}
