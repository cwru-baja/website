import { DurableObject } from "cloudflare:workers";

import {
  DARE_LOG_RATE,
  LOCKOUT,
  bump,
  isFull,
  isPassword,
  isRecord,
  originAllowed,
  parseDareRecord,
  parseRaisedUpdate,
  tokensMatch,
  type DareEntry,
  type DareRecord,
  type Tally,
} from "./state";

// Everything for /dares, the Giving Tuesday fundraiser on cwrumotorsports.com.
//
// The total, shown on /dares and in the site-wide bar. Blackbaud gives us no
// way to read gifts, so a team member types it into /dares/update.
//
//   GET /dares    { raised, updatedAt }. Public, cached at the edge.
//   POST /dares   { password, raised }. The team password (LIVE_PUBLISH_TOKEN).
//
// The dare log: who dared whom. Blackbaud's "Other" box never reaches the
// team, so /donate records the dare here instead.
//
//   POST /dares/log        A DareRecord (state.ts). Public, 300 new dares an hour
//                          per address. Sent on arrival and again, finished, when
//                          Blackbaud's form says "donation success ready": a
//                          signal, not proof of payment (the message carries no
//                          gift and can be faked).
//   POST /dares/log/list   { password }. Every dare, newest first, for /dares/update.
//
// Every password check shares the sockets' lockout: five wrong in 10 minutes.
// Its own Durable Object, apart from the telemetry relay; the class keeps the
// name it was deployed with (DaresTotal) though it now holds the log too.

export type Raised = { raised: number; updatedAt: string | null };

/** Why a team password was refused. */
type Refusal = 401 | 429;

type DareRow = {
  id: string;
  created_at: string;
  completed_at: string | null;
  from_name: string;
  members: string;
  dares: string;
  total: number | null;
  message: string | null;
};

const RAISED_KEY = "raised";
const failuresKey = (ip: string) => `fail:${ip}`;
const newDaresKey = (ip: string) => `dares:${ip}`;

// Every page view on the site reads the total, so the edge keeps a copy for
// 30 s and the Durable Object (100,000 requests a day on Workers Free) is asked
// at most twice a minute per data centre. An update clears it.
const MAX_AGE_S = 30;

// Browsers never keep it. Only the edge copy above caches, and what goes to
// the browser is always rebuilt with these headers: a response served from
// the edge cache comes back with the zone's Browser Cache TTL (4 hours) in
// place of our max-age, which left browsers showing an old total for hours.
const TO_BROWSER = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

