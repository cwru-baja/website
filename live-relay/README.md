# live-relay

Carries car telemetry from the pit laptop to [cwrumotorsports.com/live](https://cwrumotorsports.com/live).

```
pit laptop (lora-dashboard) --wss /publish--> live-relay Worker + one Durable Object --wss /watch--> /live page
```

One Cloudflare Worker and one SQLite-backed Durable Object (`LiveRelay`, always the instance named `"car"`).
It keeps the newest frame of each kind, so a viewer who joins mid-race sees current values at once, and
fans every frame out to every viewer. It is a separate Worker from the site (`v2/wrangler.jsonc`)
because Cloudflare generates no version (preview) URLs for a Worker that implements a Durable Object,
and the site depends on its branch previews.

| Route | |
| --- | --- |
| `GET /publish` | WebSocket for the pit laptop. The first message must be `{"t":"hello","token":"…","v":1}` within 5 s, or the socket is closed with 4001. A newer publisher replaces an older one (4002). |
| `GET /watch` | WebSocket for anyone. Receive-only: a `snapshot` on connect, then `frames` and `publisher` messages. Sending `ping` gets `pong`. |
| `GET /health` | `{ viewers, publisher: { connected, lastSeenAt } }` |

The wire contract is [`src/protocol.ts`](src/protocol.ts), mirrored in `v2/src/lib/liveTelemetry.ts` and
built against by the publisher in lora-dashboard. Messages over 16 KB, non-JSON messages and frames of an
unknown kind are dropped. `latest` only takes a frame newer than the one it holds (by `receivedAt`), and is
written to storage at most once a second. There is no history yet; `acceptFrames` in `src/relay.ts`
marks where batches could be written to R2.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars    # LIVE_PUBLISH_TOKEN=dev-token
npm run dev                       # wrangler dev on http://localhost:8787
npm run fake-publisher            # second terminal: a car lapping a loop near campus
```

Then run `npm run dev` in `v2/` and open http://localhost:3000/live. In development the page connects to
`ws://localhost:8787/watch`; set `NEXT_PUBLIC_LIVE_WS_URL` to point it elsewhere.

`wrangler dev` keeps Durable Object storage in `.wrangler/state`, so the latest frames survive a restart.
Delete that folder to see the page's "No race in progress" state.

```bash
npm test             # vitest: validation, the newer-only merge, the token check
npm run typecheck    # regenerates worker-configuration.d.ts (git-ignored), then tsc
```

## Deploying

Nothing here deploys on its own. A deploy needs `LIVE_PUBLISH_TOKEN`: it is listed under
`secrets.required`, so a deploy without it fails instead of shipping a relay that refuses every
publisher. The first deploy also creates the `live.cwrumotorsports.com` custom domain from
`wrangler.jsonc`. That needs no existing DNS record for `live`.

First time, from this folder, logged in to the team's Cloudflare account (`npx wrangler login`):

```bash
npm ci
printf 'LIVE_PUBLISH_TOKEN=%s\n' "$(openssl rand -hex 32)" > .dev.vars.production
npx wrangler deploy --secrets-file .dev.vars.production
curl https://live.cwrumotorsports.com/health
```

Put the token in the publisher's settings, then delete `.dev.vars.production` (git ignores it either way).
To change the token later, run `npx wrangler secret put LIVE_PUBLISH_TOKEN`.

For deploys on push instead, add a second Workers Builds project for this repo. Set its root
directory to `live-relay`, its deploy command to `npx wrangler deploy`, and its build watch path to
`live-relay/*`, so site pushes don't restart the relay.

Redeploying restarts the Durable Object, which drops every socket. The page and the publisher both
reconnect by themselves, and the latest frames come back from storage.
