import { describe, it, expect } from "vitest";
import { randomBytes as nodeRandom } from "node:crypto";
import { validateSecret } from "./secret";
import { lockoutFor, recordFailure, canAttempt, remainingMs, INITIAL_THROTTLE } from "./throttle";
import { generatePassword, DEFAULT_GENERATOR } from "./generator";

const rand = (n: number) => new Uint8Array(nodeRandom(n));

describe("validateSecret", () => {
  it("accepts 4–6 digit PINs only", () => {
    expect(validateSecret("pin", "1234")).toBeNull();
    expect(validateSecret("pin", "123456")).toBeNull();
    expect(validateSecret("pin", "123")).toMatch(/4–6 digits/);
    expect(validateSecret("pin", "1234567")).toMatch(/4–6 digits/);
    expect(validateSecret("pin", "12a4")).toMatch(/4–6 digits/);
  });
  it("accepts passwords of 4+ chars without surrounding spaces", () => {
    expect(validateSecret("password", "ab1!")).toBeNull();
    expect(validateSecret("password", "abc")).toMatch(/at least 4/);
    expect(validateSecret("password", " abcd")).toMatch(/space/);
    expect(validateSecret("password", "abcd ")).toMatch(/space/);
  });
});

describe("throttle", () => {
  it("escalates lockouts", () => {
    expect(lockoutFor(4)).toBe(0);
    expect(lockoutFor(5)).toBe(30_000);
    expect(lockoutFor(9)).toBe(30_000);
    expect(lockoutFor(10)).toBe(5 * 60_000);
    expect(lockoutFor(15)).toBe(30 * 60_000);
    expect(lockoutFor(40)).toBe(30 * 60_000);
  });
  it("blocks attempts until the lockout expires", () => {
    let s = INITIAL_THROTTLE;
    for (let i = 0; i < 5; i++) s = recordFailure(s, 1_000);
    expect(s.failures).toBe(5);
    expect(canAttempt(s, 1_000)).toBe(false);
    expect(remainingMs(s, 11_000)).toBe(20_000);
    expect(canAttempt(s, 31_000)).toBe(true);
  });
  it("does not lock before the fifth failure", () => {
    let s = INITIAL_THROTTLE;
    for (let i = 0; i < 4; i++) s = recordFailure(s, 1_000);
    expect(canAttempt(s, 1_000)).toBe(true);
  });
});

describe("generatePassword", () => {
  const has = (s: string, chars: string) => [...s].some((c) => chars.includes(c));
  const DIGITS = "0123456789";
  const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";

  it("respects length, clamped to 8–64", () => {
    expect(generatePassword({ ...DEFAULT_GENERATOR, length: 20 }, rand)).toHaveLength(20);
    expect(generatePassword({ ...DEFAULT_GENERATOR, length: 3 }, rand)).toHaveLength(8);
    expect(generatePassword({ ...DEFAULT_GENERATOR, length: 200 }, rand)).toHaveLength(64);
  });
  it("includes every enabled class", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword({ length: 8, digits: true, symbols: true, upper: true }, rand);
      expect(has(p, DIGITS) && has(p, UPPER) && has(p, SYMBOLS)).toBe(true);
    }
  });
  it("never includes disabled classes", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword({ length: 30, digits: false, symbols: false, upper: false }, rand);
      expect(has(p, DIGITS) || has(p, UPPER) || has(p, SYMBOLS)).toBe(false);
    }
  });
  it("is deterministic for a given byte source", () => {
    const seq = () => {
      let i = 0;
      return (n: number) => Uint8Array.from({ length: n }, () => (i++ * 37) % 256);
    };
    expect(generatePassword(DEFAULT_GENERATOR, seq())).toBe(generatePassword(DEFAULT_GENERATOR, seq()));
  });
});
