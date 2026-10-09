import { scryptAsync } from "@noble/hashes/scrypt.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { utf8ToBytes, bytesToUtf8, concatBytes } from "@noble/ciphers/utils.js";

/**
 * Vault encryption.
 *
 * The key is scrypt(secret ‖ deviceSecret). The device secret lives in the
 * hardware-backed keystore and never leaves the phone, so a copied envelope
 * cannot be brute-forced offline even when the secret is a 4-digit PIN.
 * Pure apart from the injected random source, so it runs under vitest.
 */

export type SecretType = "pin" | "password";

export interface KdfParams {
  name: "scrypt";
  N: number;
  r: number;
  p: number;
}

export interface VaultHeader {
  v: 1;
  secretType: SecretType;
  kdf: KdfParams;
  salt: string;
}

export interface VaultEnvelope extends VaultHeader {
  nonce: string;
  ct: string;
}

export type RandomBytes = (n: number) => Uint8Array;

export const DEFAULT_KDF: KdfParams = { name: "scrypt", N: 2 ** 14, r: 8, p: 1 };

export class VaultDecryptError extends Error {
  constructor() {
    super("Vault could not be decrypted");
    this.name = "VaultDecryptError";
  }
}

export const toB64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

export const fromB64 = (str: string): Uint8Array => {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

export const createHeader = (
  secretType: SecretType,
  rand: RandomBytes,
  kdf: KdfParams = DEFAULT_KDF,
): VaultHeader => ({ v: 1, secretType, kdf, salt: toB64(rand(16)) });

export const deriveKey = (
  secret: string,
  deviceSecret: Uint8Array,
  header: VaultHeader,
): Promise<Uint8Array> =>
  scryptAsync(concatBytes(utf8ToBytes(secret), deviceSecret), fromB64(header.salt), {
    N: header.kdf.N,
    r: header.kdf.r,
    p: header.kdf.p,
    dkLen: 32,
  });

/** The header is authenticated, so editing KDF params or type breaks decryption. */
const associatedData = (h: VaultHeader): Uint8Array =>
  utf8ToBytes(JSON.stringify([h.v, h.secretType, h.kdf.name, h.kdf.N, h.kdf.r, h.kdf.p, h.salt]));

const headerOf = (env: VaultHeader): VaultHeader => ({
  v: env.v,
  secretType: env.secretType,
  kdf: env.kdf,
  salt: env.salt,
});

export const sealVault = (
  data: unknown,
  key: Uint8Array,
  header: VaultHeader,
  rand: RandomBytes,
): VaultEnvelope => {
  const h = headerOf(header);
  const nonce = rand(24);
  const ct = xchacha20poly1305(key, nonce, associatedData(h)).encrypt(
    utf8ToBytes(JSON.stringify(data)),
  );
  return { ...h, nonce: toB64(nonce), ct: toB64(ct) };
};

export const openVault = <T,>(env: VaultEnvelope, key: Uint8Array): T => {
  try {
    const pt = xchacha20poly1305(key, fromB64(env.nonce), associatedData(headerOf(env))).decrypt(
      fromB64(env.ct),
    );
    return JSON.parse(bytesToUtf8(pt)) as T;
  } catch {
    throw new VaultDecryptError();
  }
};

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

export const parseEnvelope = (raw: unknown): VaultEnvelope | null => {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const kdf = e.kdf as Record<string, unknown> | undefined;
  if (
    e.v !== 1 ||
    (e.secretType !== "pin" && e.secretType !== "password") ||
    !kdf ||
    kdf.name !== "scrypt" ||
    !isInt(kdf.N) ||
    !isInt(kdf.r) ||
    !isInt(kdf.p) ||
    !isStr(e.salt) ||
    !isStr(e.nonce) ||
    !isStr(e.ct)
  ) {
    return null;
  }
  return {
    v: 1,
    secretType: e.secretType,
    kdf: { name: "scrypt", N: kdf.N, r: kdf.r, p: kdf.p },
    salt: e.salt,
    nonce: e.nonce,
    ct: e.ct,
  };
};
