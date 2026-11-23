import { DurableObject } from "cloudflare:workers";

import {
  addFailure,
  isLockedOut,
  originAllowed,
  parseRaisedUpdate,
  tokensMatch,
  type Failures,
} from "./state";

// The Giving Tuesday total shown on cwrumotorsports.com/dares and in the
// site-wide bar. Blackbaud gives us no way to read gifts, so a team member
// types it into /dares/update.
//
//   GET /dares    { raised, updatedAt }. Public, cached at the edge.
//   POST /dares   { password, raised }. The team password (LIVE_PUBLISH_TOKEN),
//                 with the sockets' lockout: five wrong in 10 minutes.
//
// Its own Durable Object, apart from the telemetry relay: it shares only the
// team password and the lockout rules (state.ts).

export type Raised = { raised: number; updatedAt: string | null };

type SetResult = { ok: true; value: Raised } | { ok: false; status: 401 | 429 };

const RAISED_KEY = "raised";
const failuresKey = (ip: string) => `fail:${ip}`;

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
  get(): Raised {
    return this.ctx.storage.kv.get<Raised>(RAISED_KEY) ?? { raised: 0, updatedAt: null };
  }

  async set(password: string, ip: string, raised: number): Promise<SetResult> {
    const key = failuresKey(ip);
    const now = Date.now();
    if (isLockedOut(this.ctx.storage.kv.get<Failures>(key), now)) return { ok: false, status: 429 };
    if (!(await tokensMatch(password, this.env.LIVE_PUBLISH_TOKEN))) {
      this.ctx.storage.kv.put(key, addFailure(this.ctx.storage.kv.get<Failures>(key), now));
      return { ok: false, status: 401 };
    }
    this.ctx.storage.kv.delete(key);
    const value: Raised = { raised, updatedAt: new Date(now).toISOString() };
    this.ctx.storage.kv.put(RAISED_KEY, value);
    return { ok: true, value };
  }
}

/** Everything under /dares: GET, the CORS preflight, and POST. */
export async function handleDares(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const store = env.DARES_TOTAL.get(env.DARES_TOTAL.idFromName("total"));
  const cacheKey = new Request(new URL("/dares", request.url));

  if (request.method === "GET") {
    const cached = await caches.default.match(cacheKey);
    if (cached) return new Response(cached.body, { headers: TO_BROWSER });
    const body = JSON.stringify(await store.get());
    const edgeCopy = new Response(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${MAX_AGE_S}` },
    });
    ctx.waitUntil(caches.default.put(cacheKey, edgeCopy));
    return new Response(body, { headers: TO_BROWSER });
  }

  // Writes only from the site's own pages (or tools with no Origin, which
  // still need the password and face the lockout).
  const origin = request.headers.get("Origin");
  if (!originAllowed(origin, env.SITE_ORIGINS)) {
    return new Response("This page may not update the total\n", { status: 403 });
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
    return new Response("Method not allowed\n", { status: 405, headers: { Allow: "GET, POST" } });
  }

  const headers = { ...cors, "Cache-Control": "no-store" };
  const update = parseRaisedUpdate(await readJson(request));
  if (!update) return Response.json({ error: "Send a whole-dollar amount." }, { status: 400, headers });

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const result = await store.set(update.password, ip, update.raised);
  if (!result.ok) {
    const error =
      result.status === 429 ? "Too many wrong passwords. Try again in a few minutes." : "Wrong password.";
    return Response.json({ error }, { status: result.status, headers });
  }
  ctx.waitUntil(caches.default.delete(cacheKey));
  return Response.json(result.value, { headers });
}

/** The body as JSON, or null if it is over 1 KB or not JSON. */
async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 1024) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
