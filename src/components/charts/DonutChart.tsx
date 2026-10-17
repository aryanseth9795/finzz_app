import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { describeArc, donutSegments } from "./arc";

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  onSelect?: (index: number | null) => void;
}

const GROW = 6; // extra stroke width for the selected segment

const formatShare = (share: number) =>
  `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;

const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 200,
  thickness = 22,
  centerLabel,
  centerValue,
  onSelect,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize } = theme;
  const palette = colors.chart.categorical;
  const [selected, setSelected] = useState<number | null>(null);

  const segments = useMemo(
    () => donutSegments(data.map((d) => (d.value > 0 ? d.value : 0))),
    [data],
  );

  // Drop a stale selection when the data changes under us.
  useEffect(() => {
    setSelected((s) =>
      s !== null && !segments.some((seg) => seg.index === s) ? null : s,
    );
  }, [segments]);

  const c = size / 2;
  const r = (size - thickness - GROW * 2) / 2;
  const selectedSeg = segments.find((s) => s.index === selected);

  const handlePress = (index: number) => {
    const next = selected === index ? null : index;
    setSelected(next);
    onSelect?.(next);
  };

  const summary = useMemo(() => {
    const top = [...segments]
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((s) => `${data[s.index].label} ${formatShare(s.share)}`);
    return top.length
      ? `Donut chart. ${top.join(", ")}`
      : "Donut chart. No data";
  }, [segments, data]);

  const shownLabel = selectedSeg ? data[selectedSeg.index].label : centerLabel;
  const shownValue = selectedSeg ? formatShare(selectedSeg.share) : centerValue;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={colors.chart.track}
          strokeWidth={thickness}
          fill="none"
        />
        <G>
          {segments.map((seg) => {
            const isSel = seg.index === selected;
            return (
              <Path
                key={seg.index}
                d={describeArc(c, c, r, seg.start, seg.end)}
                stroke={
                  data[seg.index].color ?? palette[seg.index % palette.length]
                }
                strokeWidth={isSel ? thickness + GROW : thickness}
                strokeLinecap="butt"
                fill="none"
                onPress={() => handlePress(seg.index)}
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {segments.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
            No data
          </Text>
        ) : (
          <>
            {shownValue ? (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.value,
                  { color: colors.text, fontSize: fontSize.xl },
                ]}
              >
                {shownValue}
              </Text>
            ) : null}
            {shownLabel ? (
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textSecondary,
                  fontSize: fontSize.sm,
                  maxWidth: size - thickness * 2 - 16,
                }}
              >
                {shownLabel}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontWeight: "700" },
});

export default DonutChart;
