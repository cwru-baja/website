import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHoverHandoffController } from "./hoverHandoff";

const HANDOFF_GRACE_MS = 250;

describe("createHoverHandoffController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the preview open when another target activates during the grace period", () => {
    const onActivate = vi.fn();
    const onDismiss = vi.fn();
    const controller = createHoverHandoffController<string>({
      delayMs: HANDOFF_GRACE_MS,
      onActivate,
      onDismiss,
    });

    controller.activate("A");
    controller.schedule();
    vi.advanceTimersByTime(HANDOFF_GRACE_MS - 1);
    controller.activate("B");
    vi.runAllTimers();

    expect(onDismiss).not.toHaveBeenCalled();
    expect(onActivate).toHaveBeenNthCalledWith(1, "A", false);
    expect(onActivate).toHaveBeenNthCalledWith(2, "B", true);
    expect(controller.current()).toBe("B");
  });

  it("restarts the grace period while empty-space movement continues", () => {
    const onDismiss = vi.fn();
    const controller = createHoverHandoffController<string>({
      delayMs: HANDOFF_GRACE_MS,
      onActivate: vi.fn(),
      onDismiss,
    });

    controller.activate("A");
    controller.schedule();
    vi.advanceTimersByTime(200);
    controller.schedule();
    vi.advanceTimersByTime(50);

    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(controller.current()).toBeNull();
  });

  it("prevents canceled and disposed callbacks from firing", () => {
    const onDismiss = vi.fn();
    const controller = createHoverHandoffController<string>({
      delayMs: HANDOFF_GRACE_MS,
      onActivate: vi.fn(),
      onDismiss,
    });

    controller.activate("A");
    controller.schedule();
    controller.cancel();
    vi.runAllTimers();

    controller.schedule();
    controller.dispose();
    vi.runAllTimers();

    expect(onDismiss).not.toHaveBeenCalled();
    expect(controller.current()).toBeNull();
  });

  it("keeps the latest target active during rapid switches", () => {
    const onActivate = vi.fn();
    const controller = createHoverHandoffController<string>({
      delayMs: HANDOFF_GRACE_MS,
      onActivate,
      onDismiss: vi.fn(),
    });

    controller.activate("A");
    controller.activate("B");
    controller.activate("C");

    expect(controller.current()).toBe("C");
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it("dismisses immediately and cancels the grace timer on a full map leave", () => {
    const onDismiss = vi.fn();
    const controller = createHoverHandoffController<string>({
      delayMs: HANDOFF_GRACE_MS,
      onActivate: vi.fn(),
      onDismiss,
    });

    controller.activate("A");
    controller.schedule();
    controller.dismissNow();
    vi.runAllTimers();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(controller.current()).toBeNull();
  });

  it("lets a new target invalidate a stale dismissal completion", () => {
    const staleCompletions: Array<() => void> = [];
    let clearedContent = false;

    const controller = createHoverHandoffController<string>({
      delayMs: HANDOFF_GRACE_MS,
      onActivate: vi.fn(),
      onDismiss: () => {
        staleCompletions.push(() => {
          if (controller.current() === null) clearedContent = true;
        });
      },
    });

    controller.activate("A");
    controller.schedule();
    vi.advanceTimersByTime(HANDOFF_GRACE_MS);
    controller.activate("B");
    staleCompletions[0]?.();

    expect(controller.current()).toBe("B");
    expect(clearedContent).toBe(false);
  });
});
