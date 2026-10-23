import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import Svg, { Rect, Circle } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { compactNumber } from "./calendar";
import { monthLabelParts, trendSlot, trendTooltipLeft } from "./trendLayout";

export interface DivergingDatum {
  label: string;
  income: number;
  spend: number;
}

export interface DivergingBarsProps {
  data: DivergingDatum[];
  height?: number;
  formatter?: (n: number) => string;
}

const TOP_PAD = 6;
const DOT_ROW = 16;
const TOOLTIP_W = 132;
const TOOLTIP_H = 62;

// Two-line month labels: "Nov" on line 1, "'25" (year changes only) below.
const MONTH_FS = 11;
const MONTH_LH = 14;
const YEAR_FS = 10;
const YEAR_LH = 12;
const LABEL_PAD = 4;
// Columns are at least 44 pt, so "Nov" still fits at 1.4x system text size;
// the label row grows with the scale so a second line is never clipped.
const MAX_LABEL_SCALE = 1.4;

const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

const DivergingBars: React.FC<DivergingBarsProps> = ({
  data,
  height = 200,
  formatter = compactNumber,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const chart = colors.chart;
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  // Scroll offset when the tooltip was opened, in content coordinates.
  const [viewStart, setViewStart] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);

  const rows = useMemo(
    () =>
      (data ?? []).map((d) => ({
        label: d.label,
        income: safe(d.income),
        spend: safe(d.spend),
      })),
    [data],
  );
  const labelParts = useMemo(
    () => monthLabelParts(rows.map((r) => r.label)),
    [rows],
  );
  const maxInc = Math.max(0, ...rows.map((r) => r.income));
  const maxSpend = Math.max(0, ...rows.map((r) => r.spend));
  const hasData = rows.length > 0 && maxInc + maxSpend > 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollX.current = e.nativeEvent.contentOffset.x;
    },
    [],
  );

  // The selected month is the last column, so open scrolled to the end.
  const scrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  if (!hasData) {
    return (
      <View
        style={[styles.empty, { height }]}
        accessible
        accessibilityLabel="No monthly income or spending data"
      >
        <Text style={{ color: chart.axis, fontSize: fs.sm }}>
          No monthly data to show
        </Text>
      </View>
    );
  }

  const signed = (n: number) => `${n < 0 ? "-" : ""}${formatter(Math.abs(n))}`;

  // Fixed 44-pt columns that scroll, or the full card width when they fit.
  const { slot, scroll, contentWidth } = trendSlot(width, rows.length);
  const hasYearLine = labelParts.some((p) => p.year !== null);
  const labelScale = Math.min(Math.max(1, fontScale || 1), MAX_LABEL_SCALE);
  const labelRow =
    Math.ceil((MONTH_LH + (hasYearLine ? YEAR_LH : 0)) * labelScale) +
    LABEL_PAD;

  const plotH = Math.max(40, height - TOP_PAD - DOT_ROW - labelRow);
  // One shared px-per-unit scale for both directions.
  const unit = plotH / (maxInc + maxSpend);
  const zeroY = TOP_PAD + maxInc * unit;
  const barW = Math.max(6, Math.min(slot * 0.56, 28));
  const dotY = TOP_PAD + plotH + DOT_ROW / 2;

  const totalNet = rows.reduce((s, r) => s + r.income - r.spend, 0);
  const summary = `Monthly income and spending, ${rows.length} months. Net ${signed(totalNet)}`;

  const sel = active !== null ? rows[active] : null;
  const tipLeft =
    active !== null
      ? trendTooltipLeft({
          index: active,
          slot,
          tipWidth: TOOLTIP_W,
          contentWidth,
          viewStart: scroll ? viewStart : 0,
          viewWidth: scroll ? width : contentWidth,
        })
      : 0;

  const toggle = (i: number) => {
    setViewStart(scroll ? scrollX.current : 0);
    setActive(active === i ? null : i);
  };

  const plot = (
    <View style={{ width: contentWidth, height }}>
      <Svg width={contentWidth} height={height}>
        <Rect
          x={0}
          y={zeroY - 0.5}
          width={contentWidth}
          height={1}
          fill={chart.grid}
        />
        {rows.map((r, i) => {
          const x = slot * i + (slot - barW) / 2;
          const up = r.income * unit;
          const down = r.spend * unit;
          const net = r.income - r.spend;
          const dim = active !== null && active !== i;
          return (
            <React.Fragment key={i}>
              {up > 0 && (
                <Rect
                  x={x}
                  y={zeroY - Math.max(2, up)}
                  width={barW}
                  height={Math.max(2, up)}
                  rx={3}
                  fill={chart.income}
                  opacity={dim ? 0.4 : 1}
                />
              )}
              {down > 0 && (
                <Rect
                  x={x}
                  y={zeroY}
                  width={barW}
                  height={Math.max(2, down)}
                  rx={3}
                  fill={chart.spend}
                  opacity={dim ? 0.4 : 1}
                />
              )}
              <Circle
                cx={slot * i + slot / 2}
                cy={dotY}
                r={3}
                fill={net >= 0 ? chart.positive : chart.negative}
              />
            </React.Fragment>
          );
        })}
      </Svg>

      <View
        pointerEvents="none"
        style={[
          styles.labels,
          { top: TOP_PAD + plotH + DOT_ROW, height: labelRow },
        ]}
      >
        {labelParts.map((p, i) => {
          const on = active === i;
          const color = on ? colors.text : chart.axis;
          return (
            <View key={i} style={[styles.labelCol, { width: slot }]}>
              <Text
                maxFontSizeMultiplier={MAX_LABEL_SCALE}
                style={{
                  textAlign: "center",
                  color,
                  fontSize: MONTH_FS,
                  lineHeight: MONTH_LH,
                  fontWeight: on ? "700" : "400",
                }}
              >
                {p.month}
              </Text>
              {p.year !== null && (
                <Text
                  maxFontSizeMultiplier={MAX_LABEL_SCALE}
                  style={{
                    textAlign: "center",
                    color,
                    fontSize: YEAR_FS,
                    lineHeight: YEAR_LH,
                    fontWeight: on ? "700" : "400",
                  }}
                >
                  {p.year}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* one tap target per column */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
        {rows.map((r, i) => (
          <View
            key={i}
            style={{ width: slot, height }}
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => toggle(i)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${r.label}: income ${formatter(
              r.income,
            )}, spend ${formatter(r.spend)}, net ${signed(r.income - r.spend)}`}
          />
        ))}
      </View>

      {sel && (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              left: tipLeft,
              width: TOOLTIP_W,
              minHeight: TOOLTIP_H,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{ color: colors.text, fontSize: fs.xs, fontWeight: "700" }}
          >
            {sel.label}
          </Text>
          <TipRow
            color={chart.income}
            name="Income"
            value={formatter(sel.income)}
            textColor={colors.textSecondary}
            fontSize={fs.xs}
          />
          <TipRow
            color={chart.spend}
            name="Spend"
            value={formatter(sel.spend)}
            textColor={colors.textSecondary}
            fontSize={fs.xs}
          />
          <TipRow
            color={sel.income - sel.spend >= 0 ? chart.positive : chart.negative}
            name="Net"
            value={signed(sel.income - sel.spend)}
            textColor={colors.text}
            fontSize={fs.xs}
          />
        </View>
      )}
    </View>
  );

  return (
    <View
      onLayout={onLayout}
      style={styles.root}
      accessible={false}
      accessibilityLabel={summary}
    >
      {width > 0 &&
        (scroll ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.scroller, { height }]}
            onContentSizeChange={scrollToEnd}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {plot}
          </ScrollView>
        ) : (
          plot
        ))}
    </View>
  );
};

const TipRow: React.FC<{
  color: string;
  name: string;
  value: string;
  textColor: string;
  fontSize: number;
}> = ({ color, name, value, textColor, fontSize }) => (
  <View style={styles.tipRow}>
    <View style={[styles.swatch, { backgroundColor: color }]} />
    <Text style={{ flex: 1, color: textColor, fontSize }}>{name}</Text>
    <Text style={{ color: textColor, fontSize, fontWeight: "600" }}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: { width: "100%" },
  // Fixed height: a horizontal ScrollView defaults to flexShrink 1.
  scroller: { flexGrow: 0, flexShrink: 0 },
  empty: { alignItems: "center", justifyContent: "center" },
  labels: { position: "absolute", left: 0, right: 0, flexDirection: "row" },
  labelCol: { alignItems: "center" },
  tooltip: {
    position: "absolute",
    top: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tipRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  swatch: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});

export default DivergingBars;
