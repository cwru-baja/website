import { HeaderSimple } from '../../../components/HeaderSimple/HeaderSimple.tsx';
import { FooterSocial } from '../../../components/FooterSocial/FooterSocial.tsx';
import { Button, Box } from '@mantine/core';
import heroImage from '../../../assets/images/LMF00234.jpg';
import styles from './Home.module.css';
import '@mantine/carousel/styles.css';
import { FadeIn } from '../../../components/FadeIn/FadeIn.tsx';
import { HeroSection } from "../../../components/HeroSection/HeroSection.tsx";
import { LogoCarousel } from "../../../components/LogoCarousel/LogoCarousel.tsx";
import aboutImage from '../../../assets/images/LMF02596.jpg';

import gmnBearingLogo from '../../../assets/logo/sponsor/svg/gmn-bearing.svg';
import jergensLogo from '../../../assets/logo/sponsor/svg/jergens.svg';
import bwxtLogo from '../../../assets/logo/sponsor/svg/bwxt.svg';
import orangeViseLogo from '../../../assets/logo/sponsor/svg/orange-vise.svg';
import kissoftLogo from '../../../assets/logo/sponsor/svg/kissoft.svg';
import skfLogo from '../../../assets/logo/sponsor/svg/skf.svg';
import tylokLogo from '../../../assets/logo/sponsor/svg/tylok.svg';
import gmpFrictionLogo from '../../../assets/logo/sponsor/svg/gmp-friction.svg';
import siemensLogo from '../../../assets/logo/sponsor/svg/siemens.svg';
import magnaLogo from '../../../assets/logo/sponsor/svg/magna.svg';
import sgsLogo from '../../../assets/logo/sponsor/svg/sgs.svg';
import altiumLogo from '../../../assets/logo/sponsor/svg/altium.svg';
import kenestoLogo from '../../../assets/logo/sponsor/svg/kenesto.svg';
import ansysLogo from '../../../assets/logo/sponsor/svg/ansys.svg';
import skamarLogo from '../../../assets/logo/sponsor/svg/skamar.svg';
import schunkLogo from '../../../assets/logo/sponsor/svg/schunk.svg';
import thinkboxLogo from '../../../assets/logo/sponsor/svg/thinkbox.svg';
import michiganScientificLogo from '../../../assets/logo/sponsor/svg/michigan-scientific.svg';
import mastercamLogo from '../../../assets/logo/sponsor/svg/mastercam.svg';
import blaserSwisslubeLogo from '../../../assets/logo/sponsor/svg/blaser-swisslube.svg';
import speedMetalsLogo from '../../../assets/logo/sponsor/svg/spee-d-metals.svg';
import automationDirectLogo from '../../../assets/logo/sponsor/svg/automation-direct.svg';
import nordLockGroupLogo from '../../../assets/logo/sponsor/svg/nord-lock-group.svg';
import southingtonLogo from '../../../assets/logo/sponsor/svg/southington.svg';
import geneHaasFoundationLogo from '../../../assets/logo/sponsor/svg/gene-haas-foundation.svg';
import americanFrictionLogo from '../../../assets/logo/sponsor/svg/american-friction-technologies.svg';
import ptgLogo from '../../../assets/logo/sponsor/svg/ptg.svg';
import boltDepotLogo from '../../../assets/logo/sponsor/svg/bolt-depot.svg';
import clarkLogo from '../../../assets/logo/sponsor/svg/clark.svg';
import fkRodEndsLogo from '../../../assets/logo/sponsor/svg/fk-rod-ends.svg';
import asiLogo from '../../../assets/logo/sponsor/svg/asi.svg';
import altairLogo from '../../../assets/logo/sponsor/svg/altair.svg';
import alroLogo from '../../../assets/logo/sponsor/svg/alro.svg';
import foxLogo from '../../../assets/logo/sponsor/svg/fox.svg';
import bmtAerospaceLogo from '../../../assets/logo/sponsor/svg/bmt-aerospace.svg';
import enterlineFoundationLogo from '../../../assets/logo/sponsor/svg/enterline-foundation.svg';
import stifelLogo from '../../../assets/logo/sponsor/svg/stifel.svg';
import parkerLogo from '../../../assets/logo/sponsor/svg/parker.svg';
import caseAlumniLogo from '../../../assets/logo/sponsor/svg/case-alumni-association.svg';
import tshirtImage from "../../../assets/images/cwru-baja-tshirt.png";


