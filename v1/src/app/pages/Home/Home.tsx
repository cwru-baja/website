import { HeaderSimple } from "../../../components/HeaderSimple/HeaderSimple.tsx";
import { FooterSocial } from "../../../components/FooterSocial/FooterSocial.tsx";
import { Button, Box } from "@mantine/core";
import heroImage from "../../../assets/images/LMF00234.jpg";
import styles from "./Home.module.css";
import "@mantine/carousel/styles.css";
import { FadeIn } from "../../../components/FadeIn/FadeIn.tsx";
import { HeroSection } from "../../../components/HeroSection/HeroSection.tsx";
import { LogoCarousel } from "../../../components/LogoCarousel/LogoCarousel.tsx";
import aboutImage from "../../../assets/images/LMF02596.jpg";
import tshirtImage from "../../../assets/images/cwru-baja-tshirt.png";
import { getAllSponsors } from "../../../config/sponsors.ts";

function DonationSection() {
  return (
    <FadeIn>
      <div className={styles.donationSection}>
        <h2 className={styles.donationTitle}>Donate</h2>
        <p className={styles.donationText}>
          Your generous contribution helps CWRU Baja SAE continue to design,
          build, and compete with our off-road vehicles. Donations directly
          support new equipment, materials, competition fees, and travel
          expenses for our team members.
        </p>
        <div className={styles.donationInstructions}>
          <strong>Important:</strong> Once reaching the giving form, find
          "other" in the gift designation field. Click on the plus sign and
          enter "Baja".
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
      <div className={styles.apparelSection}>
        <h2 className={styles.apparelTitle}>Apparel</h2>
        <div className={styles.apparelGrid}>
          <img
            src={tshirtImage}
            alt="CWRU Baja SAE Merch"
            className={styles.apparelImage}
          />
          <p className={styles.apparelText}>
            Support our team with official CWRU Motorsports apparel. By
            purchasing these items, you not only show your school spirit but
            also directly help fund new equipment, travel expenses, and
            competition fees for our team.{" "}
          </p>
        </div>

        <Button
          component="a"
          href="https://cwrum-merchstore.printful.me/"
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
                CWRU Baja SAE is a student-run engineering team dedicated to
                designing, building, testing, and racing an off-road vehicle for
                the international Baja SAE competition. Our diverse team brings
                together students from various engineering disciplines to tackle
                real-world challenges in vehicle design and performance. Through
                hands-on experience, we develop practical skills in engineering,
                project management, and teamwork that complement our academic
                studies. Join us as we push the boundaries of what's possible in
                off-road vehicle design!
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
            <img
              src={aboutImage}
              alt="CWRU Baja Team"
              className={styles.aboutImage}
            />
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
        <LogoCarousel sponsors={getAllSponsors()} />
      </div>
      <FooterSocial />
    </>
  );
}
