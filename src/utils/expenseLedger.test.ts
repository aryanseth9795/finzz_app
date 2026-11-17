import { describe, expect, it } from "vitest";
import { shouldFollowCurrentMonth } from "./expenseLedger";

const ym = (year: number, month: number) => ({ year, month });

describe("shouldFollowCurrentMonth", () => {
  const today = ym(2026, 11);

  describe("active month is not in the past", () => {
    it("stays on the current month", () => {
      expect(shouldFollowCurrentMonth(today, today, null)).toBe(false);
      expect(shouldFollowCurrentMonth(today, today, ym(2026, 10))).toBe(false);
    });

    it("stays on a later month", () => {
      expect(shouldFollowCurrentMonth(ym(2026, 12), today, null)).toBe(false);
    });

    it("treats January of next year as later than December (year boundary)", () => {
      expect(shouldFollowCurrentMonth(ym(2027, 1), ym(2026, 12), null)).toBe(
        false,
      );
    });
  });

  describe("first load since mount (no last-seen month)", () => {
    it("follows the current month from a stale past month", () => {
      expect(shouldFollowCurrentMonth(ym(2026, 10), today, null)).toBe(true);
      expect(shouldFollowCurrentMonth(ym(2026, 3), today, null)).toBe(true);
    });

    it("treats December as earlier than January of next year (year boundary)", () => {
      expect(shouldFollowCurrentMonth(ym(2025, 12), ym(2026, 1), null)).toBe(
        true,
      );
    });
  });

  describe("no rollover since the last load", () => {
    it("keeps the past month the user picked", () => {
      // Pick October → add an entry → back: the focus must not jump to November.
      expect(shouldFollowCurrentMonth(ym(2026, 10), today, today)).toBe(false);
      expect(shouldFollowCurrentMonth(ym(2025, 4), today, today)).toBe(false);
    });

    it("keeps a past December picked in January (year boundary)", () => {
      expect(
        shouldFollowCurrentMonth(ym(2025, 12), ym(2026, 1), ym(2026, 1)),
      ).toBe(false);
    });
  });

  describe("the month rolled over since the last load", () => {
    it("follows when the user was on the month that just ended", () => {
      expect(shouldFollowCurrentMonth(ym(2026, 10), today, ym(2026, 10))).toBe(
        true,
      );
    });

    it("keeps an older month the user picked", () => {
      expect(shouldFollowCurrentMonth(ym(2026, 9), today, ym(2026, 10))).toBe(
        false,
      );
    });

    it("follows from December into January (year boundary)", () => {
      expect(
        shouldFollowCurrentMonth(ym(2025, 12), ym(2026, 1), ym(2025, 12)),
      ).toBe(true);
    });

    it("keeps an older month across the year boundary", () => {
      expect(
        shouldFollowCurrentMonth(ym(2025, 11), ym(2026, 1), ym(2025, 12)),
      ).toBe(false);
    });

    it("compares the year as well as the month", () => {
      // Same month number a year apart is a rollover, not "no change".
      expect(
        shouldFollowCurrentMonth(ym(2025, 11), ym(2026, 11), ym(2025, 11)),
      ).toBe(true);
      // An active month with the last-seen month number but another year stays.
      expect(
        shouldFollowCurrentMonth(ym(2025, 10), today, ym(2026, 10)),
      ).toBe(false);
    });
  });
});
