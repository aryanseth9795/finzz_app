import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useId,
} from "react";
import SuccessToast from "../components/SuccessToast";
import {
  TOAST_DURATION_MS,
  pushHost,
  removeHost,
  topHost,
  type ToastType,
} from "../utils/notifyLogic";

export type { ToastType };

export interface ToastOptions {
  type: ToastType;
  message: string;
  /** Optional bold first line; the colour and icon already say success/error. */
  title?: string;
  /** Shown large under the message (saved transactions). */
  amount?: number;
  durationMs?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  showSuccessToast: (message: string, amount?: number) => void;
  showErrorToast: (message: string, title?: string) => void;
  showWarningToast: (message: string, title?: string) => void;
  showInfoToast: (message: string, title?: string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * The toast's own state lives in a second context, read only by the hosts.
 * Screens that call `useToast()` get a stable value and never re-render when a
 * toast appears.
 */
interface ToastHostContextType {
  toast: ToastState;
  hostStack: string[];
  register: (id: string) => void;
  unregister: (id: string) => void;
  hideToast: () => void;
}
const ToastHostContext = createContext<ToastHostContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

interface ToastState {
  visible: boolean;
  /** Bumps on every show so the same text shown twice still re-announces. */
  seq: number;
  type: ToastType;
  message: string;
  title?: string;
  amount?: number;
}

/**
 * Draws the toast. The provider mounts one at the root. A screen that opens an
 * RN <Modal> mounts another inside it, because on Android a Modal is its own
 * window and would cover the root toast. Only the most recently mounted host
 * draws, so the toast is always on top.
 */
export const ToastHost: React.FC = () => {
  const ctx = useContext(ToastHostContext);
  const id = useId();
  const register = ctx?.register;
  const unregister = ctx?.unregister;

  useEffect(() => {
    if (!register || !unregister) return;
    register(id);
    return () => unregister(id);
  }, [id, register, unregister]);

  if (!ctx || topHost(ctx.hostStack) !== id) return null;
  const { toast } = ctx;
  return (
    <SuccessToast
      visible={toast.visible}
      seq={toast.seq}
      message={toast.message}
      title={toast.title}
      amount={toast.amount}
      type={toast.type}
      onDismiss={ctx.hideToast}
    />
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    seq: 0,
    message: "",
    type: "success",
  });
  const [hostStack, setHostStack] = useState<string[]>([]);

  // One timer at a time: a newer toast must not be hidden by an older timer.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const hideToast = useCallback(() => {
    clearTimer();
    setToast((prev) => ({ ...prev, visible: false }));
  }, [clearTimer]);

  const showToast = useCallback(
    ({ type, message, title, amount, durationMs }: ToastOptions) => {
      clearTimer();
      setToast((prev) => ({ visible: true, seq: prev.seq + 1, type, message, title, amount }));
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setToast((prev) => ({ ...prev, visible: false }));
      }, durationMs ?? TOAST_DURATION_MS[type]);
    },
    [clearTimer],
  );

  const showSuccessToast = useCallback(
    (message: string, amount?: number) => showToast({ type: "success", message, amount }),
    [showToast],
  );
  const showErrorToast = useCallback(
    (message: string, title?: string) => showToast({ type: "error", message, title }),
    [showToast],
  );
  const showWarningToast = useCallback(
    (message: string, title?: string) => showToast({ type: "warning", message, title }),
    [showToast],
  );
  const showInfoToast = useCallback(
    (message: string, title?: string) => showToast({ type: "info", message, title }),
    [showToast],
  );

  // Memoised: ToastProvider wraps the whole navigator, so a new object here
  // would re-render every consumer on each toast.
  const value = useMemo(
    () => ({ showToast, showSuccessToast, showErrorToast, showWarningToast, showInfoToast, hideToast }),
    [showToast, showSuccessToast, showErrorToast, showWarningToast, showInfoToast, hideToast],
  );

  const register = useCallback((id: string) => setHostStack((s) => pushHost(s, id)), []);
  const unregister = useCallback((id: string) => setHostStack((s) => removeHost(s, id)), []);

  const hostValue = useMemo(
    () => ({ toast, hostStack, register, unregister, hideToast }),
    [toast, hostStack, register, unregister, hideToast],
  );

  return (
    <ToastContext.Provider value={value}>
      <ToastHostContext.Provider value={hostValue}>
        {children}
        <ToastHost />
      </ToastHostContext.Provider>
    </ToastContext.Provider>
  );
};
