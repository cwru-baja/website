// The "THE TEAM." style header every inner page opens with.
//
// Desktop keeps the original size, clamp(5rem, 10vw, 11rem). Below that, the
// 5rem floor made "COMPETITION." 484px wide, wider than a phone, so a third
// limit caps the size at whatever lets the widest title word fit between
// PageContainer's 2rem gutters. That word is "COMPETITION.", which measures
// 6.05em in Coolvetica Bold; 6.2 leaves a little room. The cap only binds
// below about 560px, so tablet and desktop sizes are unchanged, and every page
// shares it so the titles stay the same size as you move between pages.
const WIDEST_WORD_EM = 6.2;

export default function PageTitle({
  lead,
  accent,
}: {
  lead: string;
  accent: string;
}) {
  return (
    <h1
      className="font-coolvetica font-bold leading-[0.88] text-white"
      style={{
        fontSize: `min(max(5rem, 10vw), 11rem, calc((100vw - 4rem) / ${WIDEST_WORD_EM}))`,
      }}
    >
      {lead} <span className="text-livery-ink">{accent}</span>
    </h1>
  );
}
