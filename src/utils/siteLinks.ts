/**
 * Opening website pages with a fallback host. No network happens until the
 * user taps a link (zero-extra-cost rule). RN is required lazily so the pure
 * helpers stay importable from vitest (node).
 */
import { SITE_ORIGINS } from "../constants/links";

export type Probe = (url: string, signal?: AbortSignal) => Promise<boolean>;

export const siteUrlCandidates = (path: string): string[] => {
  if (!path.startsWith("/")) throw new Error("Site path must start with /");
  return SITE_ORIGINS.map((origin) => `${origin}${path}`);
};

/**
 * First candidate whose probe resolves true within timeoutMs, else the PRIMARY.
 * Not the last: the fallback origin (aryantechie.in) lapses in Dec 2026, and a
 * phone that never takes a later OTA must not be sent to an expired domain
 * just because it was offline.
 */
export const pickReachableUrl = async (
  candidates: readonly string[],
  probe: Probe,
  timeoutMs = 4000,
): Promise<string> => {
  for (const url of candidates) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(false);
        }, timeoutMs);
      });
      if (await Promise.race([probe(url, controller.signal).catch(() => false), timeout])) {
        return url;
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return candidates[0];
};

export const headProbe: Probe = async (url, signal) => {
  const res = await fetch(url, { method: "HEAD", signal });
  return res.status >= 200 && res.status < 400;
};

/**
 * Opener with one probe at a time: taps while a probe runs (up to 4 s per
 * host) are ignored, so a double tap opens one browser tab, and a failure to
 * open never becomes an unhandled rejection.
 */
export const createSiteOpener = (
  probe: Probe,
  open: (url: string) => Promise<void>,
): ((path: string) => Promise<void>) => {
  let busy = false;
  return async (path: string) => {
    if (busy) return;
    busy = true;
    try {
      await open(await pickReachableUrl(siteUrlCandidates(path), probe));
    } catch (e) {
      console.warn("[siteLinks] could not open", path, e);
    } finally {
      busy = false;
    }
  };
};

export const openSitePage = createSiteOpener(headProbe, async (url) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Linking } = require("react-native");
  await Linking.openURL(url);
});
