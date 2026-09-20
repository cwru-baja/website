import { describe, expect, it } from "vitest";
import { CAR_CHAPTERS } from "./carSequenceModel";
import { CHAPTER_SUBTEAMS, subteamFor } from "./carSubteams";

describe("CHAPTER_SUBTEAMS", () => {
  it("credits every chapter and nothing that is not one", () => {
    const chapters = CAR_CHAPTERS.map((chapter) => chapter.id).sort();
    // A new chapter with no subteam would scroll past with the last one's
    // credit still up; a stale key would be a subteam nothing ever shows.
    expect(Object.keys(CHAPTER_SUBTEAMS).sort()).toEqual(chapters);
    expect(CAR_CHAPTERS.map((chapter) => subteamFor(chapter.id))).not.toContain(null);
  });

  it("has no credit for a frame that is not a chapter", () => {
    expect(subteamFor("cockpit-run")).toBeNull();
  });
});
