// Derives a team's history from public/baja-data.json, the source of truth for
// every result on the site. The file maps "<competition> <year>" to school to
// event to that school's row in SAE's published results.

// The Overall row also carries every event's score in a column named for the
// event and its maximum, e.g. "Cost Event (100)".
type EventRow = { Rank?: number | string; [column: string]: unknown };
export type BajaData = Record<string, Record<string, Record<string, EventRow>>>;

export interface Award {
  event: string;
  // Absent when the team entered the event but didn't place (DNF, no run).
  place?: number;
  points?: number;
  max?: number;
}

export interface CompetitionResult {
  name: string;
  // Entrants in the file, so it undercounts where a school's second car was lost.
  teams: number;
  awards: Award[];
}

export interface SeasonResult {
  year: string;
  // Place by cumulative overall points across every competition that season,
  // which is how SAE's Mike Schmidt Iron Team award ranks teams.
  seasonRank: number;
  // Top-three finishes that season, counting a competition's Overall alongside
  // the individual events.
  podiums: number;
  competitions: CompetitionResult[];
}

// SAE renamed events over the years; show each under one name.
const EVENT_NAMES: Record<string, string> = {
  "Cost Event": "Cost",
  "Design Event": "Design",
  Suspension: "Suspension & Traction",
  "Suspension and Traction": "Suspension & Traction",
  "S&T": "Suspension & Traction",
  Hill: "Hill Climb",
  Rock: "Rock Crawl",
  Manv: "Maneuverability",
  Accel: "Acceleration",
  Pres: "Sales Presentation",
  Pull: "Sled Pull",
  // Older Overall rows name their score columns differently again.
  "Land Manuverability": "Maneuverability",
  "Endurance Race": "Endurance",
  Presentation: "Sales Presentation",
  Pulling: "Sled Pull",
  // New York 2026 shortened them once more ("Cost" and "S&T" already resolve).
  Business: "Business Presentation",
};

// Overall, then the dynamic events, then the static events. Only one
// presentation name and a subset of the specialty events appear per year.
const EVENT_ORDER = [
  "Overall",
  "Acceleration",
  "Maneuverability",
  "Hill Climb",
  "Sled Pull",
  "Pilot Pull",
  "Rock Crawl",
  "Suspension & Traction",
  "Endurance",
  "Design",
  "Business Presentation",
  "Sales Presentation",
  "Cost",
];

// An event missing from EVENT_ORDER sorts last rather than disappearing.
const eventRank = (event: string) =>
  EVENT_ORDER.includes(event) ? EVENT_ORDER.indexOf(event) : EVENT_ORDER.length;

const VENUE_NAMES: Record<string, string> = {
  "Tennesse Tech": "Tennessee Tech",
};

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

// A bonus can push a score past its maximum (56.6 of 50), which reads as a
// data error, so those show points alone.
export function scoreLabel({ points, max }: Pick<Award, "points" | "max">): string {
  if (points === undefined || max === undefined) return "—";
  const shown = String(Number(points.toFixed(1)));
  return points > max ? `${shown} pts` : `${shown} / ${max}`;
}

export function isPodium(award: Award): boolean {
  return award.place !== undefined && award.place <= 3;
}

function parseCompetitionKey(key: string): { year: string; name: string } | null {
  const year = key.match(/\b(\d{4})\b/)?.[1];
  if (!year) return null;
  const venue = key.replace(year, "").trim();
  return { year, name: `Baja SAE ${VENUE_NAMES[venue] ?? venue}` };
}

const schoolId = (school: string) => school.trim().toLowerCase();

function scoreColumns(overall: EventRow | undefined): Map<string, { points: number; max: number }> {
  const scores = new Map<string, { points: number; max: number }>();
  for (const [column, points] of Object.entries(overall ?? {})) {
    const match = column.match(/^(.+) \((\d+)\)$/);
    if (!match || typeof points !== "number") continue;
    scores.set(EVENT_NAMES[match[1]] ?? match[1], { points, max: Number(match[2]) });
  }
  return scores;
}

export function seasonResults(data: BajaData, school: string): SeasonResult[] {
  const seasons = new Map<string, string[]>();
  for (const key of Object.keys(data)) {
    const parsed = parseCompetitionKey(key);
    if (!parsed) continue;
    seasons.set(parsed.year, [...(seasons.get(parsed.year) ?? []), key]);
  }

  const team = schoolId(school);
  const results: SeasonResult[] = [];

  for (const [year, keys] of seasons) {
    const totals = new Map<string, number>();
    const competitions: CompetitionResult[] = [];

    for (const key of keys) {
      for (const [entrant, events] of Object.entries(data[key])) {
        const points = events.Overall?.["Overall (1000)"];
        if (typeof points !== "number") continue;
        // Sum in hundredths so float drift can't split a tie.
        const id = schoolId(entrant);
        totals.set(id, (totals.get(id) ?? 0) + Math.round(points * 100));
      }

      const row = Object.entries(data[key]).find(([entrant]) => schoolId(entrant) === team)?.[1];
      if (!row) continue;
      const scores = scoreColumns(row.Overall);
      const awards: Award[] = [];
      for (const [event, { Rank }] of Object.entries(row)) {
        const name = EVENT_NAMES[event] ?? event;
        if (typeof Rank === "number") awards.push({ event: name, place: Rank, ...scores.get(name) });
        // Keep an unplaced event so every venue in a season lists the same events.
        else if (name !== "Overall") awards.push({ event: name, ...scores.get(name) });
      }
      awards.sort((a, b) => eventRank(a.event) - eventRank(b.event));
      competitions.push({
        name: parseCompetitionKey(key)!.name,
        teams: Object.keys(data[key]).length,
        awards,
      });
    }

    const teamPoints = totals.get(team);
    if (teamPoints === undefined || competitions.length === 0) continue;

    let ahead = 0;
    for (const points of totals.values()) if (points > teamPoints) ahead++;

    results.push({
      year,
      seasonRank: ahead + 1,
      podiums: competitions.flatMap((c) => c.awards).filter(isPodium).length,
      competitions,
    });
  }

  return results.sort((a, b) => Number(b.year) - Number(a.year));
}
