import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { polarToCartesian } from "./arc";

interface ProgressRingProps {
  /** 0..1, may exceed 1 (over budget). */
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  animate?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 120,
  thickness = 12,
  color,
  trackColor,
  label,
  sublabel,
  animate = true,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize } = theme;
  const ringColor = color ?? colors.chart.spend;
  const track = trackColor ?? colors.chart.track;

  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const clamped = Math.min(safe, 1);
  const overflow = safe > 1;

  const c = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  const progress = useRef(new Animated.Value(animate ? 0 : clamped)).current;

  useEffect(() => {
    if (!animate) {
      progress.setValue(clamped);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: clamped,
      duration: 700,
      useNativeDriver: false, // SVG props are not supported by the native driver
    });
    anim.start();
    return () => anim.stop();
  }, [clamped, animate, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const marker = polarToCartesian(c, c, r, 0);
  const pct = Math.round(safe * 100);

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label ?? "Progress"}${sublabel ? `, ${sublabel}` : ""}, ${pct}%`}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(pct, 100) }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={track}
          strokeWidth={thickness}
          fill="none"
        />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={ringColor}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset as unknown as number}
          rotation={-90}
          origin={`${c}, ${c}`}
        />
        {overflow && (
          <>
            <Circle
              cx={marker.x}
              cy={marker.y}
              r={thickness * 0.45}
              fill={colors.surface}
            />
            <Circle
              cx={marker.x}
              cy={marker.y}
              r={thickness * 0.22}
              fill={ringColor}
            />
          </>
        )}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {label ? (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.label, { color: colors.text, fontSize: fontSize.lg }]}
          >
            {label}
          </Text>
        ) : null}
        {sublabel ? (
          <Text
            numberOfLines={1}
            style={{ color: colors.textSecondary, fontSize: fontSize.xs }}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  label: { fontWeight: "700" },
});

export default ProgressRing;
