import { describe, expect, it } from "vitest";
import { ordinal, scoreLabel, seasonResults, type BajaData } from "./results";

const row = (overall: number | string, points: number, events: Record<string, number | string> = {}) => ({
  Overall: { Rank: overall, "Overall (1000)": points },
  ...Object.fromEntries(Object.entries(events).map(([event, Rank]) => [event, { Rank }])),
});

describe("seasonResults", () => {
  it("ranks a season by cumulative overall points across every competition", () => {
    const data: BajaData = {
      "Ohio 2023": {
        Us: row(2, 800),
        Rival: row(1, 900),
        Other: row(3, 700),
      },
      "Oregon 2023": {
        Us: row(1, 900),
        Other: row(2, 850),
      },
      // We skipped this one, but the points it gave everyone else still count.
      "Oshkosh 2023": {
        Rival: row(1, 950),
      },
    };

    const [season] = seasonResults(data, "Us");

    expect(season.year).toBe("2023");
    expect(season.seasonRank).toBe(2);
    expect(season.competitions.map((c) => c.name)).toEqual(["Baja SAE Ohio", "Baja SAE Oregon"]);
  });

  it("shares a rank on tied points", () => {
    // 100.1 + 200.2 is 300.29999999999995 in floating point.
    const data: BajaData = {
      "Maryland 2025": { Us: row(2, 100.1), Rival: row(1, 300.3) },
      "Arizona 2025": { Us: row(1, 200.2), Rival: row(2, 0) },
    };

    expect(seasonResults(data, "Us")[0].seasonRank).toBe(1);
  });

  it("matches a school across competitions despite stray whitespace and case", () => {
    const data: BajaData = {
      "2014 Kansas ": { "Us ": row(1, 900), Rival: row(2, 600) },
      "2014 Illinois ": { us: row(2, 500), Rival: row(1, 700) },
    };

    const [season] = seasonResults(data, "Us");

    expect(season.seasonRank).toBe(1);
    expect(season.competitions.map((c) => c.name)).toEqual(["Baja SAE Kansas", "Baja SAE Illinois"]);
  });

  it("normalizes event names, keeps unplaced events without a place, and counts the overall finish as a podium", () => {
    const us = row(1, 900, { Accel: 3, Manv: "", Suspension: 12, "Design Event": 2 });
    // A team that didn't place still has its (zero) score for the event.
    Object.assign(us.Overall, { "Maneuverability (75)": 0 });
    const data: BajaData = { "Tennesse Tech 2022": { Us: us } };

    const [season] = seasonResults(data, "Us");

    expect(season.competitions[0]).toEqual({
      name: "Baja SAE Tennessee Tech",
      teams: 1,
      awards: [
        { event: "Overall", place: 1, points: 900, max: 1000 },
        { event: "Acceleration", place: 3 },
        { event: "Maneuverability", points: 0, max: 75 },
        { event: "Suspension & Traction", place: 12 },
        { event: "Design", place: 2 },
      ],
    });
    expect(season.competitions[0].awards[2]).not.toHaveProperty("place");
    // 1st overall, 3rd in acceleration, 2nd in design.
    expect(season.podiums).toBe(3);
  });

  it("scores each event from its column in the Overall row, under any of SAE's column names", () => {
    const us = row(4, 840.74, { Accel: 3, Manv: 36, "Business Presentation": 19, Endurance: 2 });
    Object.assign(us.Overall, {
      "Overall Dynamic (300)": 186.71,
      "Acceleration (75)": 73.17,
      "Land Manuverability (75)": 0,
      "Business Presentation (50)": 56.6,
      "Endurance Race (400)": "DNF",
    });
    const data: BajaData = { "2013 Rochester ": { Us: us, Rival: row(1, 950), Other: row(2, 900) } };

    const [competition] = seasonResults(data, "Us")[0].competitions;

    expect(competition.teams).toBe(3);
    expect(competition.awards).toEqual([
      { event: "Overall", place: 4, points: 840.74, max: 1000 },
      { event: "Acceleration", place: 3, points: 73.17, max: 75 },
      { event: "Maneuverability", place: 36, points: 0, max: 75 },
      { event: "Endurance", place: 2 },
      // Bonus points can take a score past its maximum.
      { event: "Business Presentation", place: 19, points: 56.6, max: 50 },
    ]);
  });

  it("reads the shortened score columns SAE used at New York 2026", () => {
    const us = row(1, 927.74, { "Business Presentation": 4, "Cost Event": 8, "Suspension & Traction": 2 });
    Object.assign(us.Overall, { "Business (50)": 70, "Cost (100)": 85.14, "S&T (75)": 67.69 });
    const data: BajaData = { "New York 2026": { Us: us } };

    const [competition] = seasonResults(data, "Us")[0].competitions;

    expect(competition.name).toBe("Baja SAE New York");
    expect(competition.awards).toEqual([
      { event: "Overall", place: 1, points: 927.74, max: 1000 },
      { event: "Suspension & Traction", place: 2, points: 67.69, max: 75 },
      { event: "Business Presentation", place: 4, points: 70, max: 50 },
      { event: "Cost", place: 8, points: 85.14, max: 100 },
    ]);
  });

  it("orders events overall first, then dynamic, then static, whatever order the file lists them in", () => {
    const data: BajaData = {
      "2014 Illinois ": {
        Us: row(42, 474.86, { Endurance: 32, Hill: 37, Rock: 59, Manv: 55, Accel: 21, Pres: 26, Design: 55, Cost: 34 }),
      },
    };

    const [competition] = seasonResults(data, "Us")[0].competitions;

    expect(competition.awards.map((a) => a.event)).toEqual([
      "Overall",
      "Acceleration",
      "Maneuverability",
      "Hill Climb",
      "Rock Crawl",
      "Endurance",
      "Design",
      "Sales Presentation",
      "Cost",
    ]);
  });

  it("lists seasons newest first and omits seasons the team sat out", () => {
    const data: BajaData = {
      "2013 Rochester ": { Us: row(5, 500) },
      "Kansas 2017": { Rival: row(1, 900) },
      "Carolina 2025": { Us: row(7, 800) },
    };

    expect(seasonResults(data, "Us").map((s) => s.year)).toEqual(["2025", "2013"]);
  });
});

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [42, "42nd"],
    [111, "111th"],
    [117, "117th"],
  ])("%i -> %s", (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});

describe("scoreLabel", () => {
  it.each([
    [{ points: 144, max: 150 }, "144 / 150"],
    [{ points: 823.25, max: 1000 }, "823.3 / 1000"],
    [{ points: 42.666666666666664, max: 50 }, "42.7 / 50"],
    [{ points: 0, max: 75 }, "0 / 75"],
    [{ points: 21.98, max: 75 }, "22 / 75"],
    [{ points: 56.6, max: 50 }, "56.6 pts"],
    [{}, "—"],
  ])("%o -> %s", (score, expected) => {
    expect(scoreLabel(score)).toBe(expected);
  });
});
