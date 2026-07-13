import { describe, expect, it } from "vitest";
import {
  completeContentReveal,
  createContentTransition,
  markContentReady,
  requestContentTransition,
} from "./contentTransition";

const sameId = (left: string, right: string) => left === right;

describe("content transition controller", () => {
  it("keeps A fully displayed while B loads", () => {
    const state = requestContentTransition(
      createContentTransition("A", 1),
      "B",
      sameId,
    );

    expect(state.displayed.value).toBe("A");
    expect(state.incoming?.value).toBe("B");
    expect(state.phase).toBe("loading");
  });

  it("promotes the same keyed incoming entry after its reveal", () => {
    const loading = requestContentTransition(
      createContentTransition("A", 1),
      "B",
      sameId,
    );
    const incoming = loading.incoming!;
    const revealing = markContentReady(loading, incoming);
    const complete = completeContentReveal(revealing, incoming, sameId);

    expect(revealing.displayed.value).toBe("A");
    expect(revealing.phase).toBe("revealing");
    expect(complete.displayed).toBe(incoming);
    expect(complete.incoming).toBeNull();
    expect(complete.phase).toBe("idle");
  });

  it("replaces a still-loading B with C and ignores B's stale readiness", () => {
    const loadingB = requestContentTransition(
      createContentTransition("A", 1),
      "B",
      sameId,
    );
    const staleB = loadingB.incoming!;
    const loadingC = requestContentTransition(loadingB, "C", sameId);

    expect(loadingC.incoming?.value).toBe("C");
    expect(markContentReady(loadingC, staleB)).toBe(loadingC);
  });

  it("finishes a reveal and retains only the latest queued request", () => {
    const loadingB = requestContentTransition(
      createContentTransition("A", 1),
      "B",
      sameId,
    );
    const b = loadingB.incoming!;
    const revealingB = markContentReady(loadingB, b);
    const queuedC = requestContentTransition(revealingB, "C", sameId);
    const queuedD = requestContentTransition(queuedC, "D", sameId);
    const loadingD = completeContentReveal(queuedD, b, sameId);

    expect(queuedD.queued).toBe("D");
    expect(loadingD.displayed).toBe(b);
    expect(loadingD.incoming?.value).toBe("D");
    expect(loadingD.phase).toBe("loading");
  });

  it("cancels a loading replacement when selection returns to displayed", () => {
    const loading = requestContentTransition(
      createContentTransition("A", 1),
      "B",
      sameId,
    );
    const canceled = requestContentTransition(loading, "A", sameId);

    expect(canceled.displayed.value).toBe("A");
    expect(canceled.incoming).toBeNull();
    expect(canceled.phase).toBe("idle");
  });

  it("rejects callbacks from a previous shell session", () => {
    const oldLoading = requestContentTransition(
      createContentTransition("A", 1),
      "B",
      sameId,
    );
    const staleToken = oldLoading.incoming!;
    const newLoading = requestContentTransition(
      createContentTransition("C", 2),
      "D",
      sameId,
    );

    expect(markContentReady(newLoading, staleToken)).toBe(newLoading);
    expect(completeContentReveal(newLoading, staleToken, sameId)).toBe(newLoading);
  });
});

