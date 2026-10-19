import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { Point, linearScale, smoothPath } from "./scale";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showLastDot?: boolean;
}

const PAD = 3;

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 28,
  color,
  showLastDot = true,
}) => {
  const { theme } = useTheme();
  const stroke = color ?? theme.colors.chart.spend;
  const clean = data.map((v) => (Number.isFinite(v) ? v : 0));

  if (clean.length === 0) return <View style={{ width, height }} />;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const sx = linearScale([0, Math.max(clean.length - 1, 1)], [PAD, width - PAD]);
  // Flat series (min === max) maps to the vertical midpoint.
  const sy = linearScale([min, max], [height - PAD, PAD]);
  const pts: Point[] = clean.map((v, i) => ({ x: sx(i), y: sy(v) }));
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path
        d={smoothPath(pts)}
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {showLastDot && <Circle cx={last.x} cy={last.y} r={2.5} fill={stroke} />}
    </Svg>
  );
};

export default Sparkline;
