import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, View } from "react-native";
import {
  SecretType,
  VaultEnvelope,
  VaultDecryptError,
  createHeader,
  deriveKey,
  openVault,
  sealVault,
} from "./crypto";
import { randomBytes } from "./random";
import { EMPTY_VAULT, VaultData } from "./model";
import { INITIAL_THROTTLE, ThrottleState, canAttempt, recordFailure } from "./throttle";
import {
  createDeviceSecret,
  readDeviceSecret,
  readEnvelope,
  readThrottle,
  wipeVault,
  writeEnvelope,
  writeThrottle,
} from "./storage";

export type VaultStatus = "loading" | "none" | "locked" | "unlocked";

export interface VaultContextValue {
  status: VaultStatus;
  secretType: SecretType | null;
  data: VaultData | null;
  throttle: ThrottleState;
  create(type: SecretType, secret: string): Promise<void>;
  unlock(secret: string): Promise<"ok" | "wrong" | "throttled" | "unavailable">;
  lock(): void;
  save(mutator: (d: VaultData) => VaultData): Promise<void>;
  changeSecret(current: string, type: SecretType, next: string): Promise<"ok" | "wrong" | "throttled">;
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
 * Owns the derived key and decrypted data — in memory only, never in Redux,
 * never logged. Mounted inside the Vault tab, so nothing is decrypted unless
 * the user opens it.
 */
export const VaultProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [data, setData] = useState<VaultData | null>(null);
  const [throttle, setThrottle] = useState<ThrottleState>(INITIAL_THROTTLE);
  const [secretType, setSecretType] = useState<SecretType | null>(null);

  const keyRef = useRef<Uint8Array | null>(null);
  const envRef = useRef<VaultEnvelope | null>(null);
  const dataRef = useRef<VaultData | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    keyRef.current = null;
    dataRef.current = null;
    setData(null);
    setStatus((s) => (s === "unlocked" ? "locked" : s));
  }, []);

  const touch = useCallback(() => {
    if (!keyRef.current) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(lock, IDLE_LOCK_MS);
  }, [lock]);

  const commitUnlocked = useCallback(
    (key: Uint8Array, env: VaultEnvelope, d: VaultData) => {
      keyRef.current = key;
      envRef.current = env;
      dataRef.current = d;
      setData(d);
      setSecretType(env.secretType);
      setStatus("unlocked");
      touch();
    },
    [touch],
  );

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([readEnvelope(), readThrottle()]).then(([env, t]) => {
      if (cancelled) return;
      envRef.current = env;
      setSecretType(env?.secretType ?? null);
      setThrottle(t);
      setStatus(env ? "locked" : "none");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Lock the moment the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") lock();
    });
    return () => {
      sub.remove();
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [lock]);

  const failAttempt = useCallback(async () => {
    const next = recordFailure(await readThrottle(), Date.now());
    setThrottle(next);
    await writeThrottle(next).catch(() => undefined);
  }, []);

  const clearAttempts = useCallback(async () => {
    setThrottle(INITIAL_THROTTLE);
    await writeThrottle(INITIAL_THROTTLE).catch(() => undefined);
  }, []);

  const create = useCallback(
    async (type: SecretType, secret: string) => {
      const device = (await readDeviceSecret()) ?? (await createDeviceSecret(randomBytes));
      const header = createHeader(type, randomBytes);
      const key = await deriveKey(secret, device, header);
      const env = sealVault(EMPTY_VAULT, key, header, randomBytes);
      await writeEnvelope(env);
      await clearAttempts();
      commitUnlocked(key, env, EMPTY_VAULT);
    },
    [clearAttempts, commitUnlocked],
  );

  /** Derive and verify against the stored envelope; shared by unlock and changeSecret. */
  const tryOpen = useCallback(
    async (secret: string): Promise<{ key: Uint8Array; data: VaultData } | "wrong" | "throttled" | "unavailable"> => {
      const env = envRef.current;
      if (!env) return "unavailable";
      if (!canAttempt(await readThrottle(), Date.now())) return "throttled";
      const device = await readDeviceSecret();
      // Envelope restored (e.g. by Android backup) without its keystore secret.
      if (!device) return "unavailable";
      const key = await deriveKey(secret, device, env);
      try {
        const d = openVault<VaultData>(env, key);
        await clearAttempts();
        return { key, data: d };
      } catch (e) {
        if (!(e instanceof VaultDecryptError)) throw e;
        await failAttempt();
        return "wrong";
      }
    },
    [clearAttempts, failAttempt],
  );

  const unlock = useCallback(
    async (secret: string) => {
      const r = await tryOpen(secret);
      if (typeof r === "string") return r;
      commitUnlocked(r.key, envRef.current!, r.data);
      return "ok" as const;
    },
    [tryOpen, commitUnlocked],
  );

  /** Persist first, then show: a failed write never looks saved. */
  const save = useCallback(
    async (mutator: (d: VaultData) => VaultData) => {
      const key = keyRef.current;
      const env = envRef.current;
      const current = dataRef.current;
      if (!key || !env || !current) throw new Error("Vault is locked");
      const next = mutator(current);
      const sealed = sealVault(next, key, env, randomBytes);
      await writeEnvelope(sealed);
      envRef.current = sealed;
      dataRef.current = next;
      setData(next);
      touch();
    },
    [touch],
  );

  const changeSecret = useCallback(
    async (current: string, type: SecretType, next: string) => {
      const r = await tryOpen(current);
      if (r === "unavailable") return "wrong" as const;
      if (typeof r === "string") return r;
      const device = await readDeviceSecret();
      if (!device) return "wrong" as const;
      const header = createHeader(type, randomBytes);
      const key = await deriveKey(next, device, header);
      const env = sealVault(r.data, key, header, randomBytes);
      await writeEnvelope(env);
      commitUnlocked(key, env, r.data);
      return "ok" as const;
    },
    [tryOpen, commitUnlocked],
  );

  const reset = useCallback(async () => {
    await wipeVault();
    keyRef.current = null;
    envRef.current = null;
    dataRef.current = null;
    setData(null);
    setSecretType(null);
    setThrottle(INITIAL_THROTTLE);
    setStatus("none");
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({ status, secretType, data, throttle, create, unlock, lock, save, changeSecret, reset, touch }),
    [status, secretType, data, throttle, create, unlock, lock, save, changeSecret, reset, touch],
  );

  return (
    <VaultContext.Provider value={value}>
      {/* Any touch inside the vault counts as activity for the idle lock. */}
      <View style={{ flex: 1 }} onTouchStart={touch}>
        {children}
      </View>
    </VaultContext.Provider>
  );
};
