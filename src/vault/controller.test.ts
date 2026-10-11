import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes as nodeRandom } from "node:crypto";
import { VaultController, type VaultStore } from "./controller";
import { INITIAL_THROTTLE, type ThrottleState } from "./throttle";
import { addGroup } from "./model";
import type { KdfParams } from "./crypto";

const rand = (n: number) => new Uint8Array(nodeRandom(n));
const FAST: KdfParams = { name: "scrypt", N: 16, r: 8, p: 1 };

/** In-memory store; `gate` lets a test hold a write open to simulate a slow disk. */
class FakeStore implements VaultStore {
  raw: string | null = null;
  device: Uint8Array | null = null;
  throttle: ThrottleState = INITIAL_THROTTLE;
  failRead = false;
  failWrite = false;
  gate: Promise<void> | null = null;
  onWriteStart: (() => void) | null = null;
  async readRaw() {
    if (this.failRead) throw new Error("read failed");
    return this.raw;
  }
  async writeRaw(json: string) {
    this.onWriteStart?.();
    if (this.gate) await this.gate;
    if (this.failWrite) throw new Error("disk full");
    this.raw = json;
  }
  async readDeviceSecret() {
    return this.device;
  }
  async writeDeviceSecret(s: Uint8Array) {
    this.device = s;
  }
  async readThrottle() {
    return this.throttle;
  }
  async writeThrottle(s: ThrottleState) {
    this.throttle = s;
  }
  async wipe() {
    this.raw = null;
    this.device = null;
    this.throttle = INITIAL_THROTTLE;
  }
}

let store: FakeStore;
let clock: number;
const make = () => new VaultController(store, rand, { kdf: FAST, now: () => clock });

beforeEach(() => {
  store = new FakeStore();
  clock = 1_000_000;
});

const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((r) => (release = r));
  return { promise, release };
};

describe("load", () => {
  it("reports none / locked", async () => {
    const c = make();
    await c.load();
    expect(c.getSnapshot().status).toBe("none");
    await c.create("pin", "123456");
    const c2 = make();
    await c2.load();
    expect(c2.getSnapshot().status).toBe("locked");
  });

  it("reports an unreadable envelope instead of 'none' (no silent overwrite)", async () => {
    store.raw = "{not json";
    const c = make();
    await c.load();
    expect(c.getSnapshot().status).toBe("unreadable");
    store.raw = JSON.stringify({ v: 2, future: true });
    const c2 = make();
    await c2.load();
    expect(c2.getSnapshot().status).toBe("unreadable");
  });

  it("reports unreadable when storage cannot be read, rather than spinning", async () => {
    store.failRead = true;
    const c = make();
    await c.load();
    expect(c.getSnapshot().status).toBe("unreadable");
  });
});

