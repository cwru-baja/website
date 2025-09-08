// src/pages/Support/Support.tsx

import styles from './Support.module.css';
import { Image, Button } from '@mantine/core';

import { HeaderSimple } from '../../../components/HeaderSimple/HeaderSimple.tsx';
import { FooterSocial } from '../../../components/FooterSocial/FooterSocial.tsx';
import { FadeIn } from '../../../components/FadeIn/FadeIn.tsx';
import { HeroSection } from "../../../components/HeroSection/HeroSection.tsx";
import heroImage from "../../../assets/images/LMF82642.jpg";
import tshirtImage from '../../../assets/images/cwru-baja-tshirt.png'
import { sponsors, type Sponsor } from '../../../config/sponsors';

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
                                <div className={styles.sponsorCard}>
                                    <Image
                                        src={sponsor.logo}
                                        alt={`${sponsor.name} logo`}
                                        className={styles.sponsorLogo}
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