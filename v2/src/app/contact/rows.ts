// Classes the contact ledger's link rows (page.tsx) and its email row
// (EmailRow.tsx) share, so the two kinds of row can't drift apart. A plain
// module, because a server page can't read strings out of a "use client" file.
//
// Hover matches the year rows of the results ledger (AllResultsSection): the
// whole row fills with the livery at once, no transition, and everything on it
// switches to the on-livery ink. Every cell therefore carries HOVER_INK, the
// copied state included, or it would turn teal on teal. From sm the content is
// inset from the fill's edges, as it is there; phones have no hover and no
// width to spare.
//
// Fixed tracks, not auto: every row is its own grid, so an auto column would
// start the descriptions at a different x on each row.
//
// Everything on a row's first line shares one baseline, at every width. From lg
// content-center floats that line in the middle of the row's fixed height, and
// the description is boxed at one line tall so a second line hangs below
// without pushing its own row's label up or making the row taller. The lg
// tracks are tighter than the xl ones to keep that description to two lines.
//
// Below lg a row is number / name / detail / icon on one line, with the
// description under the name. The widest pair is YOUTUBE + @CWRUMotorsports,
// and a 320px phone leaves the two of them 186px once the number, the icon and
// the gaps are paid for. So down there the number track and gaps tighten, the
// icon is 12px, and both type sizes scale with the viewport (name 18px, detail
// 11px: 177px). The name is back to full size by 460px, the detail by 415px.
const HOVER_INK = "group-hover:text-on-livery";

export const row =
  "group grid w-full grid-cols-[1.5rem_1fr_auto_1rem] items-baseline gap-x-2.5 py-6 text-left hover:bg-livery focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-livery sm:px-4 lg:min-h-28 lg:grid-cols-[4rem_1fr_1.6fr_11rem_1rem] lg:content-center lg:gap-x-8 xl:grid-cols-[6rem_1fr_1.4fr_12rem_1.5rem]";
export const number = `font-clash text-sm font-medium tracking-wide text-white/35 ${HOVER_INK}`;
export const name = `font-coolvetica text-[clamp(1.125rem,5.6vw,1.6rem)] font-bold leading-none tracking-wide text-white lg:text-[clamp(1.6rem,2.4vw,2.5rem)] ${HOVER_INK}`;
export const blurb = `col-span-3 col-start-2 row-start-2 mt-2 text-sm leading-relaxed text-white/50 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:mt-0 lg:h-[1.625em] ${HOVER_INK}`;
export const detail = `col-start-3 row-start-1 whitespace-nowrap text-right text-[clamp(0.6875rem,3.4vw,0.875rem)] lg:col-start-4 lg:text-sm ${HOVER_INK}`;
// No self-alignment: the row's items-baseline puts an svg's bottom edge on the
// text baseline, and the icons' viewBoxes are cropped to their strokes, so it is
// the drawn glyph that sits on the line and not an invisible margin under it.
export const icon = `col-start-4 row-start-1 size-3 justify-self-end lg:col-start-5 lg:size-4 ${HOVER_INK}`;
