"use client";

import { useEffect, useState } from "react";

import {
  INITIAL_STATE,
  PING,
  parseViewerMessage,
  reconnectDelay,
  reduceLive,
  type LiveEvent,
  type LiveState,
} from "@/lib/liveTelemetry";

// A keepalive every 25 s stops idle proxies and phone networks from dropping
// the socket. Anything heard, pong included, proves it is alive; a socket that
// has heard nothing for a minute is half-open, so it is replaced.
const PING_EVERY_MS = 25_000;
const SILENT_LIMIT_MS = 60_000;

/**
 * Keeps a receive-only socket to the relay open for as long as the page is,
 * reconnecting with backoff, and returns the reduced telemetry state.
 *
 * Messages are folded into a plain variable as they arrive and React sees the
 * result at most once per animation frame, whatever the packet rate. A hidden
 * tab gets no frames, so it doesn't render at all until it is looked at.
 */
export function useLiveTelemetry(url: string): LiveState {
  const [view, setView] = useState<LiveState>(INITIAL_STATE);

  useEffect(() => {
    let state = INITIAL_STATE;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let lastHeardAt = 0;
    let frame = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    const dispatch = (event: LiveEvent) => {
      const next = reduceLive(state, event);
      if (next === state) return;
      state = next;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          setView(state);
        });
      }
    };

    const connect = () => {
      clearTimeout(retryTimer);
      retryTimer = undefined;
      dispatch({ type: "socket", status: "connecting" });
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleRetry();
        return;
      }
      socket = ws;

      ws.onopen = () => {
        attempt = 0;
        lastHeardAt = Date.now();
        dispatch({ type: "socket", status: "open" });
        pingTimer = setInterval(() => {
          if (Date.now() - lastHeardAt > SILENT_LIMIT_MS) ws.close();
          else ws.send(PING);
        }, PING_EVERY_MS);
      };

      ws.onmessage = (event) => {
        lastHeardAt = Date.now();
        const message = parseViewerMessage(event.data);
        if (message) dispatch({ type: "message", message, now: lastHeardAt });
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        if (socket !== ws) return;
        socket = null;
        dispatch({ type: "socket", status: "closed" });
        scheduleRetry();
      };
    };

    const scheduleRetry = () => {
      if (stopped || retryTimer) return;
      retryTimer = setTimeout(connect, reconnectDelay(attempt));
      attempt += 1;
    };

    // Coming back online, or back to the tab, is worth a try straight away
    // rather than waiting out the backoff.
    const retryNow = () => {
      if (!stopped && !socket && document.visibilityState === "visible") connect();
    };

    connect();
    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", retryNow);

    return () => {
      stopped = true;
      window.removeEventListener("online", retryNow);
      document.removeEventListener("visibilitychange", retryNow);
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      cancelAnimationFrame(frame);
      const ws = socket;
      socket = null;
      ws?.close();
    };
  }, [url]);

  return view;
}

/** Date.now(), refreshed every `interval` ms, for "last seen" text and the live window. */
export function useNow(interval = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}
