import { describe, expect, it } from "vitest";
import { zeroFillTrend } from "../../utils/expenseInsights";
import {
  MIN_TREND_SLOT,
  monthLabelParts,
  trendSlot,
  trendTooltipLeft,
} from "./trendLayout";

describe("trendSlot", () => {
  it("scrolls with fixed 44-pt columns when 12 months would be squeezed", () => {
    expect(trendSlot(280, 12)).toEqual({
      slot: 44,
      scroll: true,
      contentWidth: 12 * 44,
    });
  });

  it("keeps the full-width layout when every column gets at least 44 pt", () => {
    const r = trendSlot(700, 12);
    expect(r.scroll).toBe(false);
    expect(r.slot).toBeCloseTo(700 / 12);
    expect(r.contentWidth).toBe(700);
  });

  it("does not scroll at exactly the minimum slot", () => {
    expect(trendSlot(528, 12)).toEqual({ slot: 44, scroll: false, contentWidth: 528 });
  });

  it("scrolls one point below the minimum slot", () => {
    expect(trendSlot(527, 12)).toEqual({ slot: 44, scroll: true, contentWidth: 528 });
  });

  it("honours a custom minimum slot", () => {
    expect(trendSlot(280, 12, 20)).toEqual({ slot: 280 / 12, scroll: false, contentWidth: 280 });
    expect(trendSlot(280, 12, 30)).toEqual({ slot: 30, scroll: true, contentWidth: 360 });
  });

  it("defaults the minimum slot to 44", () => {
    expect(MIN_TREND_SLOT).toBe(44);
  });

  it("is inert for no columns or no measured width", () => {
    expect(trendSlot(280, 0)).toEqual({ slot: 0, scroll: false, contentWidth: 280 });
    expect(trendSlot(0, 12)).toEqual({ slot: 0, scroll: false, contentWidth: 0 });
    expect(trendSlot(Number.NaN, 12)).toEqual({ slot: 0, scroll: false, contentWidth: 0 });
    expect(trendSlot(-10, 12)).toEqual({ slot: 0, scroll: false, contentWidth: 0 });
    expect(trendSlot(280, Number.NaN)).toEqual({ slot: 0, scroll: false, contentWidth: 280 });
  });
});

