import { describe, it, expect } from "vitest";
import {
  compareVersions,
  isValidVersion,
  parseRelease,
  decideGate,
  type AppRelease,
} from "./version";

const rel = (min: string, latest: string): AppRelease => ({
  minSupportedVersion: min,
  latestVersion: latest,
  apkUrl: "https://x/finzz.apk",
  releaseNotes: "",
});

describe("compareVersions", () => {
  it("is numeric per segment", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
  });
  it("validates", () => {
    expect(isValidVersion("1.0.0")).toBe(true);
    expect(isValidVersion("1.0")).toBe(false);
    expect(isValidVersion(null)).toBe(false);
  });
});

describe("parseRelease", () => {
  it("accepts a well-formed release", () => {
    expect(parseRelease({ ...rel("1.0.0", "1.1.0"), updatedAt: "x" })).toEqual(
      rel("1.0.0", "1.1.0"),
    );
  });
  it("rejects partial or malformed data", () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease({ latestVersion: "1.1.0" })).toBeNull();
    expect(parseRelease({ ...rel("1.1", "1.1.0") })).toBeNull();
  });
  it("defaults missing notes/url to empty strings", () => {
    expect(
      parseRelease({ latestVersion: "1.1.0", minSupportedVersion: "1.0.0" }),
    ).toEqual({
      latestVersion: "1.1.0",
      minSupportedVersion: "1.0.0",
      apkUrl: "",
      releaseNotes: "",
    });
  });
});

describe("decideGate", () => {
  it("blocks below the minimum", () => {
    expect(decideGate("1.0.0", rel("1.1.0", "1.1.0"), null).status).toBe("blocked");
  });
  it("offers optional update between min and latest", () => {
    expect(decideGate("1.0.0", rel("1.0.0", "1.1.0"), null).status).toBe("optional");
  });
  it("is ok at latest", () => {
    expect(decideGate("1.1.0", rel("1.0.0", "1.1.0"), null).status).toBe("ok");
  });
  it("prefers the network release over the cache", () => {
    expect(
      decideGate("1.0.0", rel("0.0.0", "1.0.0"), rel("2.0.0", "2.0.0")).status,
    ).toBe("ok");
  });
  it("falls back to the cached release when offline", () => {
    expect(decideGate("1.0.0", null, rel("1.1.0", "1.1.0")).status).toBe("blocked");
  });
  it("unblocks once the new build is installed, even from cache", () => {
    expect(decideGate("1.1.0", null, rel("1.1.0", "1.1.0")).status).toBe("ok");
  });
  it("never blocks with no data or an invalid installed version", () => {
    expect(decideGate("1.0.0", null, null).status).toBe("ok");
    expect(decideGate("garbage", rel("9.0.0", "9.0.0"), null).status).toBe("ok");
  });
});
