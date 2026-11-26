import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import AppDialog from "../components/ui/AppDialog";
import {
  normalizeActions,
  type DialogActionStyle,
  type DialogTone,
  type NormalizedAction,
} from "../utils/notifyLogic";
import type { Ionicons } from "@expo/vector-icons";

/**
 * In-app replacement for the native Alert.alert (T-026).
 *
 *   const { confirm, showDialog } = useDialog();
 *   if (!(await confirm({ title: "Delete pool?", message, confirmLabel: "Delete", destructive: true }))) return;
 *   showDialog({ title: "Note options", actions: [{ label: "Delete note", style: "destructive", onPress }, { label: "Cancel", style: "cancel" }] });
 *
 * One dialog shows at a time; later calls wait their turn.
 */

export interface DialogAction {
  label: string;
  style?: DialogActionStyle;
  onPress?: () => void | Promise<void>;
}

export interface DialogOptions {
  title: string;
  message?: string;
  /** Defaults to a single "OK". */
  actions?: DialogAction[];
  /** Icon colour/shape; defaults to "destructive" when any action is destructive. */
  tone?: DialogTone;
  /** Override the icon, or null for no icon (menus). */
  icon?: keyof typeof Ionicons.glyphMap | null;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  tone?: DialogTone;
  icon?: keyof typeof Ionicons.glyphMap | null;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => void;
  /** Resolves true for the confirm button, false for cancel / back / backdrop. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
};

export interface QueuedDialog extends Omit<DialogOptions, "actions"> {
  key: number;
  actions: NormalizedAction<DialogAction>[];
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueuedDialog[]>([]);
  const nextKey = useRef(1);

  const showDialog = useCallback((options: DialogOptions) => {
    const item: QueuedDialog = {
      ...options,
      key: nextKey.current++,
      actions: normalizeActions(options.actions),
    };
    setQueue((q) => [...q, item]);
  }, []);

  const confirm = useCallback(
    ({ confirmLabel = "OK", cancelLabel = "Cancel", destructive, ...rest }: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        showDialog({
          ...rest,
          actions: [
            { label: cancelLabel, style: "cancel", onPress: () => resolve(false) },
            {
              label: confirmLabel,
              style: destructive ? "destructive" : "default",
              onPress: () => resolve(true),
            },
          ],
        });
      }),
    [showDialog],
  );

  /**
   * Close the current dialog first, then run the action. An action that opens
   * another dialog (a menu item leading to a confirm) queues behind nothing
   * and shows straight away.
   */
  const handleAction = useCallback((key: number, action: NormalizedAction<DialogAction>) => {
    setQueue((q) => (q[0]?.key === key ? q.slice(1) : q));
    try {
      const result = action.onPress?.();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch((e) => console.warn("[dialog] action failed", e));
      }
    } catch (e) {
      console.warn("[dialog] action failed", e);
    }
  }, []);

  const value = useMemo(() => ({ showDialog, confirm }), [showDialog, confirm]);
  const current = queue[0];

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AppDialog dialog={current} onAction={handleAction} />
    </DialogContext.Provider>
  );
};
