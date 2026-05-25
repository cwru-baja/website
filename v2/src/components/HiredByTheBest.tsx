import DottedMap from "dotted-map";
import { USADotMap } from "./USADotMap";
import type { CompetitionMarker } from "./CompetitionCard";

// All unique Baja SAE venues CWRU has competed at
const VENUES: (Omit<CompetitionMarker, "svgX" | "svgY"> & { lat: number; lng: number })[] = [
  { id: "oregon",       name: "Baja SAE Oregon",        location: "Washougal, WA",      lat: 45.5987, lng: -122.3485 },
  { id: "ohio",         name: "Baja SAE Ohio",           location: "Nashport, OH",        lat: 40.0356, lng: -82.0471  },
  { id: "carolina",     name: "Baja SAE Carolina",       location: "Cullowhee, NC",       lat: 35.3043, lng: -83.1674  },
  { id: "maryland",     name: "Baja SAE Maryland",       location: "Mechanicsville, MD",  lat: 38.4329, lng: -76.7516  },
  { id: "arizona",      name: "Baja SAE Arizona",        location: "Chandler, AZ",        lat: 33.3062, lng: -111.9125 },
  { id: "michigan",     name: "Baja SAE Michigan",       location: "Bark River, MI",      lat: 45.9127, lng: -87.2161  },
  { id: "williamsport", name: "Baja SAE Williamsport",   location: "Williamsport, PA",    lat: 41.2412, lng: -77.0011  },
  { id: "california",   name: "Baja SAE California",     location: "Temecula, CA",        lat: 33.4927, lng: -116.9514 },
  { id: "oshkosh",      name: "Baja SAE Oshkosh",        location: "Oshkosh, WI",         lat: 44.0247, lng: -88.5426  },
  { id: "tennessee",    name: "Baja SAE Tennessee Tech", location: "Cookeville, TN",      lat: 36.1628, lng: -85.5016  },
  { id: "rochester",    name: "Baja SAE Rochester",      location: "Rochester, NY",       lat: 43.1300, lng: -77.6200  },
  { id: "kansas",       name: "Baja SAE Kansas",         location: "Pittsburg, KS",       lat: 37.4108, lng: -94.7052  },
  { id: "auburn",       name: "Baja SAE Auburn",         location: "Auburn, AL",          lat: 32.6099, lng: -85.4808  },
  { id: "illinois",     name: "Baja SAE Illinois",       location: "Peoria, IL",          lat: 40.6936, lng: -89.5890  },
];

export default function HiredByTheBest() {
  const map = new DottedMap({
    height: 60,
    grid: "diagonal",
    countries: ["USA"],
    region: { lat: { min: 24.5, max: 49.5 }, lng: { min: -125, max: -66 } },
  });

  for (const v of VENUES) {
    map.addPin({ lat: v.lat, lng: v.lng, svgOptions: { color: "#bc2121", radius: 0.22 } });
  }

  const allPoints = map.getPoints();
  const regularPoints = allPoints.filter((p) => !p.svgOptions);
  const pinPoints    = allPoints.filter((p) => !!p.svgOptions);

  const redIndices = new Set<number>();
  const competitions: CompetitionMarker[] = pinPoints.map((pin, i) => {
    regularPoints
      .map((p, idx) => {
        const dx = p.x - pin.x;
        const dy = p.y - pin.y;
        return { idx, dist: dx * dx + dy * dy };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3)
      .forEach(({ idx }) => redIndices.add(idx));

    return {
      id:       VENUES[i].id,
      name:     VENUES[i].name,
      location: VENUES[i].location,
      svgX:     Math.round(pin.x * 10) / 10,
      svgY:     Math.round(pin.y * 10) / 10,
    };
  });

  const dots = regularPoints.map(
    (p, i) =>
      [
        Math.round(p.x * 10) / 10,
        Math.round(p.y * 10) / 10,
        redIndices.has(i) ? 1 : 0,
      ] as [number, number, 0 | 1]
  );

  return (
    <section className="bg-bg py-24">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24">

        <div className="leading-none mb-10 text-right">
          <div className="font-coolvetica font-bold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-white leading-none">
            BEHIND
          </div>
          <div className="font-brier font-semibold text-[clamp(2rem,4.5vw,5rem)] tracking-wide text-red leading-none -mt-3">
            THE BUILD
          </div>
        </div>

        <USADotMap dots={dots} competitions={competitions} viewBox="0 0 112 60" />

      </div>
    </section>
  );
}
