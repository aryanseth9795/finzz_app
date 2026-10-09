import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { VaultEnvelope, parseEnvelope, toB64, fromB64, RandomBytes } from "./crypto";
import { INITIAL_THROTTLE, ThrottleState } from "./throttle";

/**
 * Not under the `@finzz_cache_` prefix: sign-out must not delete the vault.
 * It belongs to the device, not to the Finzz account.
 */
const ENVELOPE_KEY = "@finzz_vault_v1";
const DEVICE_SECRET_KEY = "finzz_vault_device_secret";
const ATTEMPTS_KEY = "finzz_vault_attempts";

export const readEnvelope = async (): Promise<VaultEnvelope | null> => {
  const raw = await AsyncStorage.getItem(ENVELOPE_KEY);
  if (!raw) return null;
  try {
    return parseEnvelope(JSON.parse(raw));
  } catch {
    return null;
  }
};

/** One setItem per save: the stored envelope is always a complete one. */
export const writeEnvelope = (env: VaultEnvelope): Promise<void> =>
  AsyncStorage.setItem(ENVELOPE_KEY, JSON.stringify(env));

export const readDeviceSecret = async (): Promise<Uint8Array | null> => {
  const b64 = await SecureStore.getItemAsync(DEVICE_SECRET_KEY);
  return b64 ? fromB64(b64) : null;
};

export const createDeviceSecret = async (rand: RandomBytes): Promise<Uint8Array> => {
  const secret = rand(32);
  await SecureStore.setItemAsync(DEVICE_SECRET_KEY, toB64(secret));
  return secret;
};

export const readThrottle = async (): Promise<ThrottleState> => {
  try {
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && Number.isFinite(s.failures) && Number.isFinite(s.lockedUntil) ? s : INITIAL_THROTTLE;
  } catch {
    return INITIAL_THROTTLE;
  }
};

export const writeThrottle = (s: ThrottleState): Promise<void> =>
  SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(s));

export const wipeVault = async (): Promise<void> => {
  await Promise.all([
    AsyncStorage.removeItem(ENVELOPE_KEY),
    SecureStore.deleteItemAsync(DEVICE_SECRET_KEY),
    SecureStore.deleteItemAsync(ATTEMPTS_KEY),
  ]);
};
