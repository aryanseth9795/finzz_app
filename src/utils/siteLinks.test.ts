import { describe, it, expect } from "vitest";
import { siteUrlCandidates, pickReachableUrl } from "./siteLinks";

const A = "https://finzz.aryanseth.in/privacy";
const B = "https://finzz.aryantechie.in/privacy";

describe("siteUrlCandidates", () => {
  it("returns one url per origin, primary first", () => {
    expect(siteUrlCandidates("/privacy")).toEqual([A, B]);
  });
  it("rejects paths not starting with /", () => {
    expect(() => siteUrlCandidates("privacy")).toThrow();
    expect(() => siteUrlCandidates("")).toThrow();
  });
});

describe("pickReachableUrl", () => {
  it("returns the first reachable candidate", async () => {
    expect(await pickReachableUrl([A, B], async () => true)).toBe(A);
  });
  it("skips unreachable and rejecting probes", async () => {
    expect(await pickReachableUrl([A, B], async (u) => u === B)).toBe(B);
    expect(
      await pickReachableUrl([A, B], async (u) => {
        if (u === A) throw new Error("dns");
        return true;
      }),
    ).toBe(B);
  });
  it("falls back to the last candidate when none are reachable", async () => {
    expect(await pickReachableUrl([A, B], async () => false)).toBe(B);
  });
  it("treats a probe slower than the timeout as failed", async () => {
    const slow = (u: string) =>
      new Promise<boolean>((r) => setTimeout(() => r(true), u === A ? 200 : 0));
    expect(await pickReachableUrl([A, B], slow, 20)).toBe(B);
  });
});