export class DaresTotal extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS dare_log (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      from_name TEXT NOT NULL,
      members TEXT NOT NULL,
      dares TEXT NOT NULL,
      total INTEGER,
      message TEXT
    )`);
  }

  get(): Raised {
    return this.ctx.storage.kv.get<Raised>(RAISED_KEY) ?? { raised: 0, updatedAt: null };
  }

  /** null if the password is right; otherwise why not. A wrong one counts toward the lockout. */
  private async checkTeamPassword(password: string, ip: string): Promise<Refusal | null> {
    const kv = this.ctx.storage.kv;
    const key = failuresKey(ip);
    const now = Date.now();
    if (isFull(kv.get<Tally>(key), now, LOCKOUT)) return 429;
    if (!(await tokensMatch(password, this.env.LIVE_PUBLISH_TOKEN))) {
      kv.put(key, bump(kv.get<Tally>(key), now, LOCKOUT));
      return 401;
    }
    kv.delete(key);
    return null;
  }

  async setRaised(password: string, ip: string, raised: number): Promise<Raised | Refusal> {
    const refusal = await this.checkTeamPassword(password, ip);
    if (refusal) return refusal;
    const value: Raised = { raised, updatedAt: new Date().toISOString() };
    this.ctx.storage.kv.put(RAISED_KEY, value);
    return value;
  }

  /**
   * Saves a dare, or marks a saved one finished. The first copy and the first
   * finish win; only the key a dare was saved with can finish it. false when
   * the address has logged too many new dares this hour.
   */
  recordDare(record: DareRecord, ip: string): boolean {
    const { sql, kv } = this.ctx.storage;
    const now = new Date();
    const finishedAt = record.finished ? now.toISOString() : null;
    const saved = sql.exec<{ key: string }>("SELECT key FROM dare_log WHERE id = ?", record.id).toArray()[0];

    if (saved) {
      if (finishedAt && saved.key === record.key) {
        sql.exec("UPDATE dare_log SET completed_at = COALESCE(completed_at, ?) WHERE id = ?", finishedAt, record.id);
      }
      return true;
    }

    const rateKey = newDaresKey(ip);
    const tally = kv.get<Tally>(rateKey);
    if (isFull(tally, now.getTime(), DARE_LOG_RATE)) return false;
    kv.put(rateKey, bump(tally, now.getTime(), DARE_LOG_RATE));
    sql.exec(
      "INSERT INTO dare_log (id, key, created_at, completed_at, from_name, members, dares, total, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      record.id,
      record.key,
      now.toISOString(),
      finishedAt,
      record.from,
      JSON.stringify(record.members),
      JSON.stringify(record.dares),
      record.total,
      record.message,
    );
    return true;
  }

  async listDares(password: string, ip: string): Promise<DareEntry[] | Refusal> {
    const refusal = await this.checkTeamPassword(password, ip);
    if (refusal) return refusal;
    return this.ctx.storage.sql
      .exec<DareRow>(
        "SELECT id, created_at, completed_at, from_name, members, dares, total, message FROM dare_log ORDER BY created_at DESC",
      )
      .toArray()
      .map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        from: r.from_name,
        members: JSON.parse(r.members),
        dares: JSON.parse(r.dares),
        total: r.total,
        message: r.message,
      }));
  }
}

// ---- Routes -----------------------------------------------------------------

type Store = DurableObjectStub<DaresTotal>;

/** What every write gets: the store, who's asking, and the headers to answer with. */
type Write = { request: Request; store: Store; ip: string; headers: Record<string, string>; ctx: ExecutionContext };

type Route = {
  /** Public reads, if the path has any. */
  get?: (request: Request, store: Store, ctx: ExecutionContext) => Promise<Response>;
  post: (write: Write) => Promise<Response>;
};

const totalCacheKey = (request: Request) => new Request(new URL("/dares", request.url));

const refused = (status: Refusal, headers: Record<string, string>) =>
  Response.json(
    { error: status === 429 ? "Too many wrong passwords. Try again in a few minutes." : "Wrong password." },
    { status, headers },
  );

const ROUTES: Record<string, Route> = {
  "/dares": {
    async get(request, store, ctx) {
      const cacheKey = totalCacheKey(request);
      const cached = await caches.default.match(cacheKey);
      if (cached) return new Response(cached.body, { headers: TO_BROWSER });
      const body = JSON.stringify(await store.get());
      const edgeCopy = new Response(body, {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${MAX_AGE_S}` },
      });
      ctx.waitUntil(caches.default.put(cacheKey, edgeCopy));
      return new Response(body, { headers: TO_BROWSER });
    },
    async post({ request, store, ip, headers, ctx }) {
      const update = parseRaisedUpdate(await readJson(request));
      if (!update) return Response.json({ error: "Send a whole-dollar amount." }, { status: 400, headers });
      const result = await store.setRaised(update.password, ip, update.raised);
      if (typeof result === "number") return refused(result, headers);
      ctx.waitUntil(caches.default.delete(totalCacheKey(request)));
      return Response.json(result, { headers });
    },
  },

  "/dares/log": {
    async post({ request, store, ip, headers }) {
      const record = parseDareRecord(await readJson(request, 8 * 1024));
      if (!record) return Response.json({ error: "That dare didn't look right." }, { status: 400, headers });
      if (!(await store.recordDare(record, ip))) {
        return Response.json({ error: "Too many dares from here. Try again later." }, { status: 429, headers });
      }
      return Response.json({ ok: true }, { headers });
    },
  },

  "/dares/log/list": {
    async post({ request, store, ip, headers }) {
      const body = await readJson(request);
      const password = isRecord(body) ? body.password : undefined;
      if (!isPassword(password)) return Response.json({ error: "Enter the team password." }, { status: 400, headers });
      const result = await store.listDares(password, ip);
      if (typeof result === "number") return refused(result, headers);
      return Response.json({ entries: result }, { headers });
    },
  },
};

/** Whether the path is one of ours (index.ts sends these here). */
export const isDaresPath = (pathname: string) => Object.hasOwn(ROUTES, pathname);

export async function handleDares(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const route = ROUTES[new URL(request.url).pathname];
  const store = env.DARES_TOTAL.get(env.DARES_TOTAL.idFromName("total"));

  if (request.method === "GET" && route.get) return route.get(request, store, ctx);

  // Writes only from the site's own pages (or tools with no Origin, which
  // still need the password and face the lockouts).
  const origin = request.headers.get("Origin");
  if (!originAllowed(origin, env.SITE_ORIGINS)) {
    return new Response("This page may not write here\n", { status: 403 });
  }
  const cors: Record<string, string> = origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (request.method !== "POST") {
    const allow = route.get ? "GET, POST" : "POST";
    return new Response("Method not allowed\n", { status: 405, headers: { ...cors, Allow: allow } });
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return route.post({ request, store, ip, headers: { ...cors, "Cache-Control": "no-store" }, ctx });
}

/** The body as JSON, or null if it is over `max` characters (1 KB unless given) or not JSON. */
async function readJson(request: Request, max = 1024): Promise<unknown> {
  const text = await request.text();
  if (text.length > max) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
