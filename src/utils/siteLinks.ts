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

/** First candidate whose probe resolves true within timeoutMs, else the last one. */
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
  return candidates[candidates.length - 1];
};

export const headProbe: Probe = async (url, signal) => {
  const res = await fetch(url, { method: "HEAD", signal });
  return res.status >= 200 && res.status < 400;
};

export const openSitePage = async (path: string): Promise<void> => {
  const url = await pickReachableUrl(siteUrlCandidates(path), headProbe);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Linking } = require("react-native");
  await Linking.openURL(url);
};
