"use client";

import { useEffect, useState } from "react";

import type { Outbox } from "@/lib/hostOutbox";
import {
  CLOSE_BAD_ORIGIN,
  CLOSE_LOCKED_OUT,
  CLOSE_REPLACED,
  CLOSE_UNAUTHORIZED,
  LIVE_HEALTH_URL,
  LIVE_PUBLISH_URL,
  PING,
  PONG,
  reconnectDelay,
} from "@/lib/liveTelemetry";

export type StreamStatus =
  | { kind: "off" }
  | { kind: "connecting" }
  /** The relay accepted the password; frames are flowing. */
  | { kind: "live" }
  | { kind: "retrying"; at: number }
  /** These stop streaming until someone acts. */
  | { kind: "rejected" }
  | { kind: "locked" }
  | { kind: "replaced" }
  | { kind: "forbidden" };

// Frames go out four times a second, as many as have piled up. A pong comes
// back for each ping on the same connection, so three pings without one
// (about nine seconds) means the hotspot has silently dropped the socket.
const FLUSH_EVERY_MS = 250;
const MESSAGES_PER_FLUSH = 8;
const BUFFERED_LIMIT = 256 * 1024;
const PING_EVERY_MS = 3_000;
const MAX_UNANSWERED_PINGS = 3;
const HELLO_WAIT_MS = 10_000;
const HEALTH_EVERY_MS = 15_000;

/**
 * Streams the outbox to the relay while `password` is set and `enabled`,
 * reconnecting through dropouts. Stops for good on a wrong password, a lockout,
 * or another laptop taking over, since retrying those would only make things
 * worse.
 */
export function useRelayPublisher(outbox: Outbox, password: string | null, enabled: boolean) {
  const [status, setStatus] = useState<StreamStatus>({ kind: "off" });
  const [viewers, setViewers] = useState<number | null>(null);
  const active = enabled && !!password;

  useEffect(() => {
    if (!active || !password) {
      // A wrong password stops the stream by clearing itself; keep saying why
      // until the next attempt. Deferred so the effect itself doesn't set state.
      const timer = setTimeout(() => setStatus((current) => (current.kind === "rejected" ? current : { kind: "off" })), 0);
      return () => clearTimeout(timer);
    }

    let stopped = false;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let timers: ReturnType<typeof setInterval>[] = [];
    let helloTimer: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      timers.forEach(clearInterval);
      timers = [];
      clearTimeout(helloTimer);
    };

    const finish = (next: StreamStatus) => {
      stopped = true;
      setStatus(next);
    };

    /** The socket is dead or unwanted: forget it at once, don't wait for a close handshake. */
    const abandon = (ws: WebSocket) => {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        // Already closing.
      }
      if (socket === ws) lost(null);
    };

    const lost = (code: number | null) => {
      clearTimers();
      socket = null;
      outbox.connectionLost();
      if (stopped) return;
      if (code === CLOSE_UNAUTHORIZED) return finish({ kind: "rejected" });
      if (code === CLOSE_LOCKED_OUT) return finish({ kind: "locked" });
      if (code === CLOSE_REPLACED) return finish({ kind: "replaced" });
      if (code === CLOSE_BAD_ORIGIN) return finish({ kind: "forbidden" });
      const delay = reconnectDelay(attempt++);
      setStatus({ kind: "retrying", at: Date.now() + delay });
      retryTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      clearTimeout(retryTimer);
      if (stopped) return;
      setStatus({ kind: "connecting" });
      const ws = new WebSocket(LIVE_PUBLISH_URL);
      socket = ws;
      let ready = false;

      ws.onopen = () => {
        ws.send(JSON.stringify({ t: "hello", token: password, v: 1 }));
        helloTimer = setTimeout(() => {
          if (!ready) abandon(ws);
        }, HELLO_WAIT_MS);
      };

      ws.onmessage = (event) => {
        if (event.data === PONG) {
          outbox.ponged();
          return;
        }
        if (ready || typeof event.data !== "string") return;
        try {
          if ((JSON.parse(event.data) as { t?: unknown }).t !== "ready") return;
        } catch {
          return;
        }
        ready = true;
        attempt = 0;
        clearTimeout(helloTimer);
        setStatus({ kind: "live" });
        const flush = () => {
          if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > BUFFERED_LIMIT) return;
          for (const message of outbox.take(MESSAGES_PER_FLUSH)) ws.send(message);
        };
        flush();
        timers.push(setInterval(flush, FLUSH_EVERY_MS));
        timers.push(
          setInterval(() => {
            if (outbox.unansweredPings >= MAX_UNANSWERED_PINGS) return abandon(ws);
            outbox.pinged();
            ws.send(PING);
          }, PING_EVERY_MS),
        );
      };

      ws.onclose = (event) => {
        if (socket === ws) lost(event.code);
      };
    };

    // Back online, or back at the laptop: try now rather than wait out the backoff.
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
      clearTimers();
      const ws = socket;
      socket = null;
      if (ws) {
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        ws.close(1000, "Host stopped");
      }
      outbox.connectionLost();
    };
  }, [active, password, outbox]);

  // How many people are watching /live, while streaming.
  const live = status.kind === "live";
  useEffect(() => {
    if (!live) return;
    let alive = true;
    const poll = () =>
      fetch(LIVE_HEALTH_URL, { cache: "no-store" })
        .then((response) => response.json() as Promise<{ viewers?: unknown }>)
        .then((health) => {
          if (alive && typeof health.viewers === "number") setViewers(health.viewers);
        })
        .catch(() => {});
    void poll();
    const timer = setInterval(poll, HEALTH_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [live]);

  return { status, viewers: live ? viewers : null };
}
