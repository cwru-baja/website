import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsSection from "@/components/StatsSection";
import AboutSection from "@/components/AboutSection";
import CompetitionSection from "@/components/CompetitionSection";
import SponsorsMarquee from "@/components/SponsorsMarquee";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <StatsSection />
      <AboutSection />
      <CompetitionSection />
      <SponsorsMarquee />
    </>
  );
}
