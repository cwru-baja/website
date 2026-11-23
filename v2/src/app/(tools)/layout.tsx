import Navbar from "@/components/Navbar";

// Team-only tools (/host, /live, /dares/update): the site's navbar, without
// the dares bar. Not linked from the nav, and kept out of search by each page.
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar daresBar={false} />
      {children}
    </>
  );
}
