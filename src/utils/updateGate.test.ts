import { describe, it, expect, vi } from "vitest";
import { withTimeout } from "./async";
import { nextOptionalPrompt, type AppRelease } from "./version";

// If appApi imports the authenticated axios instance, this mock makes the
// import throw — the version check must never reach the 401/logout interceptor.
vi.mock("../api/axios", () => {
  throw new Error("appApi must not use the authenticated axios instance");
});

const rel = (latest: string): AppRelease => ({
  latestVersion: latest,
  minSupportedVersion: "1.0.0",
  apkUrl: "https://x/finzz.apk",
  releaseNotes: "",
});

describe("getAppVersionApi", () => {
  it("does not go through the authenticated axios instance", async () => {
    await expect(import("../api/appApi")).resolves.toHaveProperty("getAppVersionApi");
  });
});

describe("withTimeout", () => {
  it("resolves with the fallback when the promise hangs", async () => {
    const never = new Promise<string>(() => undefined);
    await expect(withTimeout(never, 10, "fallback")).resolves.toBe("fallback");
  });
  it("resolves with the value when it arrives in time", async () => {
    await expect(withTimeout(Promise.resolve("v"), 1000, "fallback")).resolves.toBe("v");
  });
});

describe("nextOptionalPrompt", () => {
  it("prompts for an optional version not yet shown or dismissed", () => {
    expect(nextOptionalPrompt("optional", rel("1.1.0"), null, false)).toBe("1.1.0");
  });
  it("does not re-prompt the same version when the release object is refetched", () => {
    expect(nextOptionalPrompt("optional", rel("1.1.0"), "1.1.0", false)).toBeNull();
  });
  it("prompts again for a newer version", () => {
    expect(nextOptionalPrompt("optional", rel("1.2.0"), "1.1.0", false)).toBe("1.2.0");
  });
  it("never prompts when dismissed or not optional", () => {
    expect(nextOptionalPrompt("optional", rel("1.1.0"), null, true)).toBeNull();
    expect(nextOptionalPrompt("ok", rel("1.1.0"), null, false)).toBeNull();
    expect(nextOptionalPrompt("blocked", rel("1.1.0"), null, false)).toBeNull();
  });
});
