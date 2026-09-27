// live-relay: carries car telemetry from the pit laptop to cwrumotorsports.com/live.
//
//   GET /publish  WebSocket, the pit laptop. Authenticates with its first message.
//   GET /watch    WebSocket, anyone. Receive-only.
//   GET /health   JSON: { viewers, publisher: { connected, lastSeenAt } }
//
// Every route goes to one Durable Object, so there is exactly one relay and
// one copy of the latest state. The wire contract is in ./protocol.ts.

export { LiveRelay } from "./relay";

const NO_STORE = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const relay = env.LIVE_RELAY.get(env.LIVE_RELAY.idFromName("car"));

    if (pathname === "/publish" || pathname === "/watch") {
      if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket upgrade\n", {
          status: 426,
          headers: { Upgrade: "websocket" },
        });
      }
      return relay.fetch(request);
    }

    if (pathname === "/health" && request.method === "GET") {
      return Response.json(await relay.health(), { headers: NO_STORE });
    }

    return new Response("Not found\n", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
