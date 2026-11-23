// "Dare us!" runs until the end of Dec 3, 2026, Eastern (per @cwrubaja). The
// site is a static export, so the switch happens in the browser (useDaresLive):
// after this moment the bar disappears and /dares becomes an "it's over" page,
// no rebuild needed. To end it early, move the date into the past.
export const DARES_ENDS_AT = Date.parse("2026-12-04T00:00:00-05:00");
export const DARES_END_LABEL = "Dec 3";
