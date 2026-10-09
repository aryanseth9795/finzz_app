import * as Clipboard from "expo-clipboard";

const CLEAR_AFTER_MS = 30_000;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Copy a secret and clear it 30 s later — but only if the clipboard still
 * holds it, so a later copy of the user's own is never wiped. If the
 * clipboard cannot be read (Android blocks background reads), it is cleared
 * anyway: leaving a password behind is worse than losing a later copy.
 */
export const copySecret = async (value: string): Promise<void> => {
  await Clipboard.setStringAsync(value);
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    try {
      const current = await Clipboard.getStringAsync();
      if (current === value || current === "") await Clipboard.setStringAsync("");
    } catch {
      await Clipboard.setStringAsync("").catch(() => undefined);
    }
  }, CLEAR_AFTER_MS);
};
