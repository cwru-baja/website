# live-relay

Carries car telemetry from the pit laptop (`/host`) to the team's private live view (`/live`). Neither page
is linked from the site, and the relay gives nothing to anyone without a password.

```
receiver board --USB--> cwrumotorsports.com/host (pit laptop, Chrome)
    --wss /publish--> live-relay Worker + one Durable Object --wss /watch--> cwrumotorsports.com/live
```

One Cloudflare Worker and one SQLite-backed Durable Object (`LiveRelay`, always the instance named `"car"`).
It keeps the newest frame of each kind, so a viewer who joins mid-race sees current values at once, and
fans every frame out to every viewer. It is a separate Worker from the site (`v2/wrangler.jsonc`)
because Cloudflare generates no version (preview) URLs for a Worker that implements a Durable Object,
and the site depends on its branch previews.

| Route | |
| --- | --- |
| `GET /publish` | WebSocket for the pit laptop. The first message must be `{"t":"hello","token":"<team password>","v":1}` within 5 s; the relay answers `{"t":"ready"}`, or closes with 4001. A newer publisher replaces an older one (4002). |
| `GET /watch` | WebSocket for `/live`. The first message must be the same hello with the watch password (or the team password); the relay answers with a `snapshot`, then `frames` and `publisher` messages, or closes with 4001. After the hello it is receive-only. |
| `GET /health` | `{ viewers, publisher: { connected, lastSeenAt } }`, no telemetry. |

On both doors: five wrong passwords from one address in 10 minutes lock it out (4003), and browser pages
outside `SITE_ORIGINS` are refused (4004). Sending `ping` gets `pong`.

Two secrets: `LIVE_PUBLISH_TOKEN`, the team password for `/host`, which also works to watch, and
`LIVE_WATCH_TOKEN`, the watch password for `/live`, safe to hand to anyone who should see the data.

Generate either password with `npm run new-passphrase`. The wire
contract is [`src/protocol.ts`](src/protocol.ts), mirrored in `v2/src/lib/liveTelemetry.ts`, which both
`/host` and `/live` use. Messages over 16 KB, non-JSON messages and frames of an
unknown kind are dropped. `latest` only takes a frame newer than the one it holds (by `receivedAt`), and is
written to storage at most once a second. There is no history yet; `acceptFrames` in `src/relay.ts`
marks where batches could be written to R2.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars    # passwords dev-token / dev-watch, localhost SITE_ORIGINS
npm run dev                       # wrangler dev on http://localhost:8787
```

Then run `npm run dev` in `v2/`, open http://localhost:3000/host in Chrome, connect the board and stream
with the password `dev-token`, and watch http://localhost:3000/live with `dev-watch`. In development both pages use
`ws://localhost:8787`; set `NEXT_PUBLIC_LIVE_WS_URL` to point them elsewhere. With no board, `/host` can
replay a recording, or `npm run fake-publisher` stands in for the whole pit laptop.

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
printf 'LIVE_PUBLISH_TOKEN=%s\nLIVE_WATCH_TOKEN=%s\n' "$(npm run -s new-passphrase)" "$(npm run -s new-passphrase)" > .dev.vars.production
cat .dev.vars.production    # save both in the team's password manager
npx wrangler deploy --secrets-file .dev.vars.production
curl https://live.cwrumotorsports.com/health
```

Give the team password to whoever hosts and the watch password to whoever should watch, then delete
`.dev.vars.production` (git ignores it either way). Change them each season, or when someone leaves:
`npx wrangler secret put LIVE_PUBLISH_TOKEN` or `LIVE_WATCH_TOKEN`. That deploys a new version at once,
which restarts the relay: everyone is disconnected, and only the new password gets back in. Don't do it
mid-race.

For deploys on push afterwards, connect this Worker to the repo (Worker > Settings > Build > Connect):
root directory `live-relay`, deploy command `npx wrangler deploy`, branch `master`, and build watch
path `live-relay/*` so site pushes don't restart the relay. Do the first deploy from the command line
as above: a Git build has no way to supply the passwords the first deploy needs.

Redeploying restarts the Durable Object, which drops every socket. The page and the publisher both
reconnect by themselves, and the latest frames come back from storage.
