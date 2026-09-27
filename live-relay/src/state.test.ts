import { describe, expect, it } from "vitest";

import { LOCKOUT_ATTEMPTS, LOCKOUT_WINDOW_MS, MAX_MESSAGE_BYTES, type LiveFrame } from "./protocol";
import {
  addFailure,
  isLockedOut,
  mergeLatest,
  originAllowed,
  parseFrame,
  parsePublisherMessage,
  tokensMatch,
  type Failures,
} from "./state";

function fast(receivedAt: string, speed = 20): LiveFrame {
  return {
    kind: "fast",
    receivedAt,
    rssi: -70,
    snr: 9,
    packet: {
      type: "fast",
      primary_rpm: 3000,
      output_rpm: 900,
      speed_mph: speed,
      latitude_deg: 41.5,
      longitude_deg: -81.61,
    },
  };
}

function slow(receivedAt: string): LiveFrame {
  return {
    kind: "slow",
    receivedAt,
    rssi: -80,
    snr: 5,
    packet: {
      type: "slow",
      board_statuses: {
        wheel: true, f_HFU: true, r_HFU: true, fl_vcmom: true, fr_vcmom: true,
        rl_vcmom: true, rr_vcmom: true, pi: true, pmu: true, gofobomo: false,
      },
      setpoints: [0, 0, 0, 0],
      fuel_percent: 80,
      deg: [0, 0],
      altitude_deg: 200,
    },
  };
}

describe("mergeLatest", () => {
  it("fills empty kinds", () => {
    const frame = fast("2026-09-26T12:00:00.000Z");
    expect(mergeLatest({}, [frame])).toEqual({ fast: frame });
  });

  it("replaces a kind with a newer frame", () => {
    const old = fast("2026-09-26T12:00:00.000Z", 10);
    const next = fast("2026-09-26T12:00:00.200Z", 11);
    expect(mergeLatest({ fast: old }, [next]).fast).toBe(next);
  });

  it("keeps the held frame when a backfilled older one arrives", () => {
    const held = fast("2026-09-26T12:05:00.000Z", 30);
    const backfill = [fast("2026-09-26T12:01:00.000Z", 5), fast("2026-09-26T12:02:00.000Z", 6)];
    const latest = { fast: held };
    const merged = mergeLatest(latest, backfill);
    expect(merged.fast).toBe(held);
    // Nothing changed, so nothing new was allocated.
    expect(merged).toBe(latest);
  });

  it("keeps the held frame on a tie", () => {
    const held = fast("2026-09-26T12:00:00.000Z", 1);
    expect(mergeLatest({ fast: held }, [fast("2026-09-26T12:00:00.000Z", 2)]).fast).toBe(held);
  });

  it("takes the newest of a batch whatever its order", () => {
    const a = fast("2026-09-26T12:00:03.000Z", 3);
    const b = fast("2026-09-26T12:00:01.000Z", 1);
    const c = fast("2026-09-26T12:00:02.000Z", 2);
    expect(mergeLatest({}, [a, b, c]).fast).toBe(a);
  });

  it("tracks each kind on its own", () => {
    const f = fast("2026-09-26T12:00:05.000Z");
    const s = slow("2026-09-26T12:00:01.000Z");
    const merged = mergeLatest({ fast: f }, [s, fast("2026-09-26T12:00:02.000Z")]);
    expect(merged).toEqual({ fast: f, slow: s });
  });

  it("compares instants, not strings", () => {
    // 12:00:01Z sorts after 08:00:02-04:00 as a string, but is the earlier time.
    const held = fast("2026-09-26T08:00:02-04:00");
    expect(mergeLatest({ fast: held }, [fast("2026-09-26T12:00:01Z")]).fast).toBe(held);
  });

  it("does not mutate its input", () => {
    const latest = { fast: fast("2026-09-26T12:00:00.000Z") };
    const copy = structuredClone(latest);
    mergeLatest(latest, [fast("2026-09-26T12:00:01.000Z")]);
    expect(latest).toEqual(copy);
  });
});

describe("parseFrame", () => {
  it("accepts a well-formed frame", () => {
    const frame = fast("2026-09-26T12:00:00.000Z");
    expect(parseFrame(frame)).toEqual(frame);
  });

  it("accepts null numbers, which is how JSON carries NaN", () => {
    const frame = JSON.parse(JSON.stringify({ ...fast("2026-09-26T12:00:00Z"), rssi: NaN }));
    expect(parseFrame(frame)?.rssi).toBeNull();
  });

  it.each([
    ["an unknown kind", { ...fast("2026-09-26T12:00:00Z"), kind: "turbo" }],
    ["a packet of another kind", { ...fast("2026-09-26T12:00:00Z"), kind: "slow" }],
    ["a bad time", { ...fast("2026-09-26T12:00:00Z"), receivedAt: "yesterday" }],
    ["a missing packet", { ...fast("2026-09-26T12:00:00Z"), packet: null }],
    ["a string rssi", { ...fast("2026-09-26T12:00:00Z"), rssi: "-70" }],
    ["an array", []],
  ])("rejects %s", (_, value) => {
    expect(parseFrame(value)).toBeNull();
  });
});

