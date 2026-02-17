import React, { createContext, useContext, useState, useCallback } from "react";
import SuccessToast from "../components/SuccessToast";

interface ToastContextType {
  showSuccessToast: (message: string, amount?: number) => void;
  showErrorToast: (message: string) => void;
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

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });

  const showToast = useCallback(
    (
      message: string,
      amount?: number,
      type: "success" | "error" = "success",
    ) => {
      setToast({ visible: true, message, amount, type });

      // Auto-dismiss after 1.5 seconds
      setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 1500);
    },
    [],
  );

  const showSuccessToast = useCallback(
    (message: string, amount?: number) => {
      showToast(message, amount, "success");
    },
    [showToast],
  );

  const showErrorToast = useCallback(
    (message: string) => {
      showToast(message, undefined, "error");
    },
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showSuccessToast, showErrorToast }}>
      {children}
      <SuccessToast
        visible={toast.visible}
        message={toast.message}
        amount={toast.amount}
        type={toast.type}
      />
    </ToastContext.Provider>
  );
};
