import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import {
  monthGrid,
  heatLevel,
  compactNumber,
  WEEKDAY_SHORT_MON_FIRST,
} from "./calendar";
import { readableOn } from "../../utils/chartPalette";

export interface CalendarHeatmapProps {
  year: number;
  /** 1-12 */
  month: number;
  /** day-of-month -> amount */
  values: Record<number, number>;
  onDayPress?: (day: number) => void;
  selectedDay?: number;
  formatter?: (n: number) => string;
}

const GAP = 4;

const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  year,
  month,
  values,
  onDayPress,
  selectedDay,
  formatter = compactNumber,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs, spacing: sp } = theme;
  const chart = colors.chart;
  const [width, setWidth] = useState(0);

  const weeks = useMemo(() => monthGrid(year, month), [year, month]);
  const max = useMemo(() => {
    let m = 0;
    for (const v of Object.values(values ?? {})) {
      if (Number.isFinite(v) && v > m) m = v;
    }
    return m;
  }, [values]);
  const total = useMemo(
    () =>
      Object.values(values ?? {}).reduce(
        (s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0),
        0,
      ),
    [values],
  );

  const now = new Date();
  const todayDay =
    now.getFullYear() === year && now.getMonth() + 1 === month
      ? now.getDate()
      : -1;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const cell = width > 0 ? Math.floor((width - GAP * 6) / 7) : 0;
  const summary =
    max === 0
      ? "Spending calendar. No spending recorded this month"
      : `Spending calendar. Total ${formatter(total)}, highest day ${formatter(max)}`;

  return (
    <View
      onLayout={onLayout}
      accessible={false}
      accessibilityLabel={summary}
      style={styles.root}
    >
      {cell > 0 && (
        <>
          <View style={[styles.row, { marginBottom: sp.xs }]}>
            {WEEKDAY_SHORT_MON_FIRST.map((w, i) => (
              <Text
                key={w}
                style={{
                  width: cell,
                  marginRight: i < 6 ? GAP : 0,
                  textAlign: "center",
                  color: chart.axis,
                  fontSize: fs.xs,
                }}
              >
                {w.charAt(0)}
              </Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View
              key={wi}
              style={[
                styles.row,
                { marginBottom: wi < weeks.length - 1 ? GAP : 0 },
              ]}
            >
              {week.map((day, di) => {
                const marginRight = di < 6 ? GAP : 0;
                if (day === null) {
                  return (
                    <View
                      key={di}
                      style={{ width: cell, height: cell, marginRight }}
                    />
                  );
                }
                const v = values?.[day] ?? 0;
                const level = heatLevel(v, max);
                const isSelected = selectedDay === day;
                const isToday = todayDay === day;
                const ring = isSelected
                  ? { borderWidth: 2.5, borderColor: colors.text }
                  : isToday
                    ? { borderWidth: 1.5, borderColor: colors.text }
                    : { borderWidth: 0, borderColor: "transparent" };
                return (
                  <Pressable
                    key={di}
                    disabled={!onDayPress}
                    onPress={() => onDayPress?.(day)}
                    accessibilityRole={onDayPress ? "button" : undefined}
                    accessibilityLabel={`Day ${day}, ${
                      v > 0 ? formatter(v) : "no spending"
                    }${isToday ? ", today" : ""}${isSelected ? ", selected" : ""}`}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      {
                        width: cell,
                        height: cell,
                        marginRight,
                        borderRadius: Math.max(4, Math.round(cell * 0.22)),
                        backgroundColor: chart.heat[level],
                        alignItems: "center",
                        justifyContent: "center",
                      },
                      ring,
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: fs.xs,
                        color: readableOn(chart.heat[level], [
                          colors.text,
                          "#FFFFFF",
                        ]),
                        fontWeight: isToday || isSelected ? "700" : "500",
                      }}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View
            style={[styles.legend, { marginTop: sp.md }]}
            accessible
            accessibilityLabel="Legend: less to more spending"
          >
            <Text style={{ color: chart.axis, fontSize: fs.xs }}>Less</Text>
            {chart.heat.map((c, i) => (
              <View
                key={i}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  marginLeft: 4,
                  backgroundColor: c,
                }}
              />
            ))}
            <Text style={{ color: chart.axis, fontSize: fs.xs, marginLeft: 6 }}>
              More
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: "100%" },
  row: { flexDirection: "row" },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});

export default CalendarHeatmap;
