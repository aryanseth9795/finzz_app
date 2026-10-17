import { describe, it, expect } from "vitest";
import {
  shouldUploadToken,
  isValidExpoToken,
  describeOutcome,
  type PushRegistrationOutcome,
} from "./pushRegistration";

const DAY = 24 * 3600e3;
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

  it("uploads when the last upload is older than the max age", () => {
    expect(shouldUploadToken(TOKEN, TOKEN, NOW - 8 * DAY, NOW)).toBe(true);
  });

  it("does not upload when the token is the same and the upload is fresh", () => {
    expect(shouldUploadToken(TOKEN, TOKEN, NOW - 1 * DAY, NOW)).toBe(false);
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
