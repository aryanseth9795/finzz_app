/**
 * Resolve with `fallback` if `promise` has not settled within `ms`.
 *
 * Used where a hung native call (e.g. AsyncStorage) would otherwise hold the
 * whole app on the splash screen with no way forward.
 */
export const withTimeout = <T,>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> =>
  new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
