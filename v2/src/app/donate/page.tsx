import DonateView from "@/components/DonateView";

export const metadata = {
  title: "Donate — CWRU Motorsports",
  description: "Give to the CWRU Baja SAE team through the Case Alumni Association.",
  alternates: { canonical: "/donate" },
};

// Opened in a new tab from /support, so it is a focused checkout page: no nav
// or footer to wander off into, just the gift and the form.
export default function DonatePage() {
  return <DonateView />;
}
