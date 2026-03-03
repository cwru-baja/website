import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsSection from "@/components/StatsSection";
import HiredByTheBest from "@/components/HiredByTheBest";
import SponsorsMarquee from "@/components/SponsorsMarquee";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <StatsSection />
      <HiredByTheBest />
      <SponsorsMarquee />
      <Footer />
    </>
  );
}
