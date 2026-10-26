/**
 * Pure helpers for the SVG charts. No React / react-native imports so they can
 * be unit-tested under plain node (vitest).
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Linear map from `domain` to `range`. A degenerate domain (min === max) maps
 * every input to the range midpoint so single-value series still render.
 */
export function linearScale(
  domain: [number, number],
  range: [number, number],
): (x: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d0 === d1) {
    const mid = (r0 + r1) / 2;
    return () => mid;
  }
  const k = (r1 - r0) / (d1 - d0);
  return (x) => r0 + (x - d0) * k;
}

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/**
 * A "nice" ceiling for an axis maximum: the smallest value >= n of the form
 * step * 10^k with step in {1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10}.
 * 0 / negative / NaN -> 1; 1234 -> 1500; 1501 -> 2000; 85 -> 100.
 */
export function niceMax(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const m = n / mag;
  for (const step of NICE_STEPS) {
    if (m <= step + 1e-9) return step * mag;
  }
  return 10 * mag;
}

function num(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toFixed(2)));
}

const pt = (p: Point) => `${num(p.x)},${num(p.y)}`;

/** Straight polyline path: "M x,y L x,y …" (compact, no spaces). */
export function linePath(points: Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${pt(p)}`).join("");
}

/**
 * Smooth path as piecewise cubic Béziers using monotone cubic interpolation
 * (Fritsch–Carlson, the same method as d3's curveMonotoneX). Assumes x is
 * non-decreasing. The curve passes through every point and never overshoots
 * between neighbouring y values, so a spend curve never dips below a flat run.
 */
export function smoothPath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${pt(points[0])}`;
  if (n === 2) return linePath(points);

  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    h.push(dx);
    d.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }

  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }

  let out = `M${pt(points[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const c1 = { x: p0.x + h[i] / 3, y: p0.y + (m[i] * h[i]) / 3 };
    const c2 = { x: p1.x - h[i] / 3, y: p1.y - (m[i + 1] * h[i]) / 3 };
    out += `C${pt(c1)},${pt(c2)},${pt(p1)}`;
  }
  return out;
}

/**
 * Closed area under a series: baseline -> first point -> … -> last point ->
 * baseline -> Z. Pass `smooth` to follow smoothPath instead of straight lines.
 */
export function areaPath(
  points: Point[],
  baselineY: number,
  smooth = false,
): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const top = smooth ? smoothPath(points) : linePath(points);
  // Replace the leading "M…" with an "L…" so the area starts on the baseline.
  const body = "L" + top.slice(1);
  return `M${num(first.x)},${num(baselineY)}${body}L${num(last.x)},${num(baselineY)}Z`;
}

function trim1(v: number): string {
  return String(Number(v.toFixed(1)));
}

/**
 * Indian-style compact amounts for axis labels:
 * 0 -> ₹0, 850 -> ₹850, 1200 -> ₹1.2K, 340000 -> ₹3.4L, 11000000 -> ₹1.1Cr.
 */
export function formatAxisAmount(n: number): string {
  if (!Number.isFinite(n)) return "₹0";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  let body: string;
  if (v < 1000) {
    body = String(Math.round(v));
  } else {
    let unit: string;
    let val: number;
    if (v < 1e5) {
      unit = "K";
      val = v / 1e3;
    } else if (v < 1e7) {
      unit = "L";
      val = v / 1e5;
    } else {
      unit = "Cr";
      val = v / 1e7;
    }
    // Rounding can spill into the next unit (99990 -> 100K -> 1L).
    if (trim1(val) === "100" && unit === "K") {
      unit = "L";
      val = v / 1e5;
    } else if (trim1(val) === "100" && unit === "L") {
      unit = "Cr";
      val = v / 1e7;
    } else if (trim1(val) === "1000" && unit === "K") {
      unit = "L";
      val = v / 1e5;
    }
    body = `${trim1(val)}${unit}`;
  }
  if (body === "0") return "₹0";
  return `${sign}₹${body}`;
}
