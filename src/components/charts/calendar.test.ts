import { describe, it, expect } from "vitest";
import { monthGrid, heatLevel, WEEKDAY_SHORT_MON_FIRST } from "./calendar";

const flat = (g: (number | null)[][]) => g.flat().filter((d) => d !== null);

describe("monthGrid", () => {
  it("Oct 2026 starts on Thursday: first row has 3 leading nulls", () => {
    const g = monthGrid(2026, 10);
    expect(g[0].slice(0, 3)).toEqual([null, null, null]);
    expect(g[0][3]).toBe(1);
    expect(flat(g)).toHaveLength(31);
  });

  it("every row has 7 cells and days run 1..N in order", () => {
    const g = monthGrid(2026, 10);
    g.forEach((w) => expect(w).toHaveLength(7));
    expect(flat(g)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("Feb 2028 (leap) has 29 days", () => {
    expect(flat(monthGrid(2028, 2))).toHaveLength(29);
  });

  it("Feb 2027 (non-leap) has 28 days", () => {
    expect(flat(monthGrid(2027, 2))).toHaveLength(28);
  });

  it("a month starting on Monday has no leading nulls (Jun 2026)", () => {
    const g = monthGrid(2026, 6);
    expect(g[0][0]).toBe(1);
  });

  it("a month starting on Sunday has 6 leading nulls (Feb 2026)", () => {
    const g = monthGrid(2026, 2);
    expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(g[0][6]).toBe(1);
  });

  it("trailing row is padded with nulls", () => {
    const g = monthGrid(2026, 10);
    const last = g[g.length - 1];
    expect(last).toHaveLength(7);
    expect(last[last.length - 1]).toBeNull();
  });
});

describe("heatLevel", () => {
  it("is 0 only for a zero value", () => {
    expect(heatLevel(0, 100)).toBe(0);
    expect(heatLevel(0.0001, 100)).toBe(1);
  });
  it("buckets by ceil of quarters", () => {
    expect(heatLevel(25, 100)).toBe(1);
    expect(heatLevel(26, 100)).toBe(2);
    expect(heatLevel(50, 100)).toBe(2);
    expect(heatLevel(51, 100)).toBe(3);
    expect(heatLevel(75, 100)).toBe(3);
    expect(heatLevel(76, 100)).toBe(4);
    expect(heatLevel(100, 100)).toBe(4);
  });
  it("clamps above max and handles bad input", () => {
    expect(heatLevel(500, 100)).toBe(4);
    expect(heatLevel(10, 0)).toBe(0);
    expect(heatLevel(NaN, 100)).toBe(0);
    expect(heatLevel(-5, 100)).toBe(0);
  });
});

describe("WEEKDAY_SHORT_MON_FIRST", () => {
  it("is Monday-first", () => {
    expect(WEEKDAY_SHORT_MON_FIRST).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
});
