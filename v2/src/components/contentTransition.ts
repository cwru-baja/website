export type ContentTransitionPhase = "idle" | "loading" | "revealing";

export interface ContentTransitionToken {
  session: number;
  generation: number;
}

export interface ContentTransitionEntry<T> extends ContentTransitionToken {
  value: T;
}

export interface ContentTransitionState<T> {
  session: number;
  displayed: ContentTransitionEntry<T>;
  incoming: ContentTransitionEntry<T> | null;
  queued: T | null;
  phase: ContentTransitionPhase;
  nextGeneration: number;
}

export function createContentTransition<T>(
  value: T,
  session: number,
): ContentTransitionState<T> {
  return {
    session,
    displayed: { value, session, generation: 0 },
    incoming: null,
    queued: null,
    phase: "idle",
    nextGeneration: 1,
  };
}

function withLoadingIncoming<T>(
  state: ContentTransitionState<T>,
  value: T,
): ContentTransitionState<T> {
  const incoming = {
    value,
    session: state.session,
    generation: state.nextGeneration,
  };

  return {
    ...state,
    incoming,
    queued: null,
    phase: "loading",
    nextGeneration: state.nextGeneration + 1,
  };
}

export function requestContentTransition<T>(
  state: ContentTransitionState<T>,
  value: T,
  isSame: (left: T, right: T) => boolean = Object.is,
): ContentTransitionState<T> {
  if (state.phase === "idle") {
    return isSame(state.displayed.value, value)
      ? state
      : withLoadingIncoming(state, value);
  }

  if (state.phase === "loading") {
    if (state.incoming && isSame(state.incoming.value, value)) return state;

    if (isSame(state.displayed.value, value)) {
      return {
        ...state,
        incoming: null,
        queued: null,
        phase: "idle",
      };
    }

    return withLoadingIncoming(state, value);
  }

  if (state.incoming && isSame(state.incoming.value, value)) {
    return state.queued === null ? state : { ...state, queued: null };
  }

  return { ...state, queued: value };
}

function matchesToken<T>(
  entry: ContentTransitionEntry<T> | null,
  token: ContentTransitionToken,
): boolean {
  return (
    entry !== null &&
    entry.session === token.session &&
    entry.generation === token.generation
  );
}

export function markContentReady<T>(
  state: ContentTransitionState<T>,
  token: ContentTransitionToken,
): ContentTransitionState<T> {
  if (state.phase !== "loading" || !matchesToken(state.incoming, token)) {
    return state;
  }

  return { ...state, phase: "revealing" };
}

export function completeContentReveal<T>(
  state: ContentTransitionState<T>,
  token: ContentTransitionToken,
  isSame: (left: T, right: T) => boolean = Object.is,
): ContentTransitionState<T> {
  if (state.phase !== "revealing" || !matchesToken(state.incoming, token)) {
    return state;
  }

  const displayed = state.incoming!;
  const promoted: ContentTransitionState<T> = {
    ...state,
    displayed,
    incoming: null,
    queued: null,
    phase: "idle",
  };

  return state.queued !== null && !isSame(state.queued, displayed.value)
    ? withLoadingIncoming(promoted, state.queued)
    : promoted;
}

