import {
  DEFAULT_KDF,
  KdfParams,
  RandomBytes,
  SecretType,
  VaultDecryptError,
  VaultEnvelope,
  createHeader,
  deriveKey,
  openVault,
  parseEnvelope,
  sealVault,
} from "./crypto";
import { EMPTY_VAULT, VaultData } from "./model";
import {
  INITIAL_THROTTLE,
  ThrottleState,
  canAttempt,
  clampThrottle,
  recordFailure,
} from "./throttle";

/**
 * Vault state machine, free of React and Expo so the race-prone parts —
 * lock during in-flight work, concurrent creates/saves, throttle accounting —
 * can be tested directly. `VaultContext` is a thin binding over this.
 */

export interface VaultStore {
  readRaw(): Promise<string | null>;
  writeRaw(json: string): Promise<void>;
  readDeviceSecret(): Promise<Uint8Array | null>;
  writeDeviceSecret(secret: Uint8Array): Promise<void>;
  readThrottle(): Promise<ThrottleState>;
  writeThrottle(state: ThrottleState): Promise<void>;
  wipe(): Promise<void>;
}

/** `unreadable`: something is stored but cannot be parsed — never treated as "no vault". */
export type VaultStatus = "loading" | "none" | "locked" | "unlocked" | "unreadable";

export interface VaultSnapshot {
  status: VaultStatus;
  secretType: SecretType | null;
  data: VaultData | null;
  throttle: ThrottleState;
}

export type UnlockResult = "ok" | "wrong" | "throttled" | "unavailable" | "cancelled";

interface Options {
  kdf?: KdfParams;
  now?: () => number;
}

export class VaultController {
  private snap: VaultSnapshot = {
    status: "loading",
    secretType: null,
    data: null,
    throttle: INITIAL_THROTTLE,
  };
  private listeners = new Set<() => void>();
  private key: Uint8Array | null = null;
  private env: VaultEnvelope | null = null;
  /** Bumped by lock()/reset(); async work started under an older epoch must not commit. */
  private epoch = 0;
  /** Serialises create/unlock/save/changeSecret/reset. */
  private queue: Promise<unknown> = Promise.resolve();
  private readonly kdf: KdfParams;
  private readonly now: () => number;

  constructor(
    private readonly store: VaultStore,
    private readonly rand: RandomBytes,
    opts: Options = {},
  ) {
    this.kdf = opts.kdf ?? DEFAULT_KDF;
    this.now = opts.now ?? Date.now;
  }

  getSnapshot = (): VaultSnapshot => this.snap;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<VaultSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async load(): Promise<void> {
    try {
      const [raw, throttle] = await Promise.all([this.store.readRaw(), this.store.readThrottle()]);
      const clamped = clampThrottle(throttle, this.now());
      if (raw === null) {
        this.set({ status: "none", throttle: clamped });
        return;
      }
      let env: VaultEnvelope | null = null;
      try {
        env = parseEnvelope(JSON.parse(raw));
      } catch {
        env = null;
      }
      this.env = env;
      this.set({
        status: env ? "locked" : "unreadable",
        secretType: env?.secretType ?? null,
        throttle: clamped,
      });
    } catch {
      this.set({ status: "unreadable" });
    }
  }

  lock = (): void => {
    this.epoch++;
    this.key = null;
    if (this.snap.status === "unlocked") this.set({ status: "locked", data: null });
    else if (this.snap.data) this.set({ data: null });
  };

  private commitUnlocked(key: Uint8Array, env: VaultEnvelope, data: VaultData) {
    this.key = key;
    this.env = env;
    this.set({ status: "unlocked", secretType: env.secretType, data });
  }

