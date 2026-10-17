/**
 * Pure geometry helpers for donut / ring charts.
 * Angles are in degrees, 0 = 12 o'clock, increasing clockwise.
 */

export interface Point {
  x: number;
  y: number;
}

export interface DonutSegment {
  start: number;
  end: number;
  value: number;
  share: number;
  /** Index of this value in the input array (zero values are skipped). */
  index: number;
}

const MAX_SWEEP = 359.99;

export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = Math.min(Math.max(endDeg - startDeg, 0), MAX_SWEEP);
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, startDeg + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

export function donutSegments(values: number[], gapDeg = 2): DonutSegment[] {
  const total = values.reduce((a, v) => a + (v > 0 ? v : 0), 0);
  if (!(total > 0)) return [];

  const present = values
    .map((value, index) => ({ value, index }))
    .filter((v) => v.value > 0);
  // A lone segment fills the ring; a gap would only leave a notch.
  const gap = present.length > 1 ? gapDeg : 0;

  let acc = 0;
  return present.map(({ value, index }) => {
    const share = value / total;
    const from = acc * 360;
    acc += share;
    const to = acc * 360;
    return {
      start: from + gap / 2,
      end: to - gap / 2,
      value,
      share,
      index,
    };
  });
}
