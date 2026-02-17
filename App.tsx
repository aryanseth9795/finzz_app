import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { store } from "./src/store";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { ToastProvider } from "./src/contexts/ToastContext";
import RootNavigator from "./src/navigation/RootNavigator";

// Separate component to access theme context for StatusBar
const ThemedApp = () => {
  const { isDark } = useTheme();

  return (
    <ToastProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </ToastProvider>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemeProvider>
            <ThemedApp />
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