const sponsors = [
    { logo: gmnBearingLogo, link: "https://www.gmnbt.com/" },
    { logo: jergensLogo, link: "https://www.jergensinc.com/" },
    { logo: bwxtLogo, link: "https://www.bwxt.com/" },
    { logo: orangeViseLogo, link: "https://www.orangevise.com/" },
    { logo: kissoftLogo, link: "https://www.kisssoft.com/" },
    { logo: skfLogo, link: "https://www.skf.com/us" },
    { logo: tylokLogo, link: "https://www.tylok.com/" },
    { logo: gmpFrictionLogo, link: "https://www.gmp-friction.com/" },
    { logo: siemensLogo, link: "https://www.siemens.com/" },
    { logo: magnaLogo, link: "https://www.magna.com/" },
    { logo: sgsLogo, link: "https://www.kyocera-sgstool.com/" },
    { logo: altiumLogo, link: "https://www.altium.com/" },
    { logo: kenestoLogo, link: "https://www.kenesto.com/" },
    { logo: ansysLogo, link: "https://www.ansys.com/" },
    { logo: skamarLogo, link: "https://www.skamar.com/" },
    { logo: schunkLogo, link: "https://www.schunk.com/" },
    { logo: thinkboxLogo, link: "https://case.edu/thinkbox/" },
    { logo: michiganScientificLogo, link: "https://www.michsci.com/" },
    { logo: mastercamLogo, link: "https://www.mastercam.com/" },
    { logo: blaserSwisslubeLogo, link: "https://www.blaser.com/" },
    { logo: speedMetalsLogo, link: "https://speedmetals.com/" },
    { logo: automationDirectLogo, link: "https://www.automationdirect.com/" },
    { logo: nordLockGroupLogo, link: "https://www.nord-lock.com/" },
    { logo: southingtonLogo, link: "https://southingtonoffroad.com/" },
    { logo: geneHaasFoundationLogo, link: "https://ghaasfoundation.org/" },
    { logo: americanFrictionLogo, link: "https://www.americanfriction.net/" },
    { logo: ptgLogo, link: "https://performancetitanium.com/" },
    { logo: boltDepotLogo, link: "https://www.boltdepot.com/" },
    { logo: clarkLogo, link: "http://www.clark-metal.com/" },
    { logo: fkRodEndsLogo, link: "https://www.fkrodends.com/" },
    { logo: asiLogo, link: "https://www.anodizingspecialists.com/" },
    { logo: altairLogo, link: "https://www.altair.com/" },
    { logo: alroLogo, link: "https://www.alro.com/" },
    { logo: foxLogo, link: "https://www.ridefox.com/" },
    { logo: bmtAerospaceLogo, link: "https://bmtaerospace.com/" },
    { logo: enterlineFoundationLogo, link: "https://enterlinefoundation.org/" },
    { logo: stifelLogo, link: "https://www.stifel.com/" },
    { logo: parkerLogo, link: "https://www.parker.com/" },
    { logo: caseAlumniLogo, link: "https://casealumni.org/" },
];

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
                    <strong>Important:</strong> Once reaching the giving form, find "other" in the gift designation field. Click on the plus sign and enter "Baja".
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

export default function Home() {
    return (
        <>
            <HeaderSimple />
            <div className={styles.mainContainer}>
                <HeroSection backgroundImage={heroImage} title="CWRU BAJA" />
                <FadeIn direction="up" delay={0.2}>
                    <div className={styles.aboutContainer}>
                        <div className={styles.textContainer}>
                            <h1 className={styles.aboutTitle}>About Us</h1>
                            <div className={styles.aboutText}>
                                CWRU Baja SAE is a student-run engineering team dedicated to designing, building, testing, and racing an off-road vehicle for the international Baja SAE competition. Our diverse team brings together students from various engineering disciplines to tackle real-world challenges in vehicle design and performance. Through hands-on experience, we develop practical skills in engineering, project management, and teamwork that complement our academic studies. Join us as we push the boundaries of what's possible in off-road vehicle design!
                            </div>
                            <Box mt={40}>
                                <div className={styles.buttonGroup}>
                                    <Button
                                        variant="filled"
                                        color="red"
                                        size="md"
                                        component="a"
                                        href="/competition"
                                        className={styles.actionButton}
                                        radius="md"
                                    >
                                        Learn More
                                    </Button>
                                    <Button
                                        variant="outline"
                                        color="red"
                                        size="md"
                                        component="a"
                                        href="/social"
                                        className={styles.actionButton}
                                        radius="md"
                                    >
                                        Contact Us
                                    </Button>
                                    <Button
                                        variant="filled"
                                        color="orange"
                                        size="md"
                                        component="a"
                                        href="/support"
                                        className={styles.actionButton}
                                        radius="md"
                                    >
                                        Support Us
                                    </Button>
                                </div>
                            </Box>
                        </div>
                        <img src={aboutImage} alt="CWRU Baja Team" className={styles.aboutImage} />
                    </div>
                </FadeIn>

                <FadeIn>
                    <div className={styles.supportContainer}>
                        <DonationSection />
                        <ApparelSection />
                    </div>
                </FadeIn>

                <FadeIn direction="up" delay={0.3}>
                    <div className={styles.videoContainer}>
                        <iframe
                            src="https://www.youtube.com/embed/wtBAbLzCRr0"
                            title="YouTube video player"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                </FadeIn>
                <LogoCarousel sponsors={sponsors} />
            </div>
            <FooterSocial />
        </>
    );
}

