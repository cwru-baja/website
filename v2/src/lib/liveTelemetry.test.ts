import { describe, expect, it } from "vitest";

import {
  INITIAL_STATE,
  LIVE_WINDOW_MS,
  TRAIL_WINDOW_MS,
  extendTrail,
  formatAgo,
  gpsPosition,
  hasTelemetry,
  latestSignal,
  liveStatus,
  mergeLatest,
  parseViewerMessage,
  reconnectDelay,
  reduceLive,
  type LiveFrame,
  type LiveState,
  type ViewerMessage,
} from "./liveTelemetry";

const T0 = Date.parse("2026-09-26T16:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

function fast(at: number, extra: Partial<Record<string, unknown>> = {}): LiveFrame {
  return {
    kind: "fast",
    receivedAt: iso(at),
    rssi: -70,
    snr: 8,
    packet: {
      type: "fast",
      primary_rpm: 3000,
      output_rpm: 1100,
      speed_mph: 25,
      latitude_deg: 41.5,
      longitude_deg: -81.61,
      ...extra,
    } as LiveFrame["packet"],
  };
}

function slow(at: number): LiveFrame {
  return {
    kind: "slow",
    receivedAt: iso(at),
    rssi: -90,
    snr: 2,
    packet: {
      type: "slow",
      board_statuses: {
        wheel: true, f_HFU: true, r_HFU: true, fl_vcmom: true, fr_vcmom: true,
        rl_vcmom: true, rr_vcmom: true, pi: true, pmu: false, gofobomo: true,
      },
      setpoints: [0, 0, 0, 0],
      fuel_percent: 64,
      deg: [0, 0],
      altitude_deg: 0,
    },
  };
}

const message = (m: ViewerMessage, now: number) => ({ type: "message" as const, message: m, now });

function connected(): LiveState {
  let state = reduceLive(INITIAL_STATE, { type: "socket", status: "open" });
  state = reduceLive(
    state,
    message({ t: "snapshot", latest: {}, publisher: { connected: true, lastSeenAt: null } }, T0),
  );
  return state;
}

describe("reduceLive", () => {
  it("fills in from a snapshot, so a late joiner sees values at once", () => {
    const f = fast(T0 - 200);
    const s = slow(T0 - 900);
    const state = reduceLive(
      reduceLive(INITIAL_STATE, { type: "socket", status: "open" }),
      message({ t: "snapshot", latest: { fast: f, slow: s }, publisher: { connected: true, lastSeenAt: iso(T0 - 200) } }, T0),
    );
    expect(state.synced).toBe(true);
    expect(state.latest).toEqual({ fast: f, slow: s });
    expect(state.lastFrameAt).toBe(T0 - 200);
    expect(state.trail).toHaveLength(1);
    expect(liveStatus(state, T0)).toEqual({ kind: "live" });
  });

  it("an empty snapshot leaves nothing to show", () => {
    const state = reduceLive(
      reduceLive(INITIAL_STATE, { type: "socket", status: "open" }),
      message({ t: "snapshot", latest: {}, publisher: { connected: false, lastSeenAt: null } }, T0),
    );
    expect(hasTelemetry(state)).toBe(false);
    expect(state.lastFrameAt).toBeNull();
    expect(liveStatus(state, T0)).toEqual({ kind: "offline", lastSeen: null });
  });

  it("takes newer frames and keeps the newest over backfill", () => {
    let state = connected();
    state = reduceLive(state, message({ t: "frames", frames: [fast(T0 + 1000, { speed_mph: 30 })] }, T0 + 1100));
    state = reduceLive(state, message({ t: "frames", frames: [fast(T0 - 60_000, { speed_mph: 3 })] }, T0 + 1200));
    expect((state.latest.fast?.packet as { speed_mph: number }).speed_mph).toBe(30);
    // Backfill still counts as hearing from the car.
    expect(state.lastFrameAt).toBe(T0 + 1200);
  });

  it("marks the publisher connected when frames arrive", () => {
    let state = reduceLive(connected(), message({ t: "publisher", connected: false, lastSeenAt: null }, T0));
    state = reduceLive(state, message({ t: "frames", frames: [fast(T0)] }, T0 + 50));
    expect(state.publisher.connected).toBe(true);
  });

  it("ignores an empty frames message", () => {
    const state = connected();
    expect(reduceLive(state, message({ t: "frames", frames: [] }, T0))).toBe(state);
  });

  it("returns the same state for a socket status it already has", () => {
    const state = connected();
    expect(reduceLive(state, { type: "socket", status: "open" })).toBe(state);
  });

  it("keeps the last values while reconnecting", () => {
    let state = reduceLive(connected(), message({ t: "frames", frames: [fast(T0)] }, T0));
    state = reduceLive(state, { type: "socket", status: "closed" });
    expect(state.latest.fast).toBeDefined();
    expect(liveStatus(state, T0 + 100)).toEqual({ kind: "reconnecting", firstTime: false });
  });
});

describe("unreachable", () => {
  it("is set when an attempt fails before any snapshot, and cleared by one", () => {
    let state = reduceLive(INITIAL_STATE, { type: "socket", status: "closed" });
    expect(state.unreachable).toBe(true);
    expect(liveStatus(state, T0)).toEqual({ kind: "reconnecting", firstTime: false });
    state = reduceLive(reduceLive(state, { type: "socket", status: "connecting" }), { type: "socket", status: "open" });
    state = reduceLive(state, message({ t: "snapshot", latest: {}, publisher: { connected: false, lastSeenAt: null } }, T0));
    expect(state.unreachable).toBe(false);
  });

  it("is not set by a drop after syncing", () => {
    expect(reduceLive(connected(), { type: "socket", status: "closed" }).unreachable).toBe(false);
  });
});

describe("liveStatus", () => {
  it("is reconnecting until the first snapshot", () => {
    expect(liveStatus(INITIAL_STATE, T0)).toEqual({ kind: "reconnecting", firstTime: true });
    const open = reduceLive(INITIAL_STATE, { type: "socket", status: "open" });
    expect(liveStatus(open, T0).kind).toBe("reconnecting");
  });

  it("goes offline when frames stop, even with the publisher connected", () => {
    const state = reduceLive(connected(), message({ t: "frames", frames: [fast(T0)] }, T0));
    expect(liveStatus(state, T0 + LIVE_WINDOW_MS - 1)).toEqual({ kind: "live" });
    expect(liveStatus(state, T0 + LIVE_WINDOW_MS)).toEqual({ kind: "offline", lastSeen: T0 });
  });

  it("goes offline as soon as the publisher leaves", () => {
    let state = reduceLive(connected(), message({ t: "frames", frames: [fast(T0)] }, T0));
    state = reduceLive(state, message({ t: "publisher", connected: false, lastSeenAt: iso(T0) }, T0 + 100));
    expect(liveStatus(state, T0 + 200)).toEqual({ kind: "offline", lastSeen: T0 });
  });

  it("reports the relay's last-seen time for a car that left before we came", () => {
    const state = reduceLive(
      reduceLive(INITIAL_STATE, { type: "socket", status: "open" }),
      message({ t: "snapshot", latest: { fast: fast(T0 - 600_000) }, publisher: { connected: false, lastSeenAt: iso(T0 - 600_000) } }, T0),
    );
    expect(liveStatus(state, T0)).toEqual({ kind: "offline", lastSeen: T0 - 600_000 });
  });
});

describe("mergeLatest", () => {
  it("replaces only with strictly newer frames, per kind", () => {
    const held = fast(T0);
    expect(mergeLatest({ fast: held }, [fast(T0)]).fast).toBe(held);
    expect(mergeLatest({ fast: held }, [fast(T0 - 1)]).fast).toBe(held);
    const newer = fast(T0 + 1);
    expect(mergeLatest({ fast: held }, [newer]).fast).toBe(newer);
    const s = slow(T0 - 5000);
    expect(mergeLatest({ fast: held }, [s])).toEqual({ fast: held, slow: s });
  });
});

describe("extendTrail", () => {
  it("adds fast positions and skips frames without a fix", () => {
    const trail = extendTrail([], [
      fast(T0, { latitude_deg: null, longitude_deg: null }),
      fast(T0 + 200, { latitude_deg: 0, longitude_deg: 0 }),
      fast(T0 + 400),
      slow(T0 + 500),
    ]);
    expect(trail).toEqual([{ t: T0 + 400, lat: 41.5, lon: -81.61 }]);
  });

  it("puts backfilled points in time order and drops duplicates", () => {
    let trail = extendTrail([], [fast(T0), fast(T0 + 2000)]);
    trail = extendTrail(trail, [fast(T0 + 1000, { latitude_deg: 41.6 }), fast(T0 + 2000)]);
    expect(trail.map((p) => p.t)).toEqual([T0, T0 + 1000, T0 + 2000]);
    expect(trail[1].lat).toBe(41.6);
  });

  it("forgets points older than the window", () => {
    const trail = extendTrail([], [fast(T0), fast(T0 + TRAIL_WINDOW_MS / 2), fast(T0 + TRAIL_WINDOW_MS + 1)]);
    expect(trail.map((p) => p.t)).toEqual([T0 + TRAIL_WINDOW_MS / 2, T0 + TRAIL_WINDOW_MS + 1]);
  });

  it("returns the same array when nothing is added", () => {
    const trail = extendTrail([], [fast(T0)]);
    expect(extendTrail(trail, [slow(T0 + 1)])).toBe(trail);
  });
});

describe("gpsPosition", () => {
  it.each([
    [{ latitude_deg: NaN, longitude_deg: NaN }],
    [{ latitude_deg: null, longitude_deg: null }],
    [{ latitude_deg: 0, longitude_deg: 0 }],
    [{ latitude_deg: 95, longitude_deg: 10 }],
    [{}],
  ])("rejects %j", (packet) => {
    expect(gpsPosition(packet as never)).toBeNull();
  });

  it("accepts a real position, including on the equator", () => {
    expect(gpsPosition({ latitude_deg: 0, longitude_deg: -81.61 })).toEqual({ lat: 0, lon: -81.61 });
  });
});

describe("latestSignal", () => {
  it("reads the most recently received frame of any kind", () => {
    expect(latestSignal({ fast: fast(T0), slow: slow(T0 + 10) })).toEqual({ rssi: -90, snr: 2 });
    expect(latestSignal({})).toBeNull();
  });
});

describe("parseViewerMessage", () => {
  it("reads each message type", () => {
    const f = fast(T0);
    expect(parseViewerMessage(JSON.stringify({ t: "frames", frames: [f] }))).toEqual({ t: "frames", frames: [f] });
    expect(parseViewerMessage('{"t":"publisher","connected":true,"lastSeenAt":null}')).toEqual({
      t: "publisher",
      connected: true,
      lastSeenAt: null,
    });
    expect(
      parseViewerMessage(JSON.stringify({ t: "snapshot", latest: { fast: f }, publisher: { connected: false, lastSeenAt: null } })),
    ).toEqual({ t: "snapshot", latest: { fast: f }, publisher: { connected: false, lastSeenAt: null } });
  });

  it("drops frames that don't match their kind", () => {
    const bad = { ...fast(T0), kind: "slow" };
    expect(parseViewerMessage(JSON.stringify({ t: "frames", frames: [bad, 3, null] }))).toEqual({ t: "frames", frames: [] });
    expect(
      parseViewerMessage(JSON.stringify({ t: "snapshot", latest: { slow: fast(T0) }, publisher: {} })),
    ).toEqual({ t: "snapshot", latest: {}, publisher: { connected: false, lastSeenAt: null } });
  });

  it.each(["pong", "{", "[]", '{"t":"nope"}', '{"t":"frames"}'])("ignores %s", (raw) => {
    expect(parseViewerMessage(raw)).toBeNull();
  });
});

describe("formatAgo", () => {
  it.each([
    [1_000, "just now"],
    [42_000, "42 s ago"],
    [5 * 60_000 + 10_000, "5 min ago"],
    [3 * 3_600_000, "3 h ago"],
    [3 * 86_400_000, "3 days ago"],
    [-5_000, "just now"],
  ])("%i ms -> %s", (ms, text) => {
    expect(formatAgo(ms)).toBe(text);
  });
});

describe("reconnectDelay", () => {
  it("doubles from 500 ms with jitter in the upper half", () => {
    expect(reconnectDelay(0, () => 0)).toBe(250);
    expect(reconnectDelay(0, () => 1)).toBe(500);
    expect(reconnectDelay(3, () => 1)).toBe(4000);
  });

  it("caps at 15 s", () => {
    expect(reconnectDelay(20, () => 1)).toBe(15_000);
    expect(reconnectDelay(1000, () => 0)).toBe(7_500);
  });
});
