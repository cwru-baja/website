import DaresUpdate from "@/components/DaresUpdate";
import PageContainer from "@/components/PageContainer";

// Where a team member types in the Giving Tuesday total. Not linked, not in the
// sitemap, kept out of search; the relay guards the change with the team password.
export const metadata = {
  title: "Update dares total — CWRU Motorsports",
  robots: { index: false, follow: false },
};

export default function DaresUpdatePage() {
  return (
    <>
      <main className="min-h-svh bg-bg pt-28 pb-24">
        <PageContainer>
          <h1 className="font-coolvetica text-2xl tracking-wide text-white uppercase">
            Dares total
          </h1>
          <DaresUpdate />
        </PageContainer>
      </main>
    </>
  );
}
