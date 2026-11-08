import { describe, it, expect } from "vitest";
import { PLAY_PACKAGE, isPlayStoreUrl, toMarketUrl } from "./storeLink";

const P = PLAY_PACKAGE;
const MARKET = `market://details?id=${P}`;
const cases: [string, unknown, boolean, string | null][] = [
  ["https id only", `https://play.google.com/store/apps/details?id=${P}`, true, MARKET],
  ["hl after id", `https://play.google.com/store/apps/details?id=${P}&hl=en`, true, MARKET],
  ["hl before id", `https://play.google.com/store/apps/details?hl=en&id=${P}`, true, MARKET],
  ["market", `market://details?id=${P}`, true, MARKET],
  ["market with extras", `market://details?id=${P}&referrer=x`, true, MARKET],
  ["github apk", "https://github.com/x/y/releases/download/v1/finzz.apk", false, null],
  ["empty", "", false, null],
  ["null", null, false, null],
  ["number", 5, false, null],
  ["http", `http://play.google.com/store/apps/details?id=${P}`, false, null],
  ["lookalike host", `https://play.google.com.evil.com/store/apps/details?id=${P}`, false, null],
  ["no id", "https://play.google.com/store/apps/details?hl=en", false, null],
];

describe("isPlayStoreUrl", () => {
  it.each(cases)("%s", (_n, url, play) => {
    expect(isPlayStoreUrl(url)).toBe(play);
  });
});

describe("toMarketUrl", () => {
  it.each(cases)("%s", (_n, url, _play, market) => {
    expect(toMarketUrl(url)).toBe(market);
  });
});
