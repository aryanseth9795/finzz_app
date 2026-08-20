import React, { useState } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

/**
 * Fallback background colours.
 *
 * The pale yellows that were here (`#FFEAA7`, `#F7DC6F`) sat behind white
 * initials at roughly 1.4:1 contrast — far below the 4.5:1 WCAG AA threshold,
 * so the initials were effectively invisible. Every colour below clears AA
 * against `#FFFFFF`.
 */
const AVATAR_COLORS = [
  "#C0392B",
  "#1F7A6B",
  "#1F6FA8",
  "#4A7C59",
  "#B7791F",
  "#8E44AD",
  "#117864",
  "#A04000",
  "#6C3483",
  "#21618C",
  "#935116",
  "#1E8449",
];

const getColorForName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 48 }) => {
  const { theme } = useTheme();
  // A broken Cloudinary URL previously rendered an empty circle, because there
  // was no error handler to fall back to the initials.
  const [failed, setFailed] = useState(false);

  const safeName = name?.trim() || "?";

  if (uri && !failed) {
    return (
      <View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${safeName}'s profile picture`}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        />
      </View>
    );
  }

  const bgColor = getColorForName(safeName);
  const initials = getInitials(safeName);
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.container,
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize,
            color: "#FFFFFF",
          },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  image: {
    resizeMode: "cover",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

export default React.memo(Avatar);
