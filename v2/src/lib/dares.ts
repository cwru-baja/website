import type { StaticImageData } from "next/image";

import type { HeadshotFraming } from "@/components/headshotFraming";
import { LEADERSHIP_TIERS } from "@/lib/team";

// "Dare us!" - the Giving Tuesday 2026 fundraiser from @cwrubaja's Instagram:
// a donor picks member(s) and a dare, gives the dare's price per person, and
// the member does it. /dares is the board; the site-wide bar points to it.
// When it runs is in daresEvent.ts, kept apart so the navbar can check it
// without pulling this member list into every page.

export type Dare = {
  id: string;
  title: string;
  /** Per member, in dollars. null: the member names the price. */
  price: number | null;
};

// Prices as updated on Instagram (they changed from the Nov 21 post).
export const DARES: Dare[] = [
  { id: "pie", title: "Pie to the face!", price: 7 },
  { id: "makeup", title: "Wear a makeup look for an entire GB (5:30pm to midnight)", price: 35 },
  { id: "ramen", title: "Spicy ramen challenge", price: 10 },
  { id: "stairs", title: "20 laps on think[box] stairs", price: 25 },
  { id: "meme", title: "Hand a professor or staff member a printed photo/meme of your choice!", price: 10 },
  { id: "gopro", title: "Commentate GoPro driving footage from comp", price: 7 },
  { id: "tortilla", title: "Tortilla slap challenge", price: 20 },
  { id: "shirt", title: "Wear a silly shirt or hat for the day", price: 20 },
  { id: "sat", title: "Take the SAT English section and reveal the score", price: 35 },
  { id: "ig-live", title: "Go on IG live, read the back of a chemical bottle, then end the live immediately", price: 10 },
  { id: "glaze", title: "Make a 1 minute video sincerely glazing the donor", price: 20 },
  { id: "babysit", title: "Babysit a tire or suspension arm for the entire day", price: 45 },
  { id: "imposter", title: "Food imposter challenge - soy sauce vs cola shots", price: 20 },
  { id: "reel", title: "Reel/TikTok challenge of your choice!", price: 10 },
  { id: "hot-seat", title: "Hot seat - rapid fire AMA", price: 15 },
  { id: "custom", title: "You pick the dare, I pick the price!", price: null },
];

export type DareMember = {
  name: string;
  image?: StaticImageData;
  framing?: Partial<HeadshotFraming>;
};

// The two "Who can you dare?" boards, in their order. Photos come from the
// Team page where one exists; everyone else is a name card.
const BOARD = [
  // Leadership edition
  "Zane Sandelin", "Arka Nath", "Amy Budzichowski", "Joshua Stout", "Shelley Wei",
  "Audrey Weaver", "Kurt Rehm", "Veronica Talan", "Matthew Alcantara", "Andrew Shen",
  "Bram Loren", "Ben Roy", "Zhansar Zhaparov", "Maureen Manning", "Lauren Metzler",
  "Sofia Acevedo", "Anthony Retelewski",
  // Everyone else
  "Phoebe Streiffer", "Davis Clarke", "Evelyn Sanchez", "Annelise Reilman", "Jake Meltzer",
  "Anjay Singla", "Aliya Nasim", "Kaavya Dhand-Kalluri", "Lev Edelson", "Ciaran Nimick",
  "June Budzichowski", "Benjamin Turner", "Gavin Zhang", "Cole Green", "Uddalak Sarkar",
  "Ellie Tochtrop", "James Mou", "Jessy Zhang", "Avaneesh Rao", "Jessica Shue",
  "Shubham Iyer", "Nate Leshin", "Wei", "Veer Mehta", "Charles Madland",
];

const photos = new Map(
  LEADERSHIP_TIERS.flatMap((tier) => tier.members)
    .filter((m) => !m.usesLogo)
    .map((m) => [m.name, { image: m.image as StaticImageData, framing: m.framing }]),
);

export const DARE_MEMBERS: DareMember[] = BOARD.map((name) => ({ name, ...photos.get(name) }));
