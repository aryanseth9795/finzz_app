import { describe, it, expect } from "vitest";
import { siteUrlCandidates, pickReachableUrl, createSiteOpener } from "./siteLinks";

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
  // Review R4: the last origin (aryantechie.in) expires Dec 2026; phones that
  // never take a later OTA must not be sent to a lapsed domain when offline.
  it("falls back to the primary when none are reachable", async () => {
    expect(await pickReachableUrl([A, B], async () => false)).toBe(A);
  });
  it("treats a probe slower than the timeout as failed", async () => {
    const slow = (u: string) =>
      new Promise<boolean>((r) => setTimeout(() => r(true), u === A ? 200 : 0));
    expect(await pickReachableUrl([A, B], slow, 20)).toBe(B);
  });
});

describe("createSiteOpener (review R5)", () => {
  it("ignores taps while a probe is in flight, so one tap = one browser tab", async () => {
    let release: (v: boolean) => void = () => {};
    const probe = () => new Promise<boolean>((r) => (release = r));
    const opened: string[] = [];
    const open = createSiteOpener(probe, async (u) => void opened.push(u));
    const first = open("/privacy");
    const second = open("/privacy");
    release(true);
    await Promise.all([first, second]);
    expect(opened).toHaveLength(1);
    // and it accepts taps again afterwards
    const third = open("/terms");
    release(true);
    await third;
    expect(opened).toHaveLength(2);
  });

  it("never rejects when opening fails", async () => {
    const open = createSiteOpener(async () => true, async () => {
      throw new Error("no browser");
    });
    await expect(open("/privacy")).resolves.toBeUndefined();
  });
});