describe("create", () => {
  it("refuses to overwrite anything already stored", async () => {
    store.raw = "{not json";
    const c = make();
    await c.load();
    await expect(c.create("pin", "123456")).rejects.toThrow(/already/i);
    expect(store.raw).toBe("{not json");
  });

  it("concurrent creates produce one vault that can be reopened", async () => {
    const c = make();
    await c.load();
    const results = await Promise.allSettled([c.create("pin", "1111"), c.create("pin", "1111")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await c.save((d) => addGroup(d, "Social", "people", "g1"));
    c.lock();
    expect(await c.unlock("1111")).toBe("ok");
    expect(c.getSnapshot().data?.groups.map((g) => g.name)).toEqual(["Social"]);
  });
});

describe("lock during in-flight work", () => {
  it("an unlock that finishes after lock() leaves the vault locked", async () => {
    const c = make();
    await c.load();
    await c.create("pin", "123456");
    c.lock();
    const pending = c.unlock("123456");
    c.lock(); // app backgrounded mid-derivation
    expect(await pending).toBe("cancelled");
    expect(c.getSnapshot().status).toBe("locked");
    expect(c.getSnapshot().data).toBeNull();
  });

  it("a save that finishes after lock() does not put data back in memory", async () => {
    const c = make();
    await c.load();
    await c.create("pin", "123456");
    const gate = deferred();
    const writing = deferred();
    store.gate = gate.promise;
    store.onWriteStart = writing.release;
    const pending = c.save((d) => addGroup(d, "Banks", "card", "g1"));
    await writing.promise; // lock while the write is in progress
    c.lock();
    gate.release();
    await pending;
    expect(c.getSnapshot().status).toBe("locked");
    expect(c.getSnapshot().data).toBeNull();
    store.gate = null;
    expect(await c.unlock("123456")).toBe("ok");
    expect(c.getSnapshot().data?.groups).toHaveLength(1);
  });
});

describe("save", () => {
  it("serialises concurrent saves so no update is lost", async () => {
    const c = make();
    await c.load();
    await c.create("pin", "123456");
    await Promise.all([
      c.save((d) => addGroup(d, "A", "folder", "g1")),
      c.save((d) => addGroup(d, "B", "folder", "g2")),
    ]);
    expect(c.getSnapshot().data?.groups.map((g) => g.name).sort()).toEqual(["A", "B"]);
  });

  it("does not show a change whose write failed", async () => {
    const c = make();
    await c.load();
    await c.create("pin", "123456");
    store.failWrite = true;
    await expect(c.save((d) => addGroup(d, "A", "folder", "g1"))).rejects.toThrow();
    expect(c.getSnapshot().data?.groups).toEqual([]);
  });
});

describe("throttle", () => {
  it("counts a failure even if the attempt never finishes, and clears on success", async () => {
    const c = make();
    await c.load();
    await c.create("pin", "123456");
    c.lock();
    expect(await c.unlock("000000")).toBe("wrong");
    expect(store.throttle.failures).toBe(1);
    expect(await c.unlock("123456")).toBe("ok");
    expect(store.throttle.failures).toBe(0);
  });

  it("concurrent wrong attempts each count", async () => {
    const c = make();
    await c.load();
    await c.create("pin", "123456");
    c.lock();
    await Promise.all([c.unlock("1"), c.unlock("2"), c.unlock("3")]);
    expect(store.throttle.failures).toBe(3);
  });

  it("a clock moved backwards cannot extend a lockout beyond its length", async () => {
    store.throttle = { failures: 5, lockedUntil: clock + 365 * 24 * 3600_000 };
    const c = make();
    await c.load();
    expect(c.getSnapshot().throttle.lockedUntil).toBeLessThanOrEqual(clock + 30_000);
  });
});

describe("reset", () => {
  it("wipes everything and allows a fresh create", async () => {
    const c = make();
    await c.load();
    await c.create("pin", "123456");
    await c.reset();
    expect(c.getSnapshot().status).toBe("none");
    expect(store.raw).toBeNull();
    await c.create("password", "abcd");
    expect(c.getSnapshot().status).toBe("unlocked");
  });
});

describe("KDF upgrade", () => {
  // A vault sealed with older (costlier) params than the controller now uses.
  const OLD: KdfParams = { name: "scrypt", N: 32, r: 8, p: 1 };
  const makeOld = () => new VaultController(store, rand, { kdf: OLD, now: () => clock });
  const storedKdf = () => JSON.parse(store.raw!).kdf;

  it("re-seals an old vault with the current params on unlock, keeping its data", async () => {
    const old = makeOld();
    await old.load();
    await old.create("pin", "123456");
    await old.save((d) => addGroup(d, "Mail", "mail", "g-mail"));
    expect(storedKdf()).toEqual(OLD);

    const c = make();
    await c.load();
    expect(await c.unlock("123456")).toBe("ok");
    expect(storedKdf()).toEqual(FAST);
    expect(c.getSnapshot().data?.groups.map((g) => g.name)).toContain("Mail");

    // Still opens with the same secret, and later saves keep the new params.
    c.lock();
    expect(await c.unlock("123456")).toBe("ok");
    await c.save((d) => addGroup(d, "Social", "people", "g-social"));
    expect(storedKdf()).toEqual(FAST);
    const c2 = make();
    await c2.load();
    expect(await c2.unlock("123456")).toBe("ok");
    expect(c2.getSnapshot().data?.groups.map((g) => g.name)).toEqual(
      expect.arrayContaining(["Mail", "Social"]),
    );
  });

  it("still unlocks when the upgrade cannot be written", async () => {
    const old = makeOld();
    await old.load();
    await old.create("pin", "123456");
    const c = make();
    await c.load();
    store.failWrite = true;
    expect(await c.unlock("123456")).toBe("ok");
    expect(storedKdf()).toEqual(OLD);
  });

  it("a wrong secret does not touch the stored vault", async () => {
    const old = makeOld();
    await old.load();
    await old.create("pin", "123456");
    const before = store.raw;
    const c = make();
    await c.load();
    expect(await c.unlock("000000")).toBe("wrong");
    expect(store.raw).toBe(before);
  });
});
