import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { Theme, ThemeMode, createTheme } from "../constants/theme";

const THEME_STORAGE_KEY = "@finzz_theme_mode";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(
    systemColorScheme === "dark" ? "dark" : "light",
  );

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode === "light" || savedMode === "dark") {
          setMode(savedMode);
        }
      } catch {
        // Use default
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const theme = React.useMemo(() => createTheme(mode), [mode]);

  /**
   * Memoised context value.
   *
   * `theme` itself was already memoised, but the provider's `value` was an
   * inline object literal — so it got a fresh identity on every render and
   * React, which compares context by reference, notified every consumer.
   * `useTheme()` is used by essentially every component in the app, so one
   * ThemeProvider render re-rendered the entire tree.
   */
  const value = React.useMemo(
    () => ({
      theme,
      toggleTheme,
      setThemeMode,
      isDark: mode === "dark",
    }),
    [theme, toggleTheme, setThemeMode, mode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
