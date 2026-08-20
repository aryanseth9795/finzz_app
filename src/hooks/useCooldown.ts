import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Resend cooldown timer.
 *
 * Replaces this function, copy-pasted verbatim into RegisterScreen,
 * ForgotPasswordScreen and EmailVerifyModal:
 *
 *     const startCooldown = () => {
 *       setResendCooldown(60);
 *       const interval = setInterval(() => {
 *         setResendCooldown(prev => {
 *           if (prev <= 1) { clearInterval(interval); return 0; }
 *           return prev - 1;
 *         });
 *       }, 1000);
 *     };
 *
 * The handle was a local `const` — not stored in a ref, no effect cleanup — so
 * it was cleared only if the countdown ran all sixty ticks to completion.
 *
 * Two consequences:
 *
 *  1. Navigating away mid-cooldown left a 1 Hz timer running against an
 *     unmounted component for up to a minute.
 *
 *  2. In EmailVerifyModal — which never unmounts, because RootNavigator always
 *     renders it — dismissing the modal called `reset()` while the interval
 *     was still alive. The next tick set the counter straight back to 59, so
 *     reopening showed a phantom "Resend in 47s" that blocked OTP resend
 *     entirely.
 *
 * Holding the handle in a ref and clearing it on unmount, on restart and on
 * reset makes all three impossible.
 */
export function useCooldown(seconds = 60) {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    // Restarting must not leave the previous interval running, or two timers
    // decrement the same counter and it falls twice as fast.
    clear();
    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clear();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [seconds, clear]);

  const reset = useCallback(() => {
    clear();
    setRemaining(0);
  }, [clear]);

  // The cleanup that was missing everywhere.
  useEffect(() => clear, [clear]);

  return { remaining, isCoolingDown: remaining > 0, start, reset };
}
