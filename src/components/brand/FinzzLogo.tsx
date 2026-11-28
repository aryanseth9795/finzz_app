import React, { useId } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  ClipPath,
} from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";

interface FinzzMarkProps {
  size?: number;
}

/** Finzz app logo (from store/logo-A.svg), clipped to a rounded square. */
export const FinzzMark = ({ size = 32 }: FinzzMarkProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `fzg${uid}`;
  const hiId = `fzh${uid}`;
  const clipId = `fzc${uid}`;

  return (
    <View
      accessible
      accessibilityLabel="Finzz logo"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#4338CA" />
            <Stop offset="1" stopColor="#2563EB" />
          </LinearGradient>
          <RadialGradient
            id={hiId}
            gradientUnits="userSpaceOnUse"
            cx="300"
            cy="260"
            r="520"
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <ClipPath id={clipId}>
            <Rect width="1024" height="1024" rx="230" ry="230" />
          </ClipPath>
        </Defs>
        <Rect
          width="1024"
          height="1024"
          fill={`url(#${gradId})`}
          clipPath={`url(#${clipId})`}
        />
        <Rect
          width="1024"
          height="1024"
          fill={`url(#${hiId})`}
          clipPath={`url(#${clipId})`}
        />
        <Rect x="333" y="292" width="104" height="440" rx="52" fill="#FFFFFF" />
        <Rect x="333" y="292" width="300" height="104" rx="52" fill="#FFFFFF" />
        <Rect x="333" y="462" width="210" height="104" rx="52" fill="#FFFFFF" />
        <Circle cx="639" cy="514" r="52" fill="#34D399" />
        <Circle
          cx="639"
          cy="514"
          r="31"
          fill="none"
          stroke="#059669"
          strokeWidth="10"
        />
      </Svg>
    </View>
  );
};

/** Logo mark followed by the "Finzz" wordmark text. */
export const FinzzWordmark = ({ size = 32 }: FinzzMarkProps) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { gap: size * 0.3 }]}>
      <FinzzMark size={size} />
      <Text
        style={{
          color: theme.colors.text,
          fontSize: size * 0.85,
          fontWeight: "800",
          letterSpacing: -0.5,
        }}
      >
        Finzz
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
