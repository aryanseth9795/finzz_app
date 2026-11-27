import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chatCardTime } from "./chatList";
import { formatTxDay, toApiDate, txCalendarDay } from "./dates";

/**
 * Inputs are built in LOCAL time and dates go through `toApiDate`, exactly as
 * the App sends them, so every expectation holds in any device timezone.
 *
 * The suite runs once per timezone by setting `process.env.TZ` at runtime
 * (Node applies it immediately). A `TZ=` prefix from Git Bash does NOT reach
 * Node on Windows, so the timezone is set here rather than by the shell.
 * America/New_York is the case that catches a missing `fromApiDate`: there a
 * UTC-midnight date reads as the evening of the day before. Asia/Kolkata and
 * Pacific/Kiritimati catch the opposite mistake on legacy rows (see below).
 *
 * Restoring: on Windows `delete process.env.TZ` does NOT reset the zone (it
 * keeps the last one set), so the machine's own zone is set back explicitly
 * before the variable is removed. Without that, the rest of this process
 * would run in UTC; today only Vitest's per-file isolation hides it.
 */
const ZONES = ["Asia/Kolkata", "America/New_York", "Pacific/Kiritimati", "UTC"];
const ORIGINAL_TZ = process.env.TZ;
const MACHINE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const day = (m: number, d: number, y = 2026) => toApiDate(new Date(y, m - 1, d));
const at = (m: number, d: number, h: number, min: number) =>
  new Date(2026, m - 1, d, h, min).toISOString();
const now = () => new Date(2026, 10, 27, 23, 30); // 27 Nov 2026, 11:30 PM local

describe.each(ZONES)("chat dates in %s (T-033)", (zone) => {
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = MACHINE_ZONE;
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  it("runs in the intended timezone", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toMatch(
      zone === "Asia/Kolkata" ? /Asia\/(Kolkata|Calcutta)/ : zone,
    );
  });

  it("shows when today's transaction was added, not 5:30 AM", () => {
    // The report: added at 11:12 PM, the Home list said 5:30 AM because it
    // formatted the UTC-midnight calendar date as a time.
    const lastTx = { date: day(11, 27), createdAt: at(11, 27, 23, 12) };
    expect(chatCardTime(lastTx, now())).toBe("11:12 PM");
  });

  it("says Today, never a made-up time, for a snapshot without createdAt", () => {
    expect(chatCardTime({ date: day(11, 27) }, now())).toBe("Today");
  });

  it("says Today when the date was moved to today after an earlier add", () => {
    const lastTx = { date: day(11, 27), createdAt: at(11, 24, 15, 0) };
    expect(chatCardTime(lastTx, now())).toBe("Today");
  });

  it("says Today when createdAt is not a valid date", () => {
    expect(chatCardTime({ date: day(11, 27), createdAt: "nope" }, now())).toBe(
      "Today",
    );
  });

  it("says Yesterday for yesterday's date", () => {
    const lastTx = { date: day(11, 26), createdAt: at(11, 26, 23, 59) };
    expect(chatCardTime(lastTx, now())).toBe("Yesterday");
  });

  it("labels by the transaction's date, which is what the list sorts by", () => {
    // Backdated to 20 Nov but added today: the card shows 20 Nov.
    const lastTx = { date: day(11, 20), createdAt: at(11, 27, 23, 12) };
    expect(chatCardTime(lastTx, now())).toBe("20 Nov");
  });

  it("adds the year for an earlier year", () => {
    expect(chatCardTime({ date: day(11, 20, 2025) }, now())).toBe("20/11/25");
  });

  it("is empty without a usable date", () => {
    expect(chatCardTime(undefined, now())).toBe("");
    expect(chatCardTime({ date: "" }, now())).toBe("");
    expect(chatCardTime({ date: "not a date" }, now())).toBe("");
  });

  /**
   * Legacy rows: builds before f54cd99 (2026-08-20) sent
   * `new Date().toISOString()`, the moment of entry, not UTC midnight.
   * `fromApiDate` reads the UTC day, so in IST an entry made 00:00–05:29
   * would show the day before. `txCalendarDay` reads such a value as a
   * moment in local time and only UTC midnight as a calendar day.
   */
  it("reads a legacy moment as its local day", () => {
    const legacy = at(8, 1, 2, 0); // entered 1 Aug, 2:00 AM local
    expect(txCalendarDay(legacy)).toEqual(new Date(2026, 7, 1));
    expect(formatTxDay(legacy, "DD/MM/YY")).toBe("01/08/26");
  });

  it("reads a UTC-midnight date as the picked day", () => {
    expect(txCalendarDay(day(11, 27))).toEqual(new Date(2026, 10, 27));
    expect(formatTxDay(day(11, 27), "DD/MM/YY")).toBe("27/11/26");
  });

  it("formats a missing or invalid tx date as a dash", () => {
    expect(formatTxDay(undefined, "DD/MM/YY")).toBe("—");
    expect(formatTxDay("", "DD/MM/YY")).toBe("—");
    expect(formatTxDay("not a date", "DD/MM/YY")).toBe("—");
  });

  it("labels a chat whose last transaction is a legacy row by its local day", () => {
    expect(chatCardTime({ date: at(8, 1, 2, 0) }, now())).toBe("01 Aug");
  });
});
