/**
 * Pure rules behind the in-app toast and dialog (T-026).
 *
 * Kept free of React Native so vitest can cover them directly: which host
 * draws the toast, how long each kind stays, and how a dialog's buttons are
 * laid out and dismissed.
 */

export type ToastType = "success" | "error" | "warning" | "info";

/** Errors and warnings carry something to read or act on, so they stay longer. */
export const TOAST_DURATION_MS: Record<ToastType, number> = {
  success: 1800,
  info: 2600,
  error: 3400,
  warning: 3400,
};

// ---- Toast hosts ----------------------------------------------------------
// An RN <Modal> is its own window on Android, so a toast drawn in the root
// view is hidden behind it. Screens that open a Modal mount a <ToastHost/>
// inside it; the toast is drawn only by the most recently mounted host.

export const pushHost = (stack: readonly string[], id: string): string[] =>
  stack.includes(id) ? [...stack] : [...stack, id];

export const removeHost = (stack: readonly string[], id: string): string[] =>
  stack.filter((h) => h !== id);

export const topHost = (stack: readonly string[]): string | undefined =>
  stack[stack.length - 1];

// ---- Dialog ---------------------------------------------------------------

export type DialogActionStyle = "default" | "cancel" | "destructive";

export interface DialogActionInput {
  label: string;
  style?: DialogActionStyle;
}

export type NormalizedAction<T extends DialogActionInput = DialogActionInput> = T & {
  style: DialogActionStyle;
};

export type DialogTone = "default" | "destructive" | "warning" | "success" | "info";

export function normalizeActions<T extends DialogActionInput>(
  actions: readonly T[] | undefined,
): NormalizedAction<T>[] {
  if (!actions || actions.length === 0) {
    return [{ label: "OK", style: "default" } as NormalizedAction<T>];
  }
  return actions.map((a) => ({ ...a, style: a.style ?? "default" }));
}

/**
 * What the Android back button and a backdrop tap do.
 * - With a cancel action, both run it (same as tapping Cancel).
 * - A single-button acknowledgement closes on back, but a stray tap on the
 *   backdrop must not count as "read".
 * - A choice with no cancel can't be dismissed by accident.
 * - `backdrop: false` keeps back = cancel but ignores stray outside taps
 *   (the optional update prompt: a stray tap must not skip that version).
 */
export function dismissPlan(
  actions: readonly NormalizedAction[],
  { backdrop = true }: { backdrop?: boolean } = {},
): {
  backIndex: number | null;
  backdropIndex: number | null;
} {
  const cancel = actions.findIndex((a) => a.style === "cancel");
  if (cancel !== -1) return { backIndex: cancel, backdropIndex: backdrop ? cancel : null };
  if (actions.length === 1) return { backIndex: 0, backdropIndex: null };
  return { backIndex: null, backdropIndex: null };
}

/** Two buttons sit side by side (cancel on the left); more are stacked, cancel last. */
export function layoutActions(actions: readonly NormalizedAction[]): {
  direction: "row" | "column";
  order: number[];
} {
  const idx = actions.map((_, i) => i);
  const cancels = idx.filter((i) => actions[i].style === "cancel");
  const others = idx.filter((i) => actions[i].style !== "cancel");
  if (actions.length === 2) return { direction: "row", order: [...cancels, ...others] };
  return { direction: "column", order: [...others, ...cancels] };
}

export function dialogTone(actions: readonly NormalizedAction[], requested?: DialogTone): DialogTone {
  if (requested) return requested;
  return actions.some((a) => a.style === "destructive") ? "destructive" : "default";
}
