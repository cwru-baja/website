export interface HoverHandoffController<T> {
  activate(value: T): void;
  schedule(): void;
  cancel(): void;
  dismissNow(): void;
  current(): T | null;
  dispose(): void;
}

interface HoverHandoffOptions<T> {
  delayMs: number;
  isSame?: (current: T, next: T) => boolean;
  onActivate: (value: T, wasActive: boolean) => void;
  onDismiss: () => void;
}

/**
 * Keeps hover-preview dismissal independent from React render state so a new
 * target can cancel the handoff grace period synchronously.
 */
export function createHoverHandoffController<T>({
  delayMs,
  isSame = Object.is,
  onActivate,
  onDismiss,
}: HoverHandoffOptions<T>): HoverHandoffController<T> {
  let active: T | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const cancel = () => {
    if (timeout === null) return;
    clearTimeout(timeout);
    timeout = null;
  };

  const dismiss = () => {
    if (disposed || active === null) return;
    active = null;
    onDismiss();
  };

  return {
    activate(value) {
      if (disposed) return;
      cancel();

      const wasActive = active !== null;
      if (active !== null && isSame(active, value)) return;

      active = value;
      onActivate(value, wasActive);
    },

    schedule() {
      if (disposed || active === null) return;
      cancel();
      timeout = setTimeout(() => {
        timeout = null;
        dismiss();
      }, delayMs);
    },

    cancel,

    dismissNow() {
      if (disposed) return;
      cancel();
      dismiss();
    },

    current() {
      return active;
    },

    dispose() {
      cancel();
      active = null;
      disposed = true;
    },
  };
}
