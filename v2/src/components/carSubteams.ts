import type { Subteam } from "@/lib/team";

/**
 * The subteam that builds what each chapter shows, so the sequence says who is
 * behind the part it is pointing at. Typed as `Subteam`, and asserted against
 * CAR_CHAPTERS in the tests, so a renamed subteam or a new chapter fails the
 * build rather than shipping a name the team page doesn't have. The type is
 * imported for its type alone: lib/team pulls in every headshot.
 *
 * Chapters are named for the part on screen and subteams for the people, and
 * they read the same on every beat: the electronics beat keeps its id but is
 * titled Systems, the team's own word for it.
 */
export const CHAPTER_SUBTEAMS: Record<string, Subteam> = {
  brakes: "Brakes",
  frame: "Frame",
  drivetrain: "Drivetrain",
  electronics: "Systems",
  suspension: "Suspension",
};

export const subteamFor = (chapterId: string): Subteam | null =>
  CHAPTER_SUBTEAMS[chapterId] ?? null;
