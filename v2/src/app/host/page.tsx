import Navbar from "@/components/Navbar";
import PageContainer from "@/components/PageContainer";
import HostConsole from "@/components/host/HostConsole";

// The pit laptop's page. Deliberately not in the nav or the sitemap, and kept
// out of search results, but not secret: anyone can load it. What is guarded is
// streaming, which the relay only accepts with the team password.
export const metadata = {
  title: "Host — CWRU Motorsports",
  description: "Pit laptop: read the receiver board, stream to /live and record the race.",
  robots: { index: false, follow: false },
};

export default function HostPage() {
  return (
    <>
      <Navbar />

      {/* A working screen, not a page to read: no big title, the controls start
          just under the navbar. */}
      <main className="bg-bg pt-24 pb-24">
        <PageContainer>
          <h1 className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-white/35">Host mode</h1>
          <HostConsole />
        </PageContainer>
      </main>
    </>
  );
}
