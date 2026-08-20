import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import SuccessToast from "../components/SuccessToast";

interface ToastContextType {
  showSuccessToast: (message: string, amount?: number) => void;
  showErrorToast: (message: string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

interface ToastState {
  visible: boolean;
  message: string;
  amount?: number;
  type: "success" | "error";
}

const DISPLAY_MS = { success: 1800, error: 3200 };

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });

  // The dismiss timer was never stored or cleared. Rapid successive toasts
  // stacked timers, and an earlier one hid a newer toast before its time.
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
    (message: string, amount?: number, type: "success" | "error" = "success") => {
      clearTimer();
      setToast({ visible: true, message, amount, type });
      // Errors stay longer than confirmations: they carry information the user
      // may need to act on, and 1.5s was not enough to read one.
      timerRef.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, DISPLAY_MS[type]);
    },
    [clearTimer],
  );

  const showSuccessToast = useCallback(
    (message: string, amount?: number) => showToast(message, amount, "success"),
    [showToast],
  );

  const showErrorToast = useCallback(
    (message: string) => showToast(message, undefined, "error"),
    [showToast],
  );

  /**
   * Memoised context value.
   *
   * This was an inline object literal, so every ToastProvider render produced a
   * new identity. React compares context values by reference, so showing a
   * toast broadcast a change to every consumer — and ToastProvider wraps the
   * entire navigator. A 1.5-second confirmation re-rendered the whole app twice.
   */
  const value = useMemo(
    () => ({ showSuccessToast, showErrorToast, hideToast }),
    [showSuccessToast, showErrorToast, hideToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <SuccessToast
        visible={toast.visible}
        message={toast.message}
        amount={toast.amount}
        type={toast.type}
        onDismiss={hideToast}
      />
    </ToastContext.Provider>
  );
};
