"use client";

// Pong on the dash screen: the loop, the controls and the screen, together.
//
// Mount inside the still's 16:9 box. While `playing`, the screen goes dark and
// the game runs; `onEnd` fires when someone reaches five (after the result has
// been up for a moment) or when Esc is pressed. The parent decides what else
// ends a game - a blue button, scrolling away - by setting `playing` false.
//
// Controls. Left paddle: W/S, or the mouse - whichever was used last - where the
// pointer's height anywhere on the page, projected onto the screen, is where the
// paddle goes. Right paddle: the computer, until someone presses an arrow key;
// from then on it's player two's for the rest of the game.

import { useEffect, useRef, useState } from "react";
import { aiInput } from "./ai";
import DashScreen, { type DashScreenHandle } from "./DashScreen";
import { createGame, step, type GameState, type PaddleInput } from "./engine";
import { scene, winnerText, type Opponent } from "./scene";

/** How long the result stays up before the dash comes back. */
const RESULT_MS = 2600;
const WIN_SCORE = 5;
/**
 * The board's proportions (a 4 px ball on a 375 px court) leave a ~3 CSS px ball
 * on this panel as a 1440-wide page shows it - lost the moment it passes the net.
 * About twice the board's share, with paddles as wide as the ball, as on the
 * board. Paddle height is the engine's, which the AI's balance was measured at.
 */
const PANEL_TUNING = { ballSize: 10, paddleWidth: 10 } as const;

export type EndReason = "over" | "escape";

export default function DashPong({
  playing,
  onEnd,
  difficulty = 0.5,
}: {
  playing: boolean;
  onEnd: (reason: EndReason) => void;
  difficulty?: number;
}) {
  const screenRef = useRef<DashScreenHandle>(null);
  const onEndRef = useRef(onEnd);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!playing) return;
    let game: GameState = createGame({
      winScore: WIN_SCORE,
      seed: (Date.now() & 0x7fffffff) >>> 0,
      tuning: PANEL_TUNING,
    });
    let opponent: Opponent = "cpu";
    let left: "keys" | "mouse" = "keys";
    let pointerY: number | null = null;
    const held = new Set<string>();
    let last = performance.now();
    let overAt: number | null = null;
    let raf = 0;
    let lastScore = "0-0";

    const axis = (up: string, down: string): -1 | 0 | 1 => {
      const d = (held.has(down) ? 1 : 0) - (held.has(up) ? 1 : 0);
      return d as -1 | 0 | 1;
    };
    const leftInput = (): PaddleInput =>
      left === "mouse" && pointerY !== null ? { kind: "target", y: pointerY } : { kind: "axis", dir: axis("w", "s") };
    const rightInput = (): PaddleInput =>
      opponent === "p2" ? { kind: "axis", dir: axis("ArrowUp", "ArrowDown") } : aiInput(game, 1, { difficulty });

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { state, events } = step(game, dt, [leftInput(), rightInput()]);
      game = state;
      screenRef.current?.draw(scene(game, opponent));
      for (const e of events) {
        if (e.type === "score") {
          const s = `${e.score[0]}-${e.score[1]}`;
          if (s !== lastScore) {
            lastScore = s;
            setAnnounce(`${opponent === "cpu" ? "You" : "Player one"} ${e.score[0]}, ${opponent === "cpu" ? "computer" : "player two"} ${e.score[1]}`);
          }
        }
        if (e.type === "over") {
          overAt = now;
          setAnnounce(`${winnerText(e.winner, opponent).toLowerCase()}, ${game.score[0]} to ${game.score[1]}`);
        }
      }
      if (overAt !== null && now - overAt >= RESULT_MS) {
        onEndRef.current("over");
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === "Escape") {
        event.preventDefault();
        onEndRef.current("escape");
        return;
      }
      if (key === "w" || key === "s") {
        left = "keys";
        held.add(key);
        event.preventDefault();
      } else if (key === "ArrowUp" || key === "ArrowDown") {
        opponent = "p2";
        held.add(key);
        event.preventDefault(); // or the page scrolls under the game
      } else if (key === " ") {
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      held.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const at = screenRef.current?.toTexture(event.clientX, event.clientY);
      if (!at) return;
      pointerY = at[1];
      left = "mouse";
    };
    // A key held when the window loses focus never sends its keyup.
    const onBlur = () => held.clear();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onBlur);
    raf = requestAnimationFrame((now) => {
      last = now;
      frame(now);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onBlur);
    };
  }, [playing, difficulty]);

  return (
    <>
      <DashScreen ref={screenRef} on={playing} />
      <span className="sr-only" aria-live="polite">
        {playing ? announce : ""}
      </span>
    </>
  );
}
