/**
 * Pure layout helpers for the month trend chart (DivergingBars). No React /
 * react-native imports so they can be unit-tested under plain node (vitest).
 */
import { MONTH_LONG, MONTH_SHORT } from "../../utils/months";

/** Narrowest month column (pt) before the chart scrolls instead of squeezing. */
export const MIN_TREND_SLOT = 44;

export interface TrendSlot {
  /** Width of one month column. */
  slot: number;
  /** True when the columns are wider in total than the card and must scroll. */
  scroll: boolean;
  /** Width of the drawn chart: the card width, or count * slot when scrolling. */
  contentWidth: number;
}

/**
 * Column width for `count` months in `width` pt. Columns narrower than
 * `minSlot` would cut their labels, so the chart then scrolls with fixed
 * `minSlot` columns instead.
 */
export function trendSlot(
  width: number,
  count: number,
  minSlot = MIN_TREND_SLOT,
): TrendSlot {
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  if (w === 0 || !Number.isFinite(count) || count <= 0) {
    return { slot: 0, scroll: false, contentWidth: w };
  }
  const n = Math.floor(count);
  if (w / n < minSlot) {
    return { slot: minSlot, scroll: true, contentWidth: n * minSlot };
  }
  return { slot: w / n, scroll: false, contentWidth: w };
}

export interface MonthLabelPart {
  /** "Nov" (or the raw label when it is not a month). */
  month: string;
  /** "'25" at the first column and wherever the year changes, else null. */
  year: string | null;
}

type MonthItem = string | { year: number; month: number };

interface Parsed {
  text: string;
  monthIdx: number | null; // 0-11
  yy: number | null; // 0-99
}

const yy2 = (year: number): number => ((Math.trunc(year) % 100) + 100) % 100;

// "Nov", "Nov '25", "Nov ’25", "Nov 2025", "November 2025".
const LABEL_RE = /^([A-Za-z]+)\.?(?:\s+(?:['‘’](\d{2})|(\d{4})))?$/;

const parseItem = (item: MonthItem): Parsed => {
  if (typeof item !== "string") {
    const ok =
      Number.isInteger(item?.month) && item.month >= 1 && item.month <= 12;
    return {
      text: ok ? MONTH_SHORT[item.month - 1] : String(item?.month ?? ""),
      monthIdx: ok ? item.month - 1 : null,
      yy: ok && Number.isFinite(item.year) ? yy2(item.year) : null,
    };
  }
  const raw = item.trim();
  const m = LABEL_RE.exec(raw);
  const word = m ? m[1].toLowerCase() : "";
  // "Nov", "Sept", "November": a 3+ letter prefix of the month's long name.
  const idx =
    word.length >= 3
      ? MONTH_LONG.findIndex((s) => s.toLowerCase().startsWith(word))
      : -1;
  if (!m || idx < 0) return { text: raw, monthIdx: null, yy: null };
  const yy = m[2] !== undefined ? Number(m[2]) : m[3] !== undefined ? yy2(Number(m[3])) : null;
  return { text: MONTH_SHORT[idx], monthIdx: idx, yy };
};

/**
 * Two-line labels for consecutive months, oldest first: the short month on
 * line 1, and the 2-digit year on line 2 only at the first column and where
 * the year changes. Accepts the TrendSection labels ("Nov '25", or "Jan" for
 * the selected year) or {year, month} items. A label without a year takes it
 * from its neighbours (Dec '25 -> Jan is '26); when no label carries a year,
 * none is shown.
 */
export function monthLabelParts(items: readonly MonthItem[]): MonthLabelPart[] {
  const parsed = (items ?? []).map(parseItem);
  const years = parsed.map((p) => p.yy);
  const linked = (a: number, b: number) =>
    parsed[a].monthIdx !== null && parsed[b].monthIdx !== null;

  // Forward: the year rolls over when the month index wraps (Dec -> Jan).
  for (let i = 1; i < parsed.length; i++) {
    const prev = years[i - 1];
    if (years[i] === null && prev !== null && linked(i - 1, i)) {
      years[i] =
        (parsed[i].monthIdx as number) <= (parsed[i - 1].monthIdx as number)
          ? (prev + 1) % 100
          : prev;
    }
  }
  // Backward: fill leading columns from a later explicit year.
  for (let i = parsed.length - 2; i >= 0; i--) {
    const next = years[i + 1];
    if (years[i] === null && next !== null && linked(i, i + 1)) {
      years[i] =
        (parsed[i].monthIdx as number) >= (parsed[i + 1].monthIdx as number)
          ? (next + 99) % 100
          : next;
    }
  }

  return parsed.map((p, i) => {
    const y = years[i];
    const show = y !== null && (i === 0 || years[i - 1] !== y);
    return {
      month: p.text,
      year: show ? `'${String(y).padStart(2, "0")}` : null,
    };
  });
}

export interface TrendTooltipArgs {
  index: number;
  slot: number;
  tipWidth: number;
  /** Width of the drawn chart (the scroll content when scrolling). */
  contentWidth: number;
  /** Scroll offset of the visible window, in content coordinates. */
  viewStart?: number;
  /** Width of the visible window; defaults to the whole content. */
  viewWidth?: number;
}

/**
 * Left edge of the tooltip in content coordinates: centred on its column,
 * then kept inside both the content and the visible (scrolled) window.
 */
export function trendTooltipLeft({
  index,
  slot,
  tipWidth,
  contentWidth,
  viewStart = 0,
  viewWidth = contentWidth,
}: TrendTooltipArgs): number {
  const maxContentLeft = Math.max(0, contentWidth - tipWidth);
  const lo = Math.min(Math.max(0, viewStart), maxContentLeft);
  const hi = Math.max(lo, Math.min(contentWidth, viewStart + viewWidth) - tipWidth);
  const centred = slot * index + slot / 2 - tipWidth / 2;
  return Math.min(Math.max(centred, lo), hi);
}
