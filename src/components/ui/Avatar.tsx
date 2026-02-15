import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

const AVATAR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F0B27A",
  "#82E0AA",
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

  if (uri) {
    return (
      <View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Image
          source={{ uri }}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        />
      </View>
    );
  }

  const bgColor = getColorForName(name);
  const initials = getInitials(name);
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
