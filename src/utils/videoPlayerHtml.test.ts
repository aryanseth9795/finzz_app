import { describe, it, expect } from "vitest";
import { buildVideoHtml, isAllowedVideoRequest } from "./videoPlayerHtml";

const OK = "https://finzz.aryantechie.in/videos/finzz-v1-friends-pools-9x16.mp4";

const NEW = "https://finzz.aryanseth.in/videos/finzz-v1-friends-pools-9x16.mp4";

describe("both site origins", () => {
  it("builds html for the primary and the fallback host", () => {
    expect(buildVideoHtml(NEW)).toContain(`src="${NEW}"`);
    expect(buildVideoHtml(OK)).toContain(`src="${OK}"`);
  });
  it("allows each host's base url for its own video", () => {
    expect(isAllowedVideoRequest("https://finzz.aryanseth.in", NEW)).toBe(true);
    expect(isAllowedVideoRequest("https://finzz.aryanseth.in/", NEW)).toBe(true);
    expect(isAllowedVideoRequest(NEW, NEW)).toBe(true);
  });
  it.each([
    "https://finzz.aryanseth.in.evil.com/videos/a.mp4",
    "https://aryanseth.in/videos/a.mp4",
    "http://finzz.aryanseth.in/videos/a.mp4",
    "https://finzz.aryanseth.in@evil.com/videos/a.mp4",
    "https://finzz.aryanseth.in/videos/a.mp4?x=1",
  ])("rejects lookalike %j", (bad) => {
    expect(() => buildVideoHtml(bad)).toThrow();
    expect(isAllowedVideoRequest(bad, NEW)).toBe(false);
  });
  it("refuses other videos on either host", () => {
    expect(isAllowedVideoRequest("https://finzz.aryanseth.in/videos/other.mp4", NEW)).toBe(false);
    expect(isAllowedVideoRequest("https://finzz.aryanseth.in/privacy", NEW)).toBe(false);
  });
});

describe("buildVideoHtml", () => {
  it("builds a locked-down single-video document", () => {
    const html = buildVideoHtml(OK);
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).toContain("playsinline");
    expect(html).toContain('preload="metadata"');
    expect(html).toContain("autoplay");
    expect(html).toContain('controlsList="nodownload"');
    expect(html).toContain("object-fit:contain");
    expect(html).toContain(`src="${OK}"`);
    expect(html.match(/<video/g)).toHaveLength(1);
  });

  it("posts error / playing / ended to React Native", () => {
    const html = buildVideoHtml(OK);
    expect(html).toContain("ReactNativeWebView.postMessage");
    for (const t of ["error", "playing", "ended"]) {
      expect(html).toContain(`"${t}"`);
    }
  });

  it("accepts a jpeg data-uri poster and rejects other posters", () => {
    const poster = "data:image/jpeg;base64,/9j/4AAQ=";
    expect(buildVideoHtml(OK, { posterDataUri: poster })).toContain(`poster="${poster}"`);
    expect(() => buildVideoHtml(OK, { posterDataUri: 'x" onerror="1' })).toThrow();
    expect(() => buildVideoHtml(OK, { posterDataUri: "https://evil.com/a.jpg" })).toThrow();
  });

  it.each([
    "javascript:alert(1)",
    "http://finzz.aryantechie.in/videos/a.mp4",
    "https://evil.com/videos/a.mp4",
    "https://finzz.aryantechie.in.evil.com/videos/a.mp4",
    "https://finzz.aryantechie.in/videos/../secret.mp4",
    "https://finzz.aryantechie.in/videos/a.mp4\"><script>alert(1)</script>",
    'https://finzz.aryantechie.in/videos/a".mp4',
    "https://finzz.aryantechie.in/videos/a.mp4?x=1",
    "https://finzz.aryantechie.in/videos/a.mp4#x",
    "https://finzz.aryantechie.in/videos/a.mp4\n",
    "https://finzz.aryantechie.in/videos/sub/a.mp4",
    "https://finzz.aryantechie.in/videos/.mp4",
    "https://finzz.aryantechie.in@evil.com/videos/a.mp4",
    "",
  ])("throws for %j", (bad) => {
    expect(() => buildVideoHtml(bad)).toThrow();
  });
});

describe("isAllowedVideoRequest", () => {
  it("allows about:blank, about:srcdoc and the exact video url", () => {
    expect(isAllowedVideoRequest("about:blank", OK)).toBe(true);
    expect(isAllowedVideoRequest("about:srcdoc", OK)).toBe(true);
    expect(isAllowedVideoRequest(OK, OK)).toBe(true);
  });

  it("allows the initial html document (base url / data uri)", () => {
    expect(isAllowedVideoRequest("https://finzz.aryantechie.in", OK)).toBe(true);
    expect(isAllowedVideoRequest("https://finzz.aryantechie.in/", OK)).toBe(true);
  });

  it("refuses everything else", () => {
    for (const u of [
      "https://finzz.aryantechie.in/videos/other.mp4",
      "https://finzz.aryantechie.in/privacy",
      "https://evil.com/",
      "http://finzz.aryantechie.in/videos/finzz-v1-friends-pools-9x16.mp4",
      OK + "?x=1",
      OK + "#t=5",
      "javascript:alert(1)",
      "intent://x#Intent;end",
      "market://details?id=a",
      "data:text/html,hi",
      "file:///etc/passwd",
      "",
    ]) {
      expect(isAllowedVideoRequest(u, OK)).toBe(false);
    }
  });
});

describe("buildVideoHtml liveness (review R6)", () => {
  it("reports loadedmetadata, so a slow but working host isn't abandoned at the timeout", () => {
    const html = buildVideoHtml("https://finzz.aryanseth.in/videos/finzz-teaser-9x16.mp4");
    expect(html).toContain('addEventListener("loadedmetadata"');
  });
});
