import * as Clipboard from "expo-clipboard";
import { createClipboardGuard } from "./clipboardGuard";

const guard = createClipboardGuard(Clipboard);

/** Copy a secret; it is cleared 30 s later (or on the next return to the app after that). */
export const copySecret = guard.copy;

/** Call when the app returns to the foreground. */
export const flushClipboardOnActive = guard.onAppActive;
