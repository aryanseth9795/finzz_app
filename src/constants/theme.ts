// ================================================
// WhatsApp-Inspired Theme System
// Light & Dark modes with production-grade aesthetics
// ================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
} as const;

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
};

// ========================
// Light Theme (Modern Fintech)
// ========================
export const lightColors = {
  // Core
  primary: "#6366F1", // Indigo-500
  primaryLight: "#818CF8", // Indigo-400
  primaryDark: "#4F46E5", // Indigo-600
  primarySurface: "#EEF2FF", // Indigo-50

  // Semantic
  success: "#10B981", // Emerald-500
  successLight: "#D1FAE5", // Emerald-100
  danger: "#EF4444", // Red-500
  dangerLight: "#FEE2E2", // Red-100
  warning: "#F59E0B", // Amber-500
  warningLight: "#FEF3C7", // Amber-100
  info: "#3B82F6", // Blue-500

  // Background
  background: "#F8FAFC", // Slate-50
  backgroundSecondary: "#F1F5F9", // Slate-100
  surface: "#FFFFFF",
  surfaceSecondary: "#F8FAFC", // Slate-50
  surfaceElevated: "#FFFFFF",

  // Text
  text: "#0F172A", // Slate-900
  textSecondary: "#475569", // Slate-600
  textTertiary: "#94A3B8", // Slate-400
  textInverse: "#FFFFFF",
  textLink: "#6366F1", // Indigo-500

  // Border & Separator
  border: "#E2E8F0", // Slate-200
  separator: "#CBD5E1", // Slate-300
  separatorLight: "#F1F5F9", // Slate-100

  // Tab Bar
  tabBar: "#FFFFFF",
  tabBarBorder: "#E2E8F0", // Slate-200
  tabActive: "#6366F1", // Indigo-500
  tabInactive: "#94A3B8", // Slate-400

  // Chat specific
  chatBubbleSent: "#6366F1",
  chatBubbleReceived: "#F1F5F9",
  chatBubbleTextSent: "#FFFFFF",
  chatBubbleTextReceived: "#0F172A",

  // Transaction colors
  credit: "#10B981", // Emerald-500
  creditBg: "#D1FAE5",
  debit: "#EF4444", // Red-500
  debitBg: "#FEE2E2",

  // Status
  verified: "#10B981",
  unverified: "#F59E0B",
  pending: "#F59E0B",

  // Overlay
  overlay: "rgba(15, 23, 42, 0.4)", // Slate-900 with opacity
  shimmer: "#E2E8F0",

  // Input
  inputBackground: "#FFFFFF",
  inputBorder: "#E2E8F0", // Slate-200
  inputPlaceholder: "#94A3B8", // Slate-400

  // Shadow
  shadow: "rgba(15, 23, 42, 0.08)",

  // Navigation header
  headerBackground: "#FFFFFF",
  headerText: "#0F172A",
  headerTint: "#6366F1",

  // Card
  card: "#FFFFFF",
  cardBorder: "#E2E8F0",
};

// ========================
// Dark Theme (Premium Jet)
// ========================
export const darkColors = {
  // Core
  primary: "#6366F1", // Keep Indigo-500, but maybe slightly lighter? Let's stick to brand color.
  primaryLight: "#818CF8", // Indigo-400
  primaryDark: "#4338CA", // Indigo-700
  primarySurface: "#1e1b4b", // Very dark indigo for subtle tints

  // Semantic
  success: "#10B981", // Emerald-500
  successLight: "#064E3B", // Emerald-900
  danger: "#EF4444", // Red-500
  dangerLight: "#7F1D1D", // Red-900
  warning: "#F59E0B", // Amber-500
  warningLight: "#78350F", // Amber-900
  info: "#3B82F6", // Blue-500

  // Background
  background: "#09090B", // Zinc-950 (Really dark, almost black)
  backgroundSecondary: "#000000", // True Black for contrast
  surface: "#18181B", // Zinc-900
  surfaceSecondary: "#27272A", // Zinc-800
  surfaceElevated: "#27272A", // Zinc-800

  // Text
  text: "#FAFAFA", // Zinc-50
  textSecondary: "#A1A1AA", // Zinc-400
  textTertiary: "#52525B", // Zinc-600
  textInverse: "#09090B", // Zinc-950
  textLink: "#818CF8", // Indigo-400

  // Border & Separator
  border: "#27272A", // Zinc-800
  separator: "#3F3F46", // Zinc-700
  separatorLight: "#27272A", // Zinc-800

  // Tab Bar
  tabBar: "#09090B",
  tabBarBorder: "#27272A", // Zinc-800
  tabActive: "#818CF8", // Indigo-400
  tabInactive: "#52525B", // Zinc-600

  // Chat specific
  chatBubbleSent: "#6366F1",
  chatBubbleReceived: "#27272A",
  chatBubbleTextSent: "#FFFFFF",
  chatBubbleTextReceived: "#FAFAFA",

  // Transaction colors
  credit: "#34D399", // Emerald-400
  creditBg: "rgba(16, 185, 129, 0.15)", // Semi-transparent emerald
  debit: "#F87171", // Red-400
  debitBg: "rgba(239, 68, 68, 0.15)", // Semi-transparent red

  // Status
  verified: "#34D399",
  unverified: "#FBBF24",
  pending: "#FBBF24",

  // Overlay
  overlay: "rgba(0, 0, 0, 0.8)",
  shimmer: "#27272A",

  // Input
  inputBackground: "#18181B", // Zinc-900
  inputBorder: "#27272A", // Zinc-800
  inputPlaceholder: "#52525B", // Zinc-600

  // Shadow
  shadow: "rgba(0, 0, 0, 0.5)",

  // Navigation header
  headerBackground: "#09090B", // Zinc-950
  headerText: "#FAFAFA",
  headerTint: "#818CF8",

  // Card
  card: "#18181B", // Zinc-900
  cardBorder: "#27272A",
};

export type ThemeColors = typeof lightColors;
export type ThemeMode = "light" | "dark";

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
}

export const createTheme = (mode: ThemeMode): Theme => ({
  mode,
  colors: mode === "light" ? lightColors : darkColors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
});
