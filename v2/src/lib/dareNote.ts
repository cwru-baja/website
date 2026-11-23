import type { Dare } from "@/lib/dares";

// The line a donor pastes into Blackbaud's "Other (optional)" box so the team
// knows who does which dare:
//
//   DARE: Pie to the face! x2 + Spicy ramen challenge -> Zane Sandelin, Arka Nath
//
// /dares writes it and carries it to /donate in ?note=, where it is shown and
// copied. Both ends use this module, so the format lives in one place. Kept
// apart from lib/dares.ts so /donate doesn't load the member list.

const PREFIX = "DARE: ";
const ARROW = " -> ";

export function dareNote(dares: { dare: Dare; count: number }[], members: string[], customText = "") {
  const what = dares
    .map(({ dare, count }) => {
      const name = dare.price === null ? `Custom dare: ${customText.trim()}` : dare.title;
      return count > 1 ? `${name} x${count}` : name;
    })
    .join(" + ");
  return `${PREFIX}${what}${ARROW}${members.join(", ")}`;
}

/** The dares and the names, for display. null if the note isn't in this format. */
export function parseDareNote(note: string): { dares: string; who: string } | null {
  if (!note.startsWith(PREFIX)) return null;
  const body = note.slice(PREFIX.length);
  const split = body.lastIndexOf(ARROW);
  if (split < 0) return null;
  return { dares: body.slice(0, split), who: body.slice(split + ARROW.length) };
}
