import LogoIntro from "@/components/LogoIntro";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsSection from "@/components/StatsSection";
import SponsorsMarquee from "@/components/SponsorsMarquee";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <LogoIntro />
      <Navbar />
      <Hero />
      <StatsSection />
      <SponsorsMarquee />
      <Footer />
    </>
  );
}
