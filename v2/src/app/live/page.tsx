import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import PageTitle from "@/components/PageTitle";
import LiveTelemetry from "@/components/live/LiveTelemetry";

// The team's private live view. Not in the nav or the sitemap, and kept out of
// search results. The page itself is public and holds no data: the telemetry
// arrives over a WebSocket that LiveTelemetry opens in the browser, and the
// relay sends nothing until it has the watch password.
export const metadata = {
  title: "Live — CWRU Motorsports",
  description: "The team's live view of the car on race day.",
  robots: { index: false, follow: false },
};
export default function LivePage() {
  return (
    // At least a screen tall. Behind the password box the page is shorter than
    // the window, and the footer's logo, which is cut off by the page's end on
    // purpose, would otherwise stop mid-screen with empty background below it.
    <div className="flex min-h-svh flex-col">
      <Navbar />

      <main className="flex-1 bg-bg pt-36 pb-24 sm:pt-40">
        <PageContainer>
          <PageTitle lead="LIVE" accent="TELEMETRY." />
          <LiveTelemetry />
        </PageContainer>
      </main>

      <Footer />
    </div>
  );
}
