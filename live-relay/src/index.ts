// live-relay: carries car telemetry from the pit laptop to cwrumotorsports.com/live.
//
//   GET /publish  WebSocket, the pit laptop (/host). Team password in its first message.
//   GET /watch    WebSocket, /live. Watch password in its first message; then receive-only.
//   GET /health   JSON: { viewers, publisher: { connected, lastSeenAt } }
//   GET /dares    JSON: { raised, updatedAt }, the Giving Tuesday total. Public.
//   POST /dares   { password, raised }: a team member sets the total (/dares/update).
//   POST /dares/log, /dares/log/list: who dared whom (./dares.ts).
//
// The telemetry routes go to one Durable Object, so there is exactly one relay
// and one copy of the latest state. The wire contract is in ./protocol.ts.
// /dares is the Giving Tuesday total, its own Durable Object (./dares.ts).

import { handleDares, isDaresPath } from "./dares";
import { CLOSE_BAD_ORIGIN } from "./protocol";
import { originAllowed } from "./state";

export { DaresTotal } from "./dares";
export { LiveRelay } from "./relay";

const NO_STORE = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (isDaresPath(pathname)) return handleDares(request, env, ctx);

    const relay = env.LIVE_RELAY.get(env.LIVE_RELAY.idFromName("car"));

    if (pathname === "/publish" || pathname === "/watch") {
      if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket upgrade\n", {
          status: 426,
          headers: { Upgrade: "websocket" },
        });
      }
      if (!originAllowed(request.headers.get("Origin"), env.SITE_ORIGINS)) {
        // Answered here, without waking the relay, and closed with a code the
        // page can show rather than refused outright.
        const [client, server] = Object.values(new WebSocketPair());
        server.accept();
        server.close(CLOSE_BAD_ORIGIN, "This page may not connect");
        return new Response(null, { status: 101, webSocket: client });
      }
      return relay.fetch(request);
    }

    if (pathname === "/health" && request.method === "GET") {
      return Response.json(await relay.health(), { headers: NO_STORE });
    }

    return new Response("Not found\n", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
