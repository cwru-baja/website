import DaresContent from "@/components/DaresContent";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Dare Us — CWRU Motorsports",
  description:
    "Giving Tuesday: pick a CWRU Baja member and a dare, donate, and they do it. Open until Dec 3.",
  alternates: { canonical: "/dares" },
};

export default function DaresPage() {
  return (
    <>
      <main className="bg-bg">
        <DaresContent />
      </main>
      <Footer />
    </>
  );
}
