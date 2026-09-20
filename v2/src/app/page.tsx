import LogoIntro from "@/components/LogoIntro";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsSection from "@/components/StatsSection";
import SponsorsMarquee from "@/components/SponsorsMarquee";
import Footer from "@/components/Footer";

// Title and description come from the root layout; this only pins the
// canonical, which is not inherited in a useful form - a canonical set on the
// layout would claim every page is the home page.
export const metadata = {
  alternates: { canonical: "/" },
};

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
