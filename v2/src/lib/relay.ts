// Where the live relay (live-relay/) answers. One Worker serves the telemetry
// sockets for /live and /host and the Giving Tuesday total for /dares, so
// every URL is built from this one setting. NEXT_PUBLIC_LIVE_WS_URL, if set,
// is the /watch socket's URL (kept as it was named when /live came first).
const WATCH_URL =
  process.env.NEXT_PUBLIC_LIVE_WS_URL ||
  (process.env.NODE_ENV === "development"
    ? "ws://localhost:8787/watch"
    : "wss://live.cwrumotorsports.com/watch");

const WS_ORIGIN = WATCH_URL.replace(/\/watch$/, "");
const HTTP_ORIGIN = WS_ORIGIN.replace(/^ws/, "http");

/** A WebSocket route on the relay, e.g. relayWsUrl("/watch"). */
export const relayWsUrl = (path: string) => `${WS_ORIGIN}${path}`;
/** A plain HTTP(S) route on the relay, e.g. relayHttpUrl("/health"). */
export const relayHttpUrl = (path: string) => `${HTTP_ORIGIN}${path}`;
