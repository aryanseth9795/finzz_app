/**
 * Pure logic for push-token registration (no React Native imports, so it is
 * unit-testable under vitest's node environment).
 *
 * Registration used to swallow every failure (`catch { return null }`), run
 * once per launch, and never react to token rotation, so a device could end
 * up with no token on the server and nobody could tell. These helpers give
 * each way registration can end a name, and decide when an upload is needed.
 */

export type PushRegistrationOutcome =
  | "registered"
  | "unchanged"
  | "permission-denied"
  | "not-a-device"
  | "no-project-id"
  | "token-error"
  | "upload-error";

const DEFAULT_MAX_AGE_MS = 7 * 24 * 3600e3;

/**
 * Whether the current token should be sent to the server: it changed, was
 * never uploaded, or the last upload is older than `maxAgeMs` (heals tokens
 * the server pruned). A timestamp in the future (clock change) counts as stale.
 */
export const shouldUploadToken = (
  current: string | null,
  lastUploaded: string | null,
  lastUploadAt: number | null,
  now: number,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): boolean => {
  if (!current) return false;
  if (current !== lastUploaded) return true;
  if (lastUploadAt === null || !Number.isFinite(lastUploadAt)) return true;
  const age = now - lastUploadAt;
  return age < 0 || age > maxAgeMs;
};

const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

export const isValidExpoToken = (t: unknown): t is string =>
  typeof t === "string" && EXPO_TOKEN_RE.test(t);

const MESSAGES: Record<PushRegistrationOutcome, string> = {
  registered: "Push notifications are set up on this device.",
  unchanged: "Push token is already registered with the server.",
  "permission-denied": "Notification permission is off for this app.",
  "not-a-device": "Push notifications need a physical device.",
  "no-project-id": "Push setup is missing the Expo project id.",
  "token-error": "Could not get a push token from the notification service.",
  "upload-error": "Could not register the push token with the server.",
};

export const describeOutcome = (o: PushRegistrationOutcome): string =>
  MESSAGES[o];
