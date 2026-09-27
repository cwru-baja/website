import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import LiveTelemetry from "@/components/live/LiveTelemetry";

export const metadata = {
  title: "Live — CWRU Motorsports",
  description: "Follow the CWRU Motorsports Baja car live on race day: speed, engine, fuel, position and electronics, straight from the pit.",
  alternates: { canonical: "/live" },
};

// Static like every other page: the telemetry itself arrives over a WebSocket
// that LiveTelemetry opens in the browser.
export default function LivePage() {
  return (
    <>
      <Navbar />

      <main className="bg-bg pt-36 pb-24 sm:pt-40">
        <PageContainer>
          <PageTitle lead="LIVE" accent="TELEMETRY." />
          <LiveTelemetry />
        </PageContainer>
      </main>

      <Footer />
    </>
  );
}
