import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { AppState, View } from "react-native";
import type { SecretType } from "./crypto";
import type { VaultData } from "./model";
import type { ThrottleState } from "./throttle";
import { UnlockResult, VaultController, VaultStatus } from "./controller";
import { vaultStore } from "./storage";
import { randomBytes } from "./random";
import { flushClipboardOnActive } from "./clipboard";

export type { VaultStatus } from "./controller";

export interface VaultContextValue {
  status: VaultStatus;
  secretType: SecretType | null;
  data: VaultData | null;
  throttle: ThrottleState;
  create(type: SecretType, secret: string): Promise<void>;
  unlock(secret: string): Promise<UnlockResult>;
  lock(): void;
  save(mutator: (d: VaultData) => VaultData): Promise<void>;
  changeSecret(
    current: string,
    type: SecretType,
    next: string,
  ): Promise<"ok" | "wrong" | "throttled" | "unavailable" | "cancelled">;
  reset(): Promise<void>;
  touch(): void;
}

const IDLE_LOCK_MS = 2 * 60_000;
const VaultContext = createContext<VaultContextValue | null>(null);

export const useVault = (): VaultContextValue => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside VaultProvider");
  return ctx;
};

/**
 * React binding over `VaultController`, which owns the key and decrypted data
 * in memory only — never Redux, never logged. Mounted inside the Vault tab,
 * so nothing is decrypted unless the user opens it.
 */
export const VaultProvider = ({ children }: { children: React.ReactNode }) => {
  const controllerRef = useRef<VaultController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new VaultController(vaultStore, randomBytes);
  }
  const c = controllerRef.current;
  const snap = useSyncExternalStore(c.subscribe, c.getSnapshot);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };

  const lock = useCallback(() => {
    clearIdle();
    c.lock();
  }, [c]);

  /** Any interaction (touch or typing) postpones the idle lock. */
  const touch = useCallback(() => {
    if (c.getSnapshot().status !== "unlocked") return;
    clearIdle();
    idleTimer.current = setTimeout(lock, IDLE_LOCK_MS);
  }, [c, lock]);

  useEffect(() => {
    void c.load();
  }, [c]);

  useEffect(() => {
    if (snap.status === "unlocked") touch();
    else clearIdle();
  }, [snap.status, touch]);

  // Lock the moment the app leaves the foreground; finish any pending
  // clipboard clear when it comes back (timers pause in the background).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void flushClipboardOnActive();
      else lock();
    });
    return () => {
      sub.remove();
      clearIdle();
    };
  }, [lock]);

  const value = useMemo<VaultContextValue>(
    () => ({
      ...snap,
      create: (type, secret) => c.create(type, secret),
      unlock: (secret) => c.unlock(secret),
      lock,
      save: async (mutator) => {
        await c.save(mutator);
        touch();
      },
      changeSecret: (current, type, next) => c.changeSecret(current, type, next),
      reset: () => c.reset(),
      touch,
    }),
    [snap, c, lock, touch],
  );

  return (
    <VaultContext.Provider value={value}>
      <View style={{ flex: 1 }} onTouchStart={touch}>
        {children}
      </View>
    </VaultContext.Provider>
  );
};
