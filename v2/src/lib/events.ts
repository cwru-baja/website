export interface BajaEvent {
  name: string;
  location: string;
  displayDate: string;
  startDate: Date;
  desc: string;
}

export const EVENTS: BajaEvent[] = [
  {
    name: "Baja SAE Arizona",
    location: "Marana, AZ",
    displayDate: "April 29 – May 2, 2027",
    startDate: new Date("2027-04-29T08:00:00"),
    desc: "Loose desert dirt, rocks, and heat outside Tucson, capped by a four-hour endurance race.",
  },
  {
    name: "Baja SAE Williamsport",
    location: "Williamsport, PA",
    displayDate: "May 20–23, 2027",
    startDate: new Date("2027-05-20T08:00:00"),
    desc: "Wooded Pennsylvania hills and tight, technical courses, with static engineering reviews before the endurance race.",
  },
  {
    name: "Baja SAE Michigan",
    location: "Marshall, MI",
    displayDate: "October 7–10, 2027",
    startDate: new Date("2027-10-07T08:00:00"),
    desc: "The closest stop to Cleveland this season: Midwest mud, maneuverability courses, and a four-hour endurance race.",
  },
];

// The season is the year its competitions run in.
export const SEASON = Math.max(...EVENTS.map((event) => event.startDate.getFullYear()));

// Every event runs four days from its start; after that it counts as raced.
const RACE_MS = 4 * 86_400_000;

export type EventStatus = "raced" | "live" | "upcoming";

export function eventStatus(event: BajaEvent, now: number): EventStatus {
  const start = event.startDate.getTime();
  if (now >= start + RACE_MS) return "raced";
  if (now >= start) return "live";
  return "upcoming";
}
