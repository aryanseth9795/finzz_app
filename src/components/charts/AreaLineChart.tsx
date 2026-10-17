import React, { useCallback, useId, useMemo, useState } from "react";
import { GestureResponderEvent, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Point,
  areaPath,
  formatAxisAmount,
  linearScale,
  linePath,
  niceMax,
  smoothPath,
} from "./scale";

export interface AreaLineChartProps {
  /** Running values, one per day elapsed (index = day - 1). */
  series: number[];
  /** Comparison curve (e.g. last month), drawn as a thin dashed line. */
  compare?: number[];
  /** Projected final value; dashed line from the last point to the last day. */
  projectionTo?: number;
  width: number;
  height?: number;
  color?: string;
  compareColor?: string;
  /** Label for x tick i, or null to skip. */
  xLabels?: (i: number) => string | null;
  valueFormatter?: (n: number) => string;
}

const PAD = { left: 44, right: 10, top: 12, bottom: 22 };
const TOOLTIP_W = 116;
const GRID_LINES = 3;

export const AreaLineChart: React.FC<AreaLineChartProps> = ({
  series,
  compare,
  projectionTo,
  width,
  height = 200,
  color,
  compareColor,
  xLabels,
  valueFormatter = formatAxisAmount,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize } = theme;
  const lineColor = color ?? colors.chart.spend;
  const cmpColor = compareColor ?? colors.chart.axis;
  const gradId = `area-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const hasData = series.some((v) => Number.isFinite(v) && v > 0);

  const layout = useMemo(() => {
    const total = Math.max(series.length, compare?.length ?? 0, 1);
    const plotW = Math.max(width - PAD.left - PAD.right, 1);
    const plotH = Math.max(height - PAD.top - PAD.bottom, 1);
    const maxVal = Math.max(
      0,
      ...series,
      ...(compare ?? []),
      projectionTo ?? 0,
    );
    const top = niceMax(maxVal);
    const sx = linearScale(
      [0, Math.max(total - 1, 1)],
      [PAD.left, PAD.left + plotW],
    );
    const sy = linearScale([0, top], [PAD.top + plotH, PAD.top]);
    const toPts = (arr: number[]): Point[] =>
      arr.map((v, i) => ({ x: sx(i), y: sy(Number.isFinite(v) ? v : 0) }));
    return { total, plotW, plotH, top, sx, sy, toPts, baseY: PAD.top + plotH };
  }, [series, compare, projectionTo, width, height]);

  const handleTouch = useCallback(
    (e: GestureResponderEvent) => {
      const x = e.nativeEvent.locationX;
      if (!Number.isFinite(x)) return;
      const frac = (x - PAD.left) / layout.plotW;
      const idx = Math.round(frac * Math.max(layout.total - 1, 1));
      const maxIdx = Math.max(series.length - 1, 0);
      setActiveIdx(Math.min(Math.max(idx, 0), maxIdx));
    },
    [layout.plotW, layout.total, series.length],
  );
  const clearTouch = useCallback(() => setActiveIdx(null), []);

  if (!hasData) {
    return (
      <View
        style={[styles.empty, { width, height }]}
        accessibilityLabel="No spending yet"
      >
        <Text style={{ color: colors.textTertiary, fontSize: fontSize.sm }}>
          No spending yet
        </Text>
      </View>
    );
  }

  const { sx, sy, toPts, baseY, total, top } = layout;
  const pts = toPts(series);
  const linePts = smoothPath(pts);
  const fillPath = areaPath(pts, baseY, true);
  const cmpPts = compare && compare.length > 0 ? toPts(compare) : null;
  const last = pts[pts.length - 1];
  const showProjection =
    projectionTo !== undefined &&
    Number.isFinite(projectionTo) &&
    total > series.length;
  const projPath = showProjection
    ? linePath([last, { x: sx(total - 1), y: sy(projectionTo as number) }])
    : "";

  const gridValues = Array.from(
    { length: GRID_LINES },
    (_, i) => (top * (i + 1)) / GRID_LINES,
  );

  const active =
    activeIdx !== null && activeIdx < series.length ? activeIdx : null;
  const activeX = active !== null ? sx(active) : 0;
  const activeVal = active !== null ? series[active] : 0;
  const activeCmp =
    active !== null && compare && active < compare.length
      ? compare[active]
      : null;
  const tipLeft = Math.min(
    Math.max(activeX - TOOLTIP_W / 2, 0),
    Math.max(width - TOOLTIP_W, 0),
  );

  return (
    <View
      style={{ width, height }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={clearTouch}
      onResponderTerminate={clearTouch}
    >
      <Svg width={width} height={height} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity={0.28} />
            <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {gridValues.map((v) => (
          <React.Fragment key={v}>
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={sy(v)}
              y2={sy(v)}
              stroke={colors.chart.grid}
              strokeWidth={1}
            />
            <SvgText
              x={PAD.left - 6}
              y={sy(v) + 3}
              fontSize={10}
              fill={colors.chart.axis}
              textAnchor="end"
            >
              {formatAxisAmount(v)}
            </SvgText>
          </React.Fragment>
        ))}
        <Line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={baseY}
          y2={baseY}
          stroke={colors.chart.grid}
          strokeWidth={1}
        />
        <SvgText
          x={PAD.left - 6}
          y={baseY + 3}
          fontSize={10}
          fill={colors.chart.axis}
          textAnchor="end"
        >
          {formatAxisAmount(0)}
        </SvgText>

        {xLabels &&
          Array.from({ length: total }, (_, i) => {
            const label = xLabels(i);
            if (label == null) return null;
            const anchor =
              i === 0 ? "start" : i === total - 1 ? "end" : "middle";
            return (
              <SvgText
                key={`x${i}`}
                x={sx(i)}
                y={height - 6}
                fontSize={10}
                fill={colors.chart.axis}
                textAnchor={anchor}
              >
                {label}
              </SvgText>
            );
          })}

        {cmpPts && (
          <Path
            d={smoothPath(cmpPts)}
            stroke={cmpColor}
            strokeWidth={1.25}
            strokeDasharray="4 4"
            strokeOpacity={0.8}
            fill="none"
          />
        )}

        <Path d={fillPath} fill={`url(#${gradId})`} />
        <Path
          d={linePts}
          stroke={lineColor}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {showProjection && (
          <Path
            d={projPath}
            stroke={lineColor}
            strokeWidth={2}
            strokeDasharray="2 5"
            strokeLinecap="round"
            strokeOpacity={0.7}
            fill="none"
          />
        )}

        <Circle cx={last.x} cy={last.y} r={3.5} fill={lineColor} />

        {active !== null && (
          <>
            <Line
              x1={activeX}
              x2={activeX}
              y1={PAD.top}
              y2={baseY}
              stroke={colors.chart.axis}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Circle
              cx={activeX}
              cy={sy(activeVal)}
              r={4.5}
              fill={colors.surface}
              stroke={lineColor}
              strokeWidth={2}
            />
          </>
        )}
      </Svg>

      {active !== null && (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              left: tipLeft,
              width: TOOLTIP_W,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={{ color: colors.textTertiary, fontSize: fontSize.xs }}>
            {xLabels?.(active) ?? `Day ${active + 1}`}
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.sm,
              fontWeight: "700",
            }}
          >
            {valueFormatter(activeVal)}
          </Text>
          {activeCmp !== null && (
            <Text style={{ color: colors.chart.axis, fontSize: fontSize.xs }}>
              Last: {valueFormatter(activeCmp)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center" },
  tooltip: {
    position: "absolute",
    top: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default AreaLineChart;