describe("parsePublisherMessage", () => {
  it("reads a hello", () => {
    expect(parsePublisherMessage('{"t":"hello","token":"abc","v":1}')).toEqual({
      t: "hello",
      token: "abc",
      v: 1,
    });
  });

  it("rejects a hello for another protocol version", () => {
    expect(parsePublisherMessage('{"t":"hello","token":"abc","v":2}')).toBeNull();
  });

  it("drops bad frames and keeps the rest of the batch", () => {
    const good = fast("2026-09-26T12:00:00.000Z");
    const raw = JSON.stringify({
      t: "frames",
      session: "s1",
      seq: 4,
      frames: [good, { kind: "warp" }, 7],
    });
    expect(parsePublisherMessage(raw)).toEqual({ t: "frames", session: "s1", seq: 4, frames: [good] });
  });

  it.each([
    ["binary", new ArrayBuffer(8)],
    ["not JSON", "{nope"],
    ["a bare value", "42"],
    ["an unknown type", '{"t":"shout"}'],
    ["frames that aren't a list", '{"t":"frames","frames":{}}'],
    ["an oversized message", JSON.stringify({ t: "frames", pad: "x".repeat(MAX_MESSAGE_BYTES), frames: [] })],
    // Short in UTF-16 units, over the limit in UTF-8 bytes.
    ["oversized multibyte text", JSON.stringify({ t: "frames", pad: "é".repeat(MAX_MESSAGE_BYTES / 2 + 10), frames: [] })],
  ])("drops %s", (_, raw) => {
    expect(parsePublisherMessage(raw)).toBeNull();
  });
});

describe("tokensMatch", () => {
  it("matches the same token", async () => {
    expect(await tokensMatch("s3cret", "s3cret")).toBe(true);
  });

  it("rejects a different or partial token", async () => {
    expect(await tokensMatch("s3cre", "s3cret")).toBe(false);
    expect(await tokensMatch("s3cret!", "s3cret")).toBe(false);
    expect(await tokensMatch("", "s3cret")).toBe(false);
  });

  it("rejects everything when no token is configured", async () => {
    expect(await tokensMatch("", undefined)).toBe(false);
    expect(await tokensMatch("", "")).toBe(false);
  });
});

describe("originAllowed", () => {
  const list = "https://cwrumotorsports.com, https://www.cwrumotorsports.com";

  it("allows the site's own pages", () => {
    expect(originAllowed("https://cwrumotorsports.com", list)).toBe(true);
    expect(originAllowed("https://www.cwrumotorsports.com", list)).toBe(true);
  });

  it("refuses other sites, near misses included", () => {
    expect(originAllowed("https://evil.example", list)).toBe(false);
    expect(originAllowed("http://cwrumotorsports.com", list)).toBe(false);
    expect(originAllowed("https://cwrumotorsports.com.evil.example", list)).toBe(false);
    expect(originAllowed("https://cwrumotorsports.com", undefined)).toBe(false);
  });

  it("lets tools without an Origin through to the token check", () => {
    expect(originAllowed(null, list)).toBe(true);
  });
});

describe("lockout", () => {
  const T = 1_000_000;

  it("locks an address out after the allowed number of wrong tokens", () => {
    let failures: Failures | undefined;
    for (let i = 0; i < LOCKOUT_ATTEMPTS; i++) {
      expect(isLockedOut(failures, T + i)).toBe(false);
      failures = addFailure(failures, T + i);
    }
    expect(isLockedOut(failures, T + LOCKOUT_ATTEMPTS)).toBe(true);
  });

  it("lets the address try again once the window has passed", () => {
    const failures: Failures = { count: LOCKOUT_ATTEMPTS, since: T };
    expect(isLockedOut(failures, T + LOCKOUT_WINDOW_MS - 1)).toBe(true);
    expect(isLockedOut(failures, T + LOCKOUT_WINDOW_MS)).toBe(false);
    expect(addFailure(failures, T + LOCKOUT_WINDOW_MS)).toEqual({ count: 1, since: T + LOCKOUT_WINDOW_MS });
  });
});
