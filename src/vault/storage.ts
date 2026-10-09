import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { toB64, fromB64 } from "./crypto";
import { INITIAL_THROTTLE, ThrottleState } from "./throttle";
import type { VaultStore } from "./controller";

/**
 * Not under the `@finzz_cache_` prefix: sign-out must not delete the vault.
 * It belongs to the device, not to the Finzz account.
 */
const ENVELOPE_KEY = "@finzz_vault_v1";
const DEVICE_SECRET_KEY = "finzz_vault_device_secret";
const ATTEMPTS_KEY = "finzz_vault_attempts";

export const vaultStore: VaultStore = {
  readRaw: () => AsyncStorage.getItem(ENVELOPE_KEY),

  /** One setItem per save: the stored envelope is always a complete one. */
  writeRaw: (json) => AsyncStorage.setItem(ENVELOPE_KEY, json),

  readDeviceSecret: async () => {
    const b64 = await SecureStore.getItemAsync(DEVICE_SECRET_KEY);
    return b64 ? fromB64(b64) : null;
  },

  writeDeviceSecret: (secret) => SecureStore.setItemAsync(DEVICE_SECRET_KEY, toB64(secret)),

  readThrottle: async (): Promise<ThrottleState> => {
    try {
      const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
      const s = raw ? JSON.parse(raw) : null;
      return s && Number.isFinite(s.failures) && Number.isFinite(s.lockedUntil) ? s : INITIAL_THROTTLE;
    } catch {
      return INITIAL_THROTTLE;
    }
  },

  writeThrottle: (s) => SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(s)),

  wipe: async () => {
    await Promise.all([
      AsyncStorage.removeItem(ENVELOPE_KEY),
      SecureStore.deleteItemAsync(DEVICE_SECRET_KEY),
      SecureStore.deleteItemAsync(ATTEMPTS_KEY),
    ]);
  },
};
