import { describe, it, expect } from "vitest";
import { darkColors, lightColors } from "../constants/theme";
import {
  contrastRatio,
  hexToRgb,
  relativeLuminance,
  withAlpha,
} from "./chartPalette";

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("chartPalette helpers", () => {
  it("hexToRgb parses 6-digit hex", () => {
    expect(hexToRgb("#6366F1")).toEqual({ r: 99, g: 102, b: 241 });
  });

  it("black vs white contrast is 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("relativeLuminance of white is 1 and black is 0", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("contrastRatio is symmetric", () => {
    expect(contrastRatio("#6366F1", "#FFFFFF")).toBeCloseTo(
      contrastRatio("#FFFFFF", "#6366F1"),
      10,
    );
  });

  it("withAlpha appends a 2-digit alpha suffix", () => {
    expect(withAlpha("#6366F1", 0.5)).toBe("#6366F180");
    expect(withAlpha("#6366F1", 1)).toBe("#6366F1FF");
    expect(withAlpha("#6366F1", 0)).toBe("#6366F100");
  });
});

const themes = [
  ["light", lightColors],
  ["dark", darkColors],
] as const;

describe.each(themes)("chart tokens (%s)", (_name, colors) => {
  const c = colors.chart;
  const surface = colors.surface;

  it("has 8 categorical colours that are distinct", () => {
    expect(c.categorical).toHaveLength(8);
    expect(new Set(c.categorical.map((h) => h.toUpperCase())).size).toBe(8);
  });

  it("has 5 heat steps", () => {
    expect(c.heat).toHaveLength(5);
  });

  it("all tokens are valid 6-digit hex", () => {
    const all = [
      ...c.categorical,
      ...c.heat,
      c.spend,
      c.spendSoft,
      c.income,
      c.incomeSoft,
      c.grid,
      c.axis,
      c.track,
      c.positive,
      c.negative,
    ];
    for (const h of all) expect(h).toMatch(HEX);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7])(
    "categorical[%i] has >= 3.0 contrast against surface",
    (i) => {
      expect(contrastRatio(c.categorical[i], surface)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(["spend", "income", "positive", "negative"] as const)(
    "%s has >= 3.0 contrast against surface",
    (key) => {
      expect(contrastRatio(c[key], surface)).toBeGreaterThanOrEqual(3);
    },
  );

  it("axis has >= 4.5 contrast against surface", () => {
    expect(contrastRatio(c.axis, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
