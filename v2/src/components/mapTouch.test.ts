import { describe, expect, it } from "vitest";
import { dockCard, nearestWithin, tapAction, type DockInput } from "./mapTouch";

describe("nearestWithin", () => {
  const venues = [
    { id: "michigan", x: 100, y: 100 },
    { id: "oshkosh", x: 112, y: 106 },
  ];

  it("resolves a tap to the nearest venue inside the radius", () => {
    expect(nearestWithin(venues, 104, 101, 24)?.id).toBe("michigan");
    expect(nearestWithin(venues, 109, 105, 24)?.id).toBe("oshkosh");
  });

  it("accepts a tap well off the dot", () => {
    expect(nearestWithin(venues, 95, 121, 24)?.id).toBe("michigan");
  });

  it("returns null past the radius", () => {
    expect(nearestWithin(venues, 88, 125, 24)).toBeNull();
    expect(nearestWithin([], 0, 0, 24)).toBeNull();
  });
});

describe("tapAction", () => {
  it("opens, swaps and closes", () => {
    expect(tapAction(null, "ohio")).toBe("open");
    expect(tapAction("ohio", "illinois")).toBe("swap");
    expect(tapAction("ohio", "ohio")).toBe("close");
    expect(tapAction("ohio", null)).toBe("close");
    expect(tapAction(null, null)).toBe("none");
  });
});

// A 390x844 phone: the map is 326x175 and the card 374x263.
const phone = (mapTop: number, venueY = mapTop + 80, venueX = 200): DockInput => ({
  map: { left: 32, top: mapTop, width: 326, height: 175 },
  card: { width: 374, height: 263 },
  viewport: { width: 390, height: 844 },
  venueX,
  venueY,
  topInset: 64,
  gap: 12,
  margin: 8,
});

const onScreen = (input: DockInput) => {
  const { box } = dockCard(input);
  expect(box.left).toBeGreaterThanOrEqual(input.margin);
  expect(box.top).toBeGreaterThanOrEqual(input.margin);
  expect(box.left + box.width).toBeLessThanOrEqual(input.viewport.width - input.margin);
  expect(box.top + box.height).toBeLessThanOrEqual(input.viewport.height - input.margin);
};

describe("dockCard", () => {
  it("docks below the map, centred on it, when there's room", () => {
    const dock = dockCard(phone(200));
    expect(dock.side).toBe("below");
    expect(dock.scale).toBe(1);
    expect(dock.box).toEqual({ left: 8, top: 387, width: 374, height: 263 });
    expect([dock.x, dock.y]).toEqual([8, 387]);
  });

  it("centres on the map, not the screen", () => {
    const dock = dockCard({
      ...phone(200),
      map: { left: 64, top: 200, width: 640, height: 343 },
      card: { width: 480, height: 321 },
      viewport: { width: 1024, height: 1366 },
    });
    expect(dock.box.left).toBe(64 + 320 - 240);
  });

  it("goes above the map when below would run off the screen", () => {
    const dock = dockCard(phone(500));
    expect(dock.side).toBe("above");
    expect(dock.box.top).toBe(500 - 12 - 263);
  });

  it("stays clear of the navbar above the map", () => {
    // Above would reach 45px, under the 64px navbar; below runs off.
    const dock = dockCard(phone(320, 340));
    expect(dock.side).not.toBe("above");
    onScreen(phone(320, 340));
  });

  it("pins to the bottom when neither side fits, unless that hides the venue", () => {
    const small = (venueY: number): DockInput => ({
      map: { left: 32, top: 250, width: 256, height: 137 },
      card: { width: 304, height: 222 },
      viewport: { width: 320, height: 568 },
      venueX: 200,
      venueY,
      topInset: 64,
      gap: 12,
      margin: 8,
    });
    expect(dockCard(small(270)).side).toBe("bottom");
    expect(dockCard(small(270)).box.top).toBe(568 - 8 - 222);
    expect(dockCard(small(370)).side).toBe("top");
    expect(dockCard(small(370)).box.top).toBe(64);
    onScreen(small(270));
    onScreen(small(370));
  });

  it("moves aside from the venue when the card covers it either way up", () => {
    // An 844x390 phone held sideways: the map is taller than the screen.
    const landscape = (venueX: number): DockInput => ({
      map: { left: 32, top: -20, width: 780, height: 418 },
      card: { width: 480, height: 321 },
      viewport: { width: 844, height: 390 },
      venueX,
      venueY: 150,
      topInset: 72,
      gap: 12,
      margin: 8,
    });
    const east = dockCard(landscape(600));
    expect(east.box.left).toBe(8);
    expect(east.box.left + east.box.width).toBeLessThan(600);
    const west = dockCard(landscape(150));
    expect(west.box.left).toBe(844 - 8 - 480);
    onScreen(landscape(600));
    onScreen(landscape(150));
  });

  it("is always fully on screen, wherever the map is", () => {
    for (let top = -300; top <= 900; top += 7) {
      for (const venueY of [top + 10, top + 90, top + 170]) onScreen(phone(top, venueY));
    }
  });

  it("scales a card taller than the screen down to fit", () => {
    const input: DockInput = {
      map: { left: 32, top: 40, width: 504, height: 270 },
      card: { width: 480, height: 321 },
      viewport: { width: 568, height: 320 },
      venueX: 300,
      venueY: 120,
      topInset: 64,
      gap: 12,
      margin: 8,
    };
    const dock = dockCard(input);
    expect(dock.scale).toBeCloseTo(304 / 321);
    expect(dock.box.height).toBeCloseTo(304);
    onScreen(input);
    // The translate puts the centre-scaled card's corner on the box.
    expect(dock.x + (480 * (1 - dock.scale)) / 2).toBeCloseTo(dock.box.left);
    expect(dock.y + (321 * (1 - dock.scale)) / 2).toBeCloseTo(dock.box.top);
  });
});
