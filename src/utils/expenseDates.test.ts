import { describe, expect, it } from "vitest";
import {
  EXPENSE_MIN_DATE,
  closedLedgerFor,
  defaultExpenseDate,
  expensePickerMinimumDate,
} from "./dates";

type Ledger = { year: number; month: number; status: "open" | "closed" };

const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe("EXPENSE_MIN_DATE", () => {
  it("is local 1 Jan 2000", () => {
    expect(ymd(EXPENSE_MIN_DATE)).toEqual([2000, 1, 1]);
    expect(EXPENSE_MIN_DATE.getHours()).toBe(0);
  });
});

describe("expensePickerMinimumDate", () => {
  it("is local 1 Jan 2000 with no existing date", () => {
    const d = expensePickerMinimumDate();
    expect(ymd(d)).toEqual([2000, 1, 1]);
    expect(d.getHours()).toBe(0);
    expect(expensePickerMinimumDate(null).getTime()).toBe(
      new Date(2000, 0, 1).getTime(),
    );
  });

  it("includes an edited date older than 2000 (APP-009)", () => {
    const d = expensePickerMinimumDate("1999-12-31T00:00:00.000Z");
    expect(ymd(d)).toEqual([1999, 12, 31]);
    expect(d.getHours()).toBe(0);
  });

  it("stays 1 Jan 2000 for a recent edited date", () => {
    const d = expensePickerMinimumDate("2026-10-15T00:00:00.000Z");
    expect(ymd(d)).toEqual([2000, 1, 1]);
    const fromDate = expensePickerMinimumDate(new Date(Date.UTC(2026, 9, 15)));
    expect(ymd(fromDate)).toEqual([2000, 1, 1]);
  });

  it("returns a fresh Date each call", () => {
    const first = expensePickerMinimumDate();
    first.setFullYear(2020);
    expect(ymd(expensePickerMinimumDate())).toEqual([2000, 1, 1]);
    expect(ymd(EXPENSE_MIN_DATE)).toEqual([2000, 1, 1]);
    expect(expensePickerMinimumDate()).not.toBe(expensePickerMinimumDate());
  });
});

describe("closedLedgerFor", () => {
  const ledgers: Ledger[] = [
    { year: 2026, month: 9, status: "open" },
    { year: 2026, month: 10, status: "closed" },
    { year: 2025, month: 12, status: "closed" },
  ];

  it("returns the closed ledger for the picked month", () => {
    expect(closedLedgerFor(new Date(2026, 9, 15), ledgers)).toBe(ledgers[1]);
    expect(closedLedgerFor(new Date(2025, 11, 31), ledgers)).toBe(ledgers[2]);
  });

  it("returns null for an open ledger", () => {
    expect(closedLedgerFor(new Date(2026, 8, 3), ledgers)).toBeNull();
  });

  it("returns null when there is no ledger for that month", () => {
    expect(closedLedgerFor(new Date(2026, 6, 3), ledgers)).toBeNull();
    expect(closedLedgerFor(new Date(2026, 9, 15), [])).toBeNull();
  });

  it("respects the month boundary (1 Nov when only Oct is closed)", () => {
    expect(closedLedgerFor(new Date(2026, 10, 1), ledgers)).toBeNull();
    expect(closedLedgerFor(new Date(2026, 9, 31, 23, 59), ledgers)).toBe(
      ledgers[1],
    );
  });

  it("does not match the same month in a different year", () => {
    expect(closedLedgerFor(new Date(2025, 9, 15), ledgers)).toBeNull();
  });

  it("returns an object with extra fields as-is", () => {
    const rich = [
      { _id: "abc", year: 2026, month: 10, status: "closed" as const, note: "x" },
    ];
    const found = closedLedgerFor(new Date(2026, 9, 1), rich);
    expect(found).toBe(rich[0]);
    expect(found?._id).toBe("abc");
  });
});

describe("defaultExpenseDate", () => {
  const now = new Date(2026, 10, 1, 14, 30, 5);

  it("returns now with no period", () => {
    expect(defaultExpenseDate(undefined, now).getTime()).toBe(now.getTime());
    expect(defaultExpenseDate(null, now).getTime()).toBe(now.getTime());
  });

  it("returns a copy of now, not the same object", () => {
    const d = defaultExpenseDate(null, now);
    expect(d).not.toBe(now);
    d.setFullYear(1990);
    expect(now.getFullYear()).toBe(2026);
  });

  it("returns now for the current month", () => {
    const d = defaultExpenseDate({ year: 2026, month: 11 }, now);
    expect(d.getTime()).toBe(now.getTime());
    expect(d).not.toBe(now);
  });

  it("returns local last day of a past month at 00:00", () => {
    const d = defaultExpenseDate({ year: 2026, month: 10 }, now);
    expect(ymd(d)).toEqual([2026, 10, 31]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
    expect(d.getTime()).toBe(new Date(2026, 9, 31).getTime());
  });

  it("handles leap February", () => {
    const d = defaultExpenseDate(
      { year: 2028, month: 2 },
      new Date(2028, 5, 10),
    );
    expect(ymd(d)).toEqual([2028, 2, 29]);
  });

  it("handles a past December across a year boundary", () => {
    const d = defaultExpenseDate(
      { year: 2025, month: 12 },
      new Date(2026, 0, 5, 9, 0),
    );
    expect(ymd(d)).toEqual([2025, 12, 31]);
  });

  it("returns now for a future period", () => {
    expect(defaultExpenseDate({ year: 2026, month: 12 }, now).getTime()).toBe(
      now.getTime(),
    );
    expect(defaultExpenseDate({ year: 2027, month: 1 }, now).getTime()).toBe(
      now.getTime(),
    );
  });

  it("defaults now to the real clock", () => {
    const before = Date.now();
    const d = defaultExpenseDate();
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
    expect(d.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
