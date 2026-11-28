/** First-launch "How Finzz works" carousel: seen-flag and pager helpers (T-027). */

export const ONBOARDING_SEEN_KEY = "finzz.onboardingSeen.v1";

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * A storage read error is treated as "seen": we would rather skip the carousel
 * than nag or block a returning user whose storage is flaky. It is replayable
 * from the login screen, so nothing is lost.
 */
export const hasSeenOnboarding = async (
  storage: KeyValueStorage,
  timeoutMs = 1500,
): Promise<boolean> => {
  // A read that never settles counts as seen too: AuthStack renders nothing
  // until this answers, so a hang would be a blank screen with no way out.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });
  try {
    return await Promise.race([
      storage.getItem(ONBOARDING_SEEN_KEY).then((v) => v != null),
      timeout,
    ]);
  } catch {
    return true;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** Write errors are swallowed: worst case the carousel shows once more. */
export const markOnboardingSeen = async (storage: KeyValueStorage): Promise<void> => {
  try {
    await storage.setItem(ONBOARDING_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
};

export const pageFromOffset = (offsetX: number, pageWidth: number, pageCount: number): number => {
  if (!(pageWidth > 0) || !(pageCount > 0)) return 0;
  const page = Math.round(offsetX / pageWidth);
  return Math.max(0, Math.min(pageCount - 1, page));
};

export const isLastPage = (index: number, count: number): boolean => index >= count - 1;

// AsyncStorage is required lazily so the pure helpers above stay testable in node.
const asyncStorage = (): KeyValueStorage =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage").default;

export const hasSeenOnboardingDefault = (): Promise<boolean> => hasSeenOnboarding(asyncStorage());
export const markOnboardingSeenDefault = (): Promise<void> => markOnboardingSeen(asyncStorage());