  create(type: SecretType, secret: string): Promise<void> {
    const epoch = this.epoch;
    return this.exclusive(async () => {
      // Never overwrite: a stored-but-unreadable vault must be reset explicitly.
      if ((await this.store.readRaw()) !== null) {
        throw new Error("A vault already exists on this device");
      }
      let device = await this.store.readDeviceSecret();
      if (!device) {
        device = this.rand(32);
        await this.store.writeDeviceSecret(device);
      }
      const header = createHeader(type, this.rand, this.kdf);
      const key = await deriveKey(secret, device, header);
      const env = sealVault(EMPTY_VAULT, key, header, this.rand);
      await this.store.writeRaw(JSON.stringify(env));
      await this.store.writeThrottle(INITIAL_THROTTLE);
      this.env = env;
      this.set({ throttle: INITIAL_THROTTLE, secretType: type });
      if (epoch === this.epoch) this.commitUnlocked(key, env, EMPTY_VAULT);
      else this.set({ status: "locked" });
    });
  }

  /**
   * Verify `secret` against the stored envelope. The failure is recorded
   * BEFORE deriving (and cleared on success), so killing the app mid-attempt
   * or racing attempts can never skip the count.
   */
  private async tryOpen(
    secret: string,
  ): Promise<{ key: Uint8Array; data: VaultData; env: VaultEnvelope } | Exclude<UnlockResult, "ok" | "cancelled">> {
    const env = this.env;
    if (!env) return "unavailable";
    const throttle = clampThrottle(await this.store.readThrottle(), this.now());
    if (!canAttempt(throttle, this.now())) {
      this.set({ throttle });
      return "throttled";
    }
    const device = await this.store.readDeviceSecret();
    // Envelope restored (e.g. Android backup) without its keystore secret.
    if (!device) return "unavailable";

    const failed = recordFailure(throttle, this.now());
    await this.store.writeThrottle(failed);

    const key = await deriveKey(secret, device, env);
    try {
      const data = openVault<VaultData>(env, key);
      await this.store.writeThrottle(INITIAL_THROTTLE);
      this.set({ throttle: INITIAL_THROTTLE });
      return { key, data, env };
    } catch (e) {
      if (!(e instanceof VaultDecryptError)) throw e;
      this.set({ throttle: failed });
      return "wrong";
    }
  }

  // Each operation captures the epoch at CALL time: a lock() issued while it
  // waits in the queue or runs must cancel its commit.
  unlock(secret: string): Promise<UnlockResult> {
    const epoch = this.epoch;
    return this.exclusive(async () => {
      const r = await this.tryOpen(secret);
      if (typeof r === "string") return r;
      // Locked (e.g. app backgrounded) while deriving: stay locked.
      if (epoch !== this.epoch) return "cancelled";
      this.commitUnlocked(r.key, r.env, r.data);
      return "ok";
    });
  }

  /** Persist first, then show: a failed write never looks saved. */
  save(mutator: (d: VaultData) => VaultData): Promise<void> {
    const epoch = this.epoch;
    return this.exclusive(async () => {
      const key = this.key;
      const env = this.env;
      const current = this.snap.data;
      if (!key || !env || !current || this.snap.status !== "unlocked") {
        throw new Error("Vault is locked");
      }
      const next = mutator(current);
      const sealed = sealVault(next, key, env, this.rand);
      await this.store.writeRaw(JSON.stringify(sealed));
      this.env = sealed;
      // Locked while writing: the save is persisted, but nothing returns to memory.
      if (epoch === this.epoch) this.set({ data: next });
    });
  }

  changeSecret(current: string, type: SecretType, next: string): Promise<"ok" | "wrong" | "throttled" | "unavailable" | "cancelled"> {
    const epoch = this.epoch;
    return this.exclusive(async () => {
      const r = await this.tryOpen(current);
      if (typeof r === "string") return r;
      const device = await this.store.readDeviceSecret();
      if (!device) return "unavailable";
      const header = createHeader(type, this.rand, this.kdf);
      const key = await deriveKey(next, device, header);
      const env = sealVault(r.data, key, header, this.rand);
      await this.store.writeRaw(JSON.stringify(env));
      this.env = env;
      this.set({ secretType: type });
      if (epoch !== this.epoch) return "cancelled";
      this.commitUnlocked(key, env, r.data);
      return "ok";
    });
  }

  reset(): Promise<void> {
    return this.exclusive(async () => {
      await this.store.wipe();
      this.epoch++;
      this.key = null;
      this.env = null;
      this.set({ status: "none", secretType: null, data: null, throttle: INITIAL_THROTTLE });
    });
  }
}
