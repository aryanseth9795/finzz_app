import { describe, it, expect } from "vitest";
import { randomBytes as nodeRandom } from "node:crypto";
import {
  createHeader,
  deriveKey,
  sealVault,
  openVault,
  parseEnvelope,
  VaultDecryptError,
  type KdfParams,
} from "./crypto";

const rand = (n: number) => new Uint8Array(nodeRandom(n));
// Tiny cost so tests run fast; production uses DEFAULT_KDF.
const FAST: KdfParams = { name: "scrypt", N: 16, r: 8, p: 1 };
const device = rand(32);
const data = { groups: [], entries: [{ id: "e1", title: "Gmail", password: "hunter2" }] };

const setup = async (secret = "123456", dev = device) => {
  const header = createHeader("pin", rand, FAST);
  const key = await deriveKey(secret, dev, header);
  return { header, key, env: sealVault(data, key, header, rand) };
};

describe("vault crypto", () => {
  it("round-trips", async () => {
    const { env, key } = await setup();
    expect(openVault(env, key)).toEqual(data);
  });

  it("does not store plaintext", async () => {
    const { env } = await setup();
    expect(JSON.stringify(env)).not.toContain("hunter2");
  });

  it("fails with the wrong PIN", async () => {
    const { env, header } = await setup("123456");
    const wrong = await deriveKey("123457", device, header);
    expect(() => openVault(env, wrong)).toThrow(VaultDecryptError);
  });

  it("fails with the right PIN but the wrong device secret", async () => {
    const { env, header } = await setup("123456");
    const other = await deriveKey("123456", rand(32), header);
    expect(() => openVault(env, other)).toThrow(VaultDecryptError);
  });

  it("fails when the ciphertext is tampered with", async () => {
    const { env, key } = await setup();
    const bytes = Buffer.from(env.ct, "base64");
    bytes[0] ^= 1;
    expect(() => openVault({ ...env, ct: bytes.toString("base64") }, key)).toThrow(
      VaultDecryptError,
    );
  });

  it("fails when the header (associated data) is tampered with", async () => {
    const { env, key } = await setup();
    expect(() => openVault({ ...env, secretType: "password" }, key)).toThrow(VaultDecryptError);
    expect(() => openVault({ ...env, kdf: { ...env.kdf, N: 32 } }, key)).toThrow(VaultDecryptError);
  });

  it("uses a fresh nonce on every save and a fresh salt per header", async () => {
    const { header, key } = await setup();
    const a = sealVault(data, key, header, rand);
    const b = sealVault(data, key, header, rand);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ct).not.toBe(b.ct);
    expect(createHeader("pin", rand, FAST).salt).not.toBe(createHeader("pin", rand, FAST).salt);
  });

  it("parses only well-formed envelopes", async () => {
    const { env } = await setup();
    expect(parseEnvelope(JSON.parse(JSON.stringify(env)))).toEqual(env);
    expect(parseEnvelope(null)).toBeNull();
    expect(parseEnvelope({ ...env, v: 2 })).toBeNull();
    expect(parseEnvelope({ ...env, secretType: "face" })).toBeNull();
    expect(parseEnvelope({ ...env, ct: 5 })).toBeNull();
  });
});

describe("large vaults", () => {
  it("round-trips a 200 KB vault (base64 chunking)", async () => {
    const big = { groups: [], entries: Array.from({ length: 100 }, (_, i) => ({ id: `e${i}`, notes: "x".repeat(2000) })) };
    const header = createHeader("pin", rand, FAST);
    const key = await deriveKey("123456", device, header);
    expect(openVault(sealVault(big, key, header, rand), key)).toEqual(big);
  });
});
