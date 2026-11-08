/** Play Store link helpers. Pure: no react-native import. */

export const PLAY_PACKAGE = "com.aryanseth9795.finzz";

const PLAY_HTTPS =
  /^https:\/\/play\.google\.com\/store\/apps\/details\?(?:[^#\s]*&)?id=([A-Za-z0-9_.]+)(?:[&#]|$)/;
const PLAY_MARKET =
  /^market:\/\/details\?(?:[^#\s]*&)?id=([A-Za-z0-9_.]+)(?:[&#]|$)/;

const packageOf = (url: unknown): string | null => {
  if (typeof url !== "string") return null;
  const m = PLAY_HTTPS.exec(url) ?? PLAY_MARKET.exec(url);
  return m ? m[1] : null;
};

export const isPlayStoreUrl = (url: unknown): boolean => packageOf(url) !== null;

/** Play https or market URL -> `market://details?id=<pkg>`; anything else -> null. */
export const toMarketUrl = (url: unknown): string | null => {
  const pkg = packageOf(url);
  return pkg ? `market://details?id=${pkg}` : null;
};