describe("monthLabelParts", () => {
  it("splits the TrendSection labels and shows the year only at the start and at a change", () => {
    // Selected Oct 2026 -> Nov '25 ... Oct (the selected year has no suffix).
    const labels = zeroFillTrend([], { year: 2026, month: 10 }).map((t) => t.label);
    expect(labels[0]).toBe("Nov '25");
    expect(labels[2]).toBe("Jan");

    const parts = monthLabelParts(labels);
    expect(parts.map((p) => p.month)).toEqual([
      "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct",
    ]);
    expect(parts.map((p) => p.year)).toEqual([
      "'25", null, "'26", null, null, null, null, null, null, null, null, null,
    ]);
  });

  it("puts the new year on the January column when the selection is January", () => {
    const labels = zeroFillTrend([], { year: 2026, month: 1 }).map((t) => t.label);
    const parts = monthLabelParts(labels);
    expect(parts[0]).toEqual({ month: "Feb", year: "'25" });
    expect(parts.slice(1, 11).every((p) => p.year === null)).toBe(true);
    expect(parts[11]).toEqual({ month: "Jan", year: "'26" });
  });

  it("shows no year when no label carries one (all twelve in the selected year)", () => {
    const labels = zeroFillTrend([], { year: 2026, month: 12 }).map((t) => t.label);
    const parts = monthLabelParts(labels);
    expect(parts.map((p) => p.month)[0]).toBe("Jan");
    expect(parts.map((p) => p.month)[11]).toBe("Dec");
    expect(parts.every((p) => p.year === null)).toBe(true);
  });

  it("accepts {year, month} items", () => {
    const parts = monthLabelParts([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
    expect(parts).toEqual([
      { month: "Nov", year: "'25" },
      { month: "Dec", year: null },
      { month: "Jan", year: "'26" },
      { month: "Feb", year: null },
    ]);
  });

  it("reads four-digit years and curly apostrophes", () => {
    expect(monthLabelParts(["Nov 2025", "Dec 2025", "Jan 2026"])).toEqual([
      { month: "Nov", year: "'25" },
      { month: "Dec", year: null },
      { month: "Jan", year: "'26" },
    ]);
    expect(monthLabelParts(["Dec ’25", "Jan"])).toEqual([
      { month: "Dec", year: "'25" },
      { month: "Jan", year: "'26" },
    ]);
  });

  it("normalises long and dotted month names to the short form", () => {
    expect(monthLabelParts(["Sept '25", "October 2025", "nov."])).toEqual([
      { month: "Sep", year: "'25" },
      { month: "Oct", year: null },
      { month: "Nov", year: null },
    ]);
  });

  it("infers earlier years backwards from a later explicit year", () => {
    expect(monthLabelParts(["Nov", "Dec", "Jan '26"])).toEqual([
      { month: "Nov", year: "'25" },
      { month: "Dec", year: null },
      { month: "Jan", year: "'26" },
    ]);
  });

  it("wraps the century", () => {
    expect(monthLabelParts(["Dec '99", "Jan"])).toEqual([
      { month: "Dec", year: "'99" },
      { month: "Jan", year: "'00" },
    ]);
  });

  it("passes non-month labels through untouched with no year", () => {
    expect(monthLabelParts(["Q1", "  Week 2 ", "Mayor", "Ma"])).toEqual([
      { month: "Q1", year: null },
      { month: "Week 2", year: null },
      { month: "Mayor", year: null },
      { month: "Ma", year: null },
    ]);
  });

  it("returns an empty list for no labels", () => {
    expect(monthLabelParts([])).toEqual([]);
  });
});

describe("trendTooltipLeft", () => {
  const base = { slot: 44, tipWidth: 132, contentWidth: 528 };

  it("centres the tooltip on its column", () => {
    // Column 5 centre = 5 * 44 + 22 = 242.
    expect(trendTooltipLeft({ ...base, index: 5 })).toBe(242 - 66);
  });

  it("clamps to the start and end of the content", () => {
    expect(trendTooltipLeft({ ...base, index: 0 })).toBe(0);
    expect(trendTooltipLeft({ ...base, index: 11 })).toBe(528 - 132);
  });

  it("keeps the tooltip inside the visible part of a scrolled chart", () => {
    // Viewport shows content x 248..528 (scrolled to the end, 280 wide).
    const view = { viewStart: 248, viewWidth: 280 };
    // Column 6 (centre 286) would start at 220, left of the viewport.
    expect(trendTooltipLeft({ ...base, ...view, index: 6 })).toBe(248);
    // Column 8 (centre 374) fits as-is.
    expect(trendTooltipLeft({ ...base, ...view, index: 8 })).toBe(374 - 66);
    // Column 11 is clamped to the content end, which is also the viewport end.
    expect(trendTooltipLeft({ ...base, ...view, index: 11 })).toBe(528 - 132);
  });

  it("pins to the viewport start when the viewport is narrower than the tooltip", () => {
    expect(
      trendTooltipLeft({ ...base, index: 6, viewStart: 100, viewWidth: 80 }),
    ).toBe(100);
  });

  it("ignores over-scroll offsets outside the content", () => {
    expect(trendTooltipLeft({ ...base, index: 0, viewStart: -30, viewWidth: 280 })).toBe(0);
    expect(trendTooltipLeft({ ...base, index: 11, viewStart: 300, viewWidth: 280 })).toBe(528 - 132);
  });

  it("matches the old full-width formula when nothing scrolls", () => {
    const width = 700;
    const slot = width / 12;
    for (let i = 0; i < 12; i++) {
      const old = Math.min(
        Math.max(0, slot * i + slot / 2 - 132 / 2),
        Math.max(0, width - 132),
      );
      expect(
        trendTooltipLeft({ index: i, slot, tipWidth: 132, contentWidth: width }),
      ).toBeCloseTo(old);
    }
  });
});
