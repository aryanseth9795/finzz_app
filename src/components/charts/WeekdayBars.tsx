import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { compactNumber, WEEKDAY_SHORT_MON_FIRST } from "./calendar";

export interface WeekdayBarsProps {
  /** Index 0 = Sunday .. 6 = Saturday (as produced by weekdayTotals). */
  totals: number[];
  highlightWeekend?: boolean;
  formatter?: (n: number) => string;
}

// Sun-first source index for each Monday-first slot.
const MON_FIRST_SRC = [1, 2, 3, 4, 5, 6, 0];
const BAR_AREA = 120;
const LABEL_H = 16;

const WeekdayBars: React.FC<WeekdayBarsProps> = ({
  totals,
  highlightWeekend = true,
  formatter = compactNumber,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const chart = colors.chart;
  const [width, setWidth] = useState(0);

  const values = useMemo(
    () =>
      MON_FIRST_SRC.map((src) => {
        const v = totals?.[src];
        return Number.isFinite(v) && v > 0 ? v : 0;
      }),
    [totals],
  );
  const max = Math.max(...values);
  const peakIdx = max > 0 ? values.indexOf(max) : -1;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  if (!totals || totals.length < 7 || max === 0) {
    return (
      <View
        style={styles.empty}
        accessible
        accessibilityLabel="No weekday spending data"
      >
        <Text style={{ color: chart.axis, fontSize: fs.sm }}>
          No spending to show
        </Text>
      </View>
    );
  }

  const slot = width / 7;
  const barW = Math.max(8, Math.min(slot * 0.58, 40));
  const summary = `Spending by weekday. ${WEEKDAY_SHORT_MON_FIRST.map(
    (d, i) => `${d} ${formatter(values[i])}`,
  ).join(", ")}. Peak day ${WEEKDAY_SHORT_MON_FIRST[peakIdx]}`;

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityLabel={summary}
      style={styles.root}
    >
      {width > 0 && (
        <>
          <View style={{ flexDirection: "row", height: LABEL_H * 2 }}>
            {values.map((v, i) => (
              <View
                key={i}
                style={{
                  width: slot,
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                {i === peakIdx && (
                  <Text
                    style={{
                      color: chart.axis,
                      fontSize: 9,
                      fontWeight: "700",
                    }}
                  >
                    Peak
                  </Text>
                )}
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.text,
                    fontSize: fs.xs,
                    fontWeight: i === peakIdx ? "700" : "500",
                  }}
                >
                  {v > 0 ? formatter(v) : ""}
                </Text>
              </View>
            ))}
          </View>

          <Svg width={width} height={BAR_AREA}>
            <Rect
              x={0}
              y={BAR_AREA - 0.5}
              width={width}
              height={1}
              fill={chart.grid}
            />
            {values.map((v, i) => {
              const h = v > 0 ? Math.max(3, (v / max) * (BAR_AREA - 2)) : 0;
              const weekend = i >= 5;
              const fill =
                highlightWeekend && weekend ? chart.categorical[2] : chart.spend;
              return (
                <Rect
                  key={i}
                  x={slot * i + (slot - barW) / 2}
                  y={BAR_AREA - 1 - h}
                  width={barW}
                  height={h}
                  rx={4}
                  fill={fill}
                />
              );
            })}
          </Svg>

          <View style={{ flexDirection: "row", marginTop: 4 }}>
            {WEEKDAY_SHORT_MON_FIRST.map((d) => (
              <Text
                key={d}
                style={{
                  width: slot,
                  textAlign: "center",
                  color: chart.axis,
                  fontSize: fs.xs,
                }}
              >
                {d}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: "100%" },
  empty: { height: 120, alignItems: "center", justifyContent: "center" },
});

export default WeekdayBars;
