import { describe, it, expect } from "vitest";
import {
  ONBOARDING_SEEN_KEY,
  hasSeenOnboarding,
  markOnboardingSeen,
  pageFromOffset,
  isLastPage,
} from "./onboarding";

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: async (k: string) => (k in data ? data[k] : null),
    setItem: async (k: string, v: string) => {
      data[k] = v;
    },
  };
};

describe("onboarding seen flag", () => {
  it("uses the versioned key", () => {
    expect(ONBOARDING_SEEN_KEY).toBe("finzz.onboardingSeen.v1");
  });
  it("is false on a fresh install", async () => {
    expect(await hasSeenOnboarding(memory())).toBe(false);
  });
  it("is true after markOnboardingSeen", async () => {
    const s = memory();
    await markOnboardingSeen(s);
    expect(s.data[ONBOARDING_SEEN_KEY]).toBe("1");
    expect(await hasSeenOnboarding(s)).toBe(true);
  });
  it("treats a read error as seen (never block or nag)", async () => {
    const s = {
      getItem: async () => {
        throw new Error("boom");
      },
      setItem: async () => undefined,
    };
    expect(await hasSeenOnboarding(s)).toBe(true);
  });
  it("swallows write errors", async () => {
    const s = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error("disk full");
      },
    };
    await expect(markOnboardingSeen(s)).resolves.toBeUndefined();
  });
});

describe("pageFromOffset", () => {
  it("rounds to the nearest page", () => {
    expect(pageFromOffset(0, 400, 9)).toBe(0);
    expect(pageFromOffset(190, 400, 9)).toBe(0);
    expect(pageFromOffset(210, 400, 9)).toBe(1);
    expect(pageFromOffset(800, 400, 9)).toBe(2);
  });
  it("clamps to range", () => {
    expect(pageFromOffset(-50, 400, 9)).toBe(0);
    expect(pageFromOffset(99999, 400, 9)).toBe(8);
  });
  it("returns 0 for bad width or count", () => {
    expect(pageFromOffset(500, 0, 9)).toBe(0);
    expect(pageFromOffset(500, -1, 9)).toBe(0);
    expect(pageFromOffset(500, 400, 0)).toBe(0);
  });
});

describe("isLastPage", () => {
  it("detects the last page", () => {
    expect(isLastPage(8, 9)).toBe(true);
    expect(isLastPage(7, 9)).toBe(false);
    expect(isLastPage(0, 1)).toBe(true);
  });
});

describe("hasSeenOnboarding timeout (review R2)", () => {
  it("counts a storage read that never settles as seen, so the auth stack never stays blank", async () => {
    const hanging = { getItem: () => new Promise<string | null>(() => {}), setItem: async () => {} };
    await expect(hasSeenOnboarding(hanging, 20)).resolves.toBe(true);
  });

  it("still answers false quickly on a fresh install", async () => {
    const fresh = { getItem: async () => null, setItem: async () => {} };
    await expect(hasSeenOnboarding(fresh, 20)).resolves.toBe(false);
  });
});
