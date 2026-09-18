import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import CarSequence from "@/components/CarSequence";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Car — CWRU Motorsports",
  description: "Learn about the CWRU Baja SAE vehicle design and engineering.",
};

export default function CarPage() {
  return (
    <>
      <Navbar />

      {/* Page header */}
      <section className="bg-bg pt-40 pb-16">
        <PageContainer>
          <PageTitle lead="THE" accent="CAR." />
          <div className="mt-8 h-px w-full bg-white/8" />
        </PageContainer>
      </section>

      {/* Scroll-driven 360° sequence */}
      <CarSequence />

      <Footer />
    </>
  );
}
