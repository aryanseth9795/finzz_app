import { describe, it, expect } from "vitest";
import {
  shouldUploadToken,
  shouldIgnoreRotation,
  shouldReportOutcome,
  isValidExpoToken,
  describeOutcome,
  type PushRegistrationOutcome,
} from "./pushRegistration";

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;
const TOKEN = "ExponentPushToken[abc123]";

describe("shouldUploadToken", () => {
  it("uploads when the token changed", () => {
    expect(shouldUploadToken(TOKEN, "ExponentPushToken[old]", NOW - 1000, NOW)).toBe(true);
  });

  it("uploads when it was never uploaded", () => {
    expect(shouldUploadToken(TOKEN, null, null, NOW)).toBe(true);
  });

  it("uploads when the token is the same but no upload time is recorded", () => {
    expect(shouldUploadToken(TOKEN, TOKEN, null, NOW)).toBe(true);
  });

  it("uploads when the last upload is older than the 24 h default max age", () => {
    expect(shouldUploadToken(TOKEN, TOKEN, NOW - 25 * HOUR, NOW)).toBe(true);
    expect(shouldUploadToken(TOKEN, TOKEN, NOW - 2 * DAY, NOW)).toBe(true);
  });

  it("does not upload when the token is the same and the upload is fresh (< 24 h)", () => {
    expect(shouldUploadToken(TOKEN, TOKEN, NOW - 23 * HOUR, NOW)).toBe(false);
    expect(shouldUploadToken(TOKEN, TOKEN, NOW - 1 * HOUR, NOW)).toBe(false);
  });

  it("honours a custom max age", () => {
    expect(shouldUploadToken(TOKEN, TOKEN, NOW - 2000, NOW, 1000)).toBe(true);
    expect(shouldUploadToken(TOKEN, TOKEN, NOW - 500, NOW, 1000)).toBe(false);
  });

  it("does not upload when there is no current token", () => {
    expect(shouldUploadToken(null, TOKEN, NOW, NOW)).toBe(false);
  });

  it("treats a clock that went backwards as stale", () => {
    expect(shouldUploadToken(TOKEN, TOKEN, NOW + DAY, NOW)).toBe(true);
  });
});

describe("shouldIgnoreRotation", () => {
  it("ignores a rotation event within 5 s of a completed run", () => {
    expect(shouldIgnoreRotation(NOW - 1000, NOW)).toBe(true);
    expect(shouldIgnoreRotation(NOW - 4999, NOW)).toBe(true);
  });

  it("handles a rotation event 5 s or more after the last run", () => {
    expect(shouldIgnoreRotation(NOW - 5000, NOW)).toBe(false);
    expect(shouldIgnoreRotation(NOW - 60_000, NOW)).toBe(false);
  });

  it("handles a rotation when no run has completed yet", () => {
    expect(shouldIgnoreRotation(0, NOW)).toBe(false);
  });

  it("does not ignore when the clock went backwards", () => {
    expect(shouldIgnoreRotation(NOW + 1000, NOW)).toBe(false);
  });
});

describe("shouldReportOutcome", () => {
  it("reports an outcome the first time only", () => {
    const seen = new Set<PushRegistrationOutcome>();
    expect(shouldReportOutcome(seen, "permission-denied")).toBe(true);
    expect(shouldReportOutcome(seen, "permission-denied")).toBe(false);
    expect(shouldReportOutcome(seen, "token-error")).toBe(true);
  });

  it("reports 'registered' but never 'unchanged'", () => {
    const seen = new Set<PushRegistrationOutcome>();
    expect(shouldReportOutcome(seen, "unchanged")).toBe(false);
    expect(shouldReportOutcome(seen, "registered")).toBe(true);
    expect(shouldReportOutcome(seen, "registered")).toBe(false);
  });
});

describe("isValidExpoToken", () => {
  it("accepts both prefixes", () => {
    expect(isValidExpoToken("ExponentPushToken[xyz]")).toBe(true);
    expect(isValidExpoToken("ExpoPushToken[xyz]")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidExpoToken("")).toBe(false);
    expect(isValidExpoToken("ExponentPushToken[]")).toBe(false);
    expect(isValidExpoToken("fcm-device-token")).toBe(false);
    expect(isValidExpoToken("ExponentPushToken[abc")).toBe(false);
    expect(isValidExpoToken(null)).toBe(false);
    expect(isValidExpoToken(undefined)).toBe(false);
    expect(isValidExpoToken(42)).toBe(false);
    expect(isValidExpoToken({})).toBe(false);
  });
});

describe("describeOutcome", () => {
  const all: PushRegistrationOutcome[] = [
    "registered",
    "unchanged",
    "permission-denied",
    "not-a-device",
    "no-project-id",
    "token-error",
    "upload-error",
  ];

  it("returns a distinct non-empty message for every outcome", () => {
    const messages = all.map(describeOutcome);
    for (const m of messages) expect(m.length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBe(all.length);
  });
});
