export interface BajaEvent {
  name: string;
  location: string;
  displayDate: string;
  startDate: Date;
  desc: string;
}

export const EVENTS: BajaEvent[] = [
  {
    name: "Baja SAE Oregon",
    location: "Washougal, WA",
    displayDate: "May 7–10, 2026",
    startDate: new Date("2026-05-07T08:00:00"),
    desc: "Timed hill climbs, rock crawls, and a four-hour endurance race across punishing Pacific Northwest terrain.",
  },
  {
    name: "Baja SAE New York",
    location: "Palmyra, NY",
    displayDate: "June 11–14, 2026",
    startDate: new Date("2026-06-11T08:00:00"),
    desc: "Technical off-road courses and static engineering reviews at one of the East Coast's premier Baja events.",
  },
  {
    name: "Baja SAE Ohio",
    location: "Nashport, OH",
    displayDate: "September 24–27, 2026",
    startDate: new Date("2026-09-24T08:00:00"),
    desc: "A hometown event for CWRU — deep mud, tight maneuverability courses, and a grueling endurance race close to campus.",
  },
];
