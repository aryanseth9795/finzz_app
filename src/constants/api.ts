/**
 * API base URL.
 *
 * Reads `EXPO_PUBLIC_API_URL` when present so a developer can point at a local
 * server without editing — and risking committing — a tracked source file.
 * The production URL remains the default so existing builds are unaffected.
 *
 * `EXPO_PUBLIC_*` variables are inlined into the bundle at build time, so this
 * must never hold a secret. A base URL is not one.
 */
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://finzz-backend.onrender.com/api/v1";

/** Timeout for every request. */
export const REQUEST_TIMEOUT_MS = 15000;

export const CACHE_DURATION = {
  CHATS: 2 * 60 * 1000,
  TRANSACTIONS: 1 * 60 * 1000,
  FRIENDS: 5 * 60 * 1000,
  PROFILE: 10 * 60 * 1000,
  STATS: 5 * 60 * 1000,
  EXPENSES: 1 * 60 * 1000,
  // Was missing, so `cacheManager.get(NOTIFICATIONS)` silently fell back to
  // the CHATS duration.
  NOTIFICATIONS: 2 * 60 * 1000,
};
