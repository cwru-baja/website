import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_BYTES, type LiveFrame } from "./liveTelemetry";
import { Outbox, createStamper } from "./hostOutbox";

const T0 = Date.parse("2026-09-26T16:00:00.000Z");

function frame(i: number): LiveFrame {
  return {
    kind: "fast",
    receivedAt: new Date(T0 + i).toISOString(),
    rssi: -70,
    snr: 8,
    packet: { type: "fast", primary_rpm: 3000, output_rpm: 1000, speed_mph: 20, latitude_deg: 41.5, longitude_deg: -81.61 },
  };
}
const frames = (n: number, from = 0) => Array.from({ length: n }, (_, i) => frame(from + i));
const sentTimes = (messages: string[]) =>
  messages.flatMap((m) => (JSON.parse(m).frames as LiveFrame[]).map((f) => Date.parse(f.receivedAt) - T0));

describe("Outbox", () => {
  it("sends frames as protocol messages with the session and a rising seq", () => {
    const box = new Outbox("s1");
    box.push(frames(3));
    const [first] = box.take(5);
    expect(JSON.parse(first)).toEqual({ t: "frames", session: "s1", seq: 0, frames: frames(3) });
    box.push(frames(1, 3));
    expect(JSON.parse(box.take(5)[0]).seq).toBe(1);
  });

  it("splits a backlog into messages under the size limit, in order", () => {
    const box = new Outbox("s1", { maxMessageBytes: 2_000 });
    box.push(frames(100));
    const messages = box.take(1000);
    expect(messages.length).toBeGreaterThan(5);
    for (const m of messages) expect(m.length).toBeLessThanOrEqual(2_000);
    expect(sentTimes(messages)).toEqual(Array.from({ length: 100 }, (_, i) => i));
  });

  it("never passes the relay's limit, whatever it is asked for", () => {
    const box = new Outbox("s1", { maxMessageBytes: 1_000_000 });
    box.push(frames(500));
    for (const m of box.take(1000)) expect(m.length).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
  });

  it("sends at most the number of messages asked for", () => {
    const box = new Outbox("s1", { maxMessageBytes: 1_000 });
    box.push(frames(50));
    expect(box.take(2)).toHaveLength(2);
    expect(box.stats().queued).toBeGreaterThan(0);
  });

  it("a pong confirms only what was sent before its ping", () => {
    const box = new Outbox("s1");
    box.push(frames(2));
    box.take(1);
    box.pinged();
    box.push(frames(3, 2));
    box.take(1);
    expect(box.stats()).toMatchObject({ unconfirmed: 5, confirmed: 0 });
    box.ponged();
    expect(box.stats()).toMatchObject({ unconfirmed: 3, confirmed: 2 });
  });

  it("resends everything unconfirmed after a drop, oldest first, ahead of newer frames", () => {
    const box = new Outbox("s1");
    box.push(frames(2));
    box.take(1);
    box.pinged();
    box.ponged(); // frames 0-1 confirmed
    box.push(frames(2, 2));
    box.take(1); // frames 2-3 in flight, then the hotspot drops
    box.push(frames(2, 4)); // decoded while offline
    box.connectionLost();
    expect(sentTimes(box.take(10))).toEqual([2, 3, 4, 5]);
    expect(box.stats().confirmed).toBe(2);
  });

  it("reports how old the oldest unsent frame is", () => {
    const box = new Outbox("s1");
    expect(box.stats().oldestQueued).toBeNull();
    box.push(frames(3, 40));
    expect(box.stats().oldestQueued).toBe(T0 + 40);
  });

  it("forgets unanswered pings when the connection is lost", () => {
    const box = new Outbox("s1");
    box.pinged();
    box.connectionLost();
    expect(box.unansweredPings).toBe(0);
  });

  it("drops the oldest frames when the queue is full", () => {
    const box = new Outbox("s1", { maxQueuedFrames: 10 });
    box.push(frames(15));
    expect(box.stats()).toMatchObject({ queued: 10, dropped: 5 });
    expect(sentTimes(box.take(10))[0]).toBe(5);
  });
});

describe("createStamper", () => {
  it("never repeats or goes back, even within one millisecond", () => {
    const stamp = createStamper();
    const times = [stamp(T0), stamp(T0), stamp(T0), stamp(T0 - 50), stamp(T0 + 10)].map(Date.parse);
    expect(times).toEqual([T0, T0 + 1, T0 + 2, T0 + 3, T0 + 10]);
  });
});
