/**
 * Wrong-attempt throttle. With a short PIN this is the real security
 * boundary (the device secret rules out offline guessing), so the state is
 * persisted by the caller and survives restarts. It never wipes the vault.
 */
export interface ThrottleState {
  failures: number;
  /** Epoch ms before which no attempt is allowed. */
  lockedUntil: number;
}

export const INITIAL_THROTTLE: ThrottleState = { failures: 0, lockedUntil: 0 };

export const lockoutFor = (failures: number): number => {
  if (failures >= 15) return 30 * 60_000;
  if (failures >= 10) return 5 * 60_000;
  if (failures >= 5) return 30_000;
  return 0;
};

export const recordFailure = (state: ThrottleState, now: number): ThrottleState => {
  const failures = state.failures + 1;
  return { failures, lockedUntil: now + lockoutFor(failures) };
};

export const canAttempt = (state: ThrottleState, now: number): boolean => now >= state.lockedUntil;

export const remainingMs = (state: ThrottleState, now: number): number =>
  Math.max(0, state.lockedUntil - now);
