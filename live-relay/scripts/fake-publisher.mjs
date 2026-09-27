#!/usr/bin/env node
/**
 * Stands in for the pit laptop: connects to /publish, says hello, then streams
 * made-up frames of a car lapping a small loop near Case Western.
 *
 *   npm run dev                      # the relay, on :8787
 *   npm run fake-publisher           # this, in a second terminal
 *
 * Options (all optional):
 *   --url <ws url>     default ws://localhost:8787/publish
 *   --token <token>    default LIVE_PUBLISH_TOKEN from the environment or .dev.vars
 *   --no-fix <s>       send NaN GPS (no fix yet) for the first s seconds (default 3)
 *
 * It reconnects on its own, like the real publisher, so the relay can be
 * restarted under it. A wrong token (close 4001) ends it.
 *
 * Rates are fast ~5 Hz, medium ~2 Hz, slow ~1 Hz. The real rates are unknown,
 * and nothing downstream should depend on these.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? "ws://localhost:8787/publish";
const token = args.token ?? process.env.LIVE_PUBLISH_TOKEN ?? devVarsToken() ?? "dev-token";
const noFixMs = Number(args["no-fix"] ?? 3) * 1000;

// A rounded loop about 300 m by 180 m, centred near the campus. One lap a minute.
const CENTRE = { lat: 41.5, lon: -81.61 };
const RADIUS_M = { x: 150, y: 90 };
const LAP_MS = 60_000;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 111_320 * Math.cos((CENTRE.lat * Math.PI) / 180);

const FLAGS = ["wheel", "f_HFU", "r_HFU", "fl_vcmom", "fr_vcmom", "rl_vcmom", "rr_vcmom", "pi", "pmu", "gofobomo"];

const session = randomUUID();
const startedAt = Date.now();
let seq = 0;
let attempt = 0;
let socket = null;
let timers = [];

connect();

function connect() {
  console.log(`connecting to ${url}`);
  const ws = new WebSocket(url);
  socket = ws;

  ws.addEventListener("open", () => {
    attempt = 0;
    ws.send(JSON.stringify({ t: "hello", token, v: 1 }));
    console.log(`connected, session ${session.slice(0, 8)}`);
    timers = [
      setInterval(() => publish("fast"), 200),
      setInterval(() => publish("medium"), 500),
      setInterval(() => publish("slow"), 1000),
    ];
  });

  ws.addEventListener("close", (event) => {
    timers.forEach(clearInterval);
    timers = [];
    if (event.code === 4001) {
      console.error("relay refused the token (4001). Check LIVE_PUBLISH_TOKEN / .dev.vars.");
      process.exit(1);
    }
    const delay = Math.min(15_000, 500 * 2 ** attempt) * (0.5 + Math.random() / 2);
    attempt += 1;
    console.log(`closed (${event.code}${event.reason ? ` ${event.reason}` : ""}), retrying in ${Math.round(delay)} ms`);
    setTimeout(connect, delay);
  });

  ws.addEventListener("error", () => {
    // A close event follows; the retry lives there.
  });
}

function publish(kind) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  const now = Date.now();
  const frame = {
    kind,
    receivedAt: new Date(now).toISOString(),
    rssi: round(-68 - 12 * Math.abs(Math.sin(now / 9000)) - Math.random() * 4, 1),
    snr: round(9 - 4 * Math.abs(Math.sin(now / 9000)) + Math.random(), 1),
    packet: packet(kind, now),
  };
  socket.send(JSON.stringify({ t: "frames", session, seq: seq++, frames: [frame] }));
}

function packet(kind, now) {
  const t = now - startedAt;
  const angle = (2 * Math.PI * t) / LAP_MS;
  // Slower through the tight ends of the ellipse, faster down the sides.
  const speedMps = (2 * Math.PI * Math.hypot(RADIUS_M.x * Math.sin(angle), RADIUS_M.y * Math.cos(angle))) / (LAP_MS / 1000);
  const speedMph = speedMps * 2.23694;

  if (kind === "fast") {
    const fix = t >= noFixMs;
    // Idle near 1,800 rpm, up to the governed ~3,800 on the straights.
    const primary = 1800 + Math.min(1, speedMph / 30) * 1900 + Math.random() * 100;
    return {
      type: "fast",
      primary_rpm: Math.round(primary),
      output_rpm: Math.round(primary / (2.6 - speedMph / 30)),
      speed_mph: Math.round(speedMph + Math.random() * 0.8),
      // NaN before a fix, as the real decoder gives. JSON turns it into null.
      latitude_deg: fix ? CENTRE.lat + (RADIUS_M.y * Math.sin(angle)) / M_PER_DEG_LAT : NaN,
      longitude_deg: fix ? CENTRE.lon + (RADIUS_M.x * Math.cos(angle)) / M_PER_DEG_LON : NaN,
    };
  }

  if (kind === "medium") {
    const lateral = speedMps ** 2 / 120;
    return {
      type: "medium",
      mPs: [round(speedMps, 2), 0, 0],
      mPs2: [round(Math.random() - 0.5, 2), round(lateral, 2), 9.81],
      degPs: [0, 0, round((360 * 1000) / LAP_MS, 2)],
    };
  }

  // One board drops out for a few seconds every half minute or so.
  const faulty = Math.floor(t / 4000) % 8 === 7 ? FLAGS[Math.floor(t / 32_000) % FLAGS.length] : null;
  return {
    type: "slow",
    board_statuses: Object.fromEntries(FLAGS.map((flag) => [flag, flag !== faulty])),
    setpoints: [0.5, 0.5, 0.5, 0.5],
    // A full tank lasts about half an hour here.
    fuel_percent: Math.max(0, Math.round(100 - t / 18_000)),
    deg: [round(Math.random() * 2 - 1, 2), round(Math.random() * 2 - 1, 2)],
    altitude_deg: 200,
  };
}

function devVarsToken() {
  try {
    const text = readFileSync(path.join(import.meta.dirname, "..", ".dev.vars"), "utf8");
    return /^LIVE_PUBLISH_TOKEN\s*=\s*"?([^"\n]*)"?/m.exec(text)?.[1];
  } catch {
    return undefined;
  }
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const next = argv[i + 1];
    out[arg.slice(2)] = next && !next.startsWith("--") ? argv[++i] : true;
  }
  return out;
}
