import type { RandomBytes } from "./crypto";

export interface GeneratorOptions {
  length: number;
  digits: boolean;
  symbols: boolean;
  upper: boolean;
}

export const DEFAULT_GENERATOR: GeneratorOptions = { length: 20, digits: true, symbols: true, upper: true };

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";

/** Uniform index in [0, max) via rejection sampling; `max` ≤ 256. */
const randomIndex = (max: number, rand: RandomBytes): number => {
  const limit = 256 - (256 % max);
  for (;;) {
    const b = rand(1)[0];
    if (b < limit) return b % max;
  }
};

export const generatePassword = (opts: GeneratorOptions, rand: RandomBytes): string => {
  const length = Math.min(64, Math.max(8, Math.floor(opts.length)));
  const classes = [LOWER];
  if (opts.upper) classes.push(UPPER);
  if (opts.digits) classes.push(DIGITS);
  if (opts.symbols) classes.push(SYMBOLS);
  const pool = classes.join("");

  // One from every enabled class, so none is ever missing...
  const chars = classes.map((c) => c[randomIndex(c.length, rand)]);
  // ...the rest from the combined pool.
  while (chars.length < length) chars.push(pool[randomIndex(pool.length, rand)]);

  // Fisher–Yates, so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, rand);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
};
