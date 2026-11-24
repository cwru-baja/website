import DaresUpdate from "@/components/DaresUpdate";
import PageContainer from "@/components/PageContainer";

// Where the team updates the Giving Tuesday total and reads the dare log. Not
// linked, not in the sitemap, kept out of search; the relay guards both with
// the team password.
export const metadata = {
  title: "Dares (team) — CWRU Motorsports",
  robots: { index: false, follow: false },
};

export default function DaresUpdatePage() {
  return (
    <>
      <main className="min-h-svh bg-bg pt-28 pb-24">
        <PageContainer>
          <DaresUpdate />
        </PageContainer>
      </main>
    </>
  );
}
