/**
 * Clipboard auto-clear, independent of expo-clipboard so it can be tested.
 *
 * RN Android pauses JS timers while the app is in the background — exactly
 * when the user goes to paste — so the 30 s timer alone often never fires.
 * The clear is therefore ALSO attempted when the app returns to the
 * foreground, where the clipboard can be read to confirm it still holds our
 * value.
 */
export interface ClipboardLike {
  setStringAsync(value: string): Promise<unknown>;
  getStringAsync(): Promise<string>;
}

interface Deps {
  now: () => number;
  schedule: (fn: () => void, ms: number) => unknown;
  cancel: (handle: unknown) => void;
}

export const CLEAR_AFTER_MS = 30_000;

export const createClipboardGuard = (
  clip: ClipboardLike,
  deps: Deps = {
    now: Date.now,
    schedule: (fn, ms) => setTimeout(fn, ms),
    cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
) => {
  let pending: { value: string; clearAt: number } | null = null;
  let timer: unknown = null;

  /** Clear only if it still holds our value. Unreadable/empty is cleared too. */
  const clearIfOurs = async () => {
    if (!pending) return;
    const { value } = pending;
    pending = null;
    try {
      const current = await clip.getStringAsync();
      if (current === value || current === "") await clip.setStringAsync("");
    } catch {
      await clip.setStringAsync("").catch(() => undefined);
    }
  };

  return {
    copy: async (value: string) => {
      await clip.setStringAsync(value);
      pending = { value, clearAt: deps.now() + CLEAR_AFTER_MS };
      if (timer !== null) deps.cancel(timer);
      timer = deps.schedule(() => {
        timer = null;
        void clearIfOurs();
      }, CLEAR_AFTER_MS);
    },
    onAppActive: async () => {
      if (pending && deps.now() >= pending.clearAt) await clearIfOurs();
    },
  };
};
