import { describe, it, expect } from "vitest";
import { polarToCartesian, describeArc, donutSegments } from "./arc";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 4);

describe("polarToCartesian", () => {
  it("0 degrees points to 12 o'clock", () => {
    const p = polarToCartesian(100, 100, 50, 0);
    close(p.x, 100);
    close(p.y, 50);
  });
  it("90 degrees points to 3 o'clock", () => {
    const p = polarToCartesian(100, 100, 50, 90);
    close(p.x, 150);
    close(p.y, 100);
  });
  it("180 degrees points to 6 o'clock", () => {
    const p = polarToCartesian(100, 100, 50, 180);
    close(p.x, 100);
    close(p.y, 150);
  });
});

describe("describeArc", () => {
  it("starts and ends at the right points", () => {
    const d = describeArc(100, 100, 50, 0, 90);
    expect(d.startsWith("M 100.000 50.000")).toBe(true);
    expect(d).toContain("A 50 50 0 0 1 150.000 100.000");
  });
  it("uses the large-arc flag past 180 degrees", () => {
    expect(describeArc(100, 100, 50, 0, 270)).toContain("A 50 50 0 1 1");
  });
  it("caps a full sweep at 359.99", () => {
    const d = describeArc(100, 100, 50, 0, 360);
    const end = polarToCartesian(100, 100, 50, 359.99);
    expect(d).toContain(`${end.x.toFixed(3)} ${end.y.toFixed(3)}`);
    expect(d).toContain("A 50 50 0 1 1");
  });
});

describe("donutSegments", () => {
  it("shares sum to 1 and arcs span the circle minus gaps", () => {
    const s = donutSegments([1, 2, 1], 2);
    expect(s).toHaveLength(3);
    close(s.reduce((a, b) => a + b.share, 0), 1);
    close(s[1].share, 0.5);
    expect(s[0].start).toBeGreaterThanOrEqual(0);
    expect(s[2].end).toBeLessThanOrEqual(360);
  });
  it("skips zero values", () => {
    const s = donutSegments([0, 5, 0, 5]);
    expect(s).toHaveLength(2);
    expect(s.map((x) => x.value)).toEqual([5, 5]);
  });
  it("returns [] when total is 0", () => {
    expect(donutSegments([0, 0])).toEqual([]);
    expect(donutSegments([])).toEqual([]);
  });
  it("single segment fills the circle", () => {
    const s = donutSegments([7]);
    expect(s).toHaveLength(1);
    close(s[0].share, 1);
    expect(s[0].end - s[0].start).toBeGreaterThan(359);
  });
});
