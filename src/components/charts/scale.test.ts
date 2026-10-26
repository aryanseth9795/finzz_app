import { describe, expect, it } from "vitest";
import {
  areaPath,
  formatAxisAmount,
  linearScale,
  linePath,
  niceMax,
  smoothPath,
} from "./scale";

describe("linearScale", () => {
  it("maps domain to range linearly", () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });
  it("supports inverted ranges (SVG y axis)", () => {
    const s = linearScale([0, 100], [200, 0]);
    expect(s(0)).toBe(200);
    expect(s(100)).toBe(0);
    expect(s(25)).toBe(150);
  });
  it("maps a degenerate domain to the range midpoint", () => {
    const s = linearScale([5, 5], [0, 100]);
    expect(s(5)).toBe(50);
    expect(s(99)).toBe(50);
  });
});

describe("niceMax", () => {
  const table: [number, number][] = [
    [0, 1],
    [-5, 1],
    [NaN, 1],
    [1, 1],
    [0.3, 0.3],
    [7, 8],
    [85, 100],
    [850, 1000],
    [1000, 1000],
    [1234, 1500],
    [1500, 1500],
    [1501, 2000],
    [23456, 25000],
    [99999, 100000],
    [1234567, 1500000],
  ];
  it.each(table)("niceMax(%s) = %s", (input, expected) => {
    expect(niceMax(input)).toBeCloseTo(expected, 6);
  });
  it("never returns less than the input", () => {
    for (const n of [0.7, 3.2, 17, 99, 101, 4321, 98765]) {
      expect(niceMax(n)).toBeGreaterThanOrEqual(n);
    }
  });
});

describe("linePath", () => {
  it("builds M…L… paths", () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 5, y: 20 },
        { x: 10, y: 5.5 },
      ]),
    ).toBe("M0,10L5,20L10,5.5");
  });
  it("handles empty and single point", () => {
    expect(linePath([])).toBe("");
    expect(linePath([{ x: 1, y: 2 }])).toBe("M1,2");
  });
  it("rounds to 2 decimals", () => {
    expect(linePath([{ x: 1 / 3, y: 2 / 3 }])).toBe("M0.33,0.67");
  });
});

describe("areaPath", () => {
  it("closes down to the baseline", () => {
    expect(
      areaPath(
        [
          { x: 0, y: 10 },
          { x: 5, y: 20 },
        ],
        30,
      ),
    ).toBe("M0,30L0,10L5,20L5,30Z");
  });
  it("returns empty for no points", () => {
    expect(areaPath([], 30)).toBe("");
  });
});

describe("smoothPath", () => {
  const pts = [
    { x: 0, y: 100 },
    { x: 10, y: 60 },
    { x: 20, y: 60 },
    { x: 30, y: 20 },
    { x: 40, y: 25 },
  ];
  it("has no NaN and passes through every point", () => {
    const d = smoothPath(pts);
    expect(d).not.toContain("NaN");
    expect(d.startsWith("M0,100")).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    // every point must appear as an (x,y) pair
    const pairs: string[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pairs.push(`${nums[i]},${nums[i + 1]}`);
    for (const p of pts) expect(pairs).toContain(`${p.x},${p.y}`);
  });
  it("does not overshoot the data range (monotone)", () => {
    const d = smoothPath(pts);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 1; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(nums[i]).toBeLessThanOrEqual(100 + 1e-9);
    }
  });
  it("handles degenerate inputs", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 1, y: 2 }])).toBe("M1,2");
    expect(smoothPath([{ x: 0, y: 0 }, { x: 4, y: 4 }])).toBe("M0,0L4,4");
    expect(smoothPath([{ x: 0, y: 5 }, { x: 0, y: 5 }, { x: 0, y: 5 }])).not.toContain("NaN");
  });
});

describe("formatAxisAmount", () => {
  const table: [number, string][] = [
    [0, "₹0"],
    [850, "₹850"],
    [999, "₹999"],
    [1000, "₹1K"],
    [1200, "₹1.2K"],
    [85000, "₹85K"],
    [99990, "₹1L"],
    [100000, "₹1L"],
    [340000, "₹3.4L"],
    [9999999, "₹1Cr"],
    [11000000, "₹1.1Cr"],
    [250000000, "₹25Cr"],
    [-1200, "-₹1.2K"],
  ];
  it.each(table)("formatAxisAmount(%s) = %s", (input, expected) => {
    expect(formatAxisAmount(input)).toBe(expected);
  });
});
