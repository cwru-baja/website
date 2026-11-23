import Navbar from "@/components/Navbar";

// The public site. One navbar for every page in this group, kept mounted
// across client-side navigation, so the dares bar's tape and countdown never
// restart between pages.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar daresBar />
      {children}
    </>
  );
}
