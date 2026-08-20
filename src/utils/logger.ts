/**
 * Development-only logging.
 *
 * THE PROBLEM THIS SOLVES
 * 41 `console.*` calls shipped to production builds. Two of them logged user
 * financial data outright — `console.log(response.data)` in HomeScreen dumped
 * the entire chat list, and ExpenseScreen logged every ledger — while
 * `useNotifications` logged the device's push token. On a real device those
 * land in the system log, readable by anything with log access.
 *
 * The rest were `catch (error) { console.error(...) }`, which on a deployed
 * device writes to a console nobody has open. Functionally those were empty
 * catch blocks: the user saw the previous screen state and no explanation.
 *
 * `__DEV__` is inlined by Metro and the branch is dropped from release
 * bundles, so these cost nothing in production.
 */

export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) console.warn(...args);
  },
  /**
   * Report an error.
   *
   * In development this prints. In production it is a hook for a crash
   * reporter (Sentry, Bugsnag) — deliberately left unwired rather than
   * silently swallowed, so adding one is a single edit here.
   *
   * Note that logging is NOT error handling: every call site must still put
   * something in front of the user. `describeError` in api/axios.ts produces
   * the message; this records the detail.
   */
  error: (message: string, error?: unknown) => {
    if (__DEV__) console.error(message, error);
  },
};
