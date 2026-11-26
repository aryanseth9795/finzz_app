import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LandingScreen from "../screens/auth/LandingScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import OnboardingScreen from "../screens/auth/OnboardingScreen";
import VideoPlayerScreen from "../screens/auth/VideoPlayerScreen";
import { hasSeenOnboardingDefault } from "../utils/onboarding";

const Stack = createNativeStackNavigator();

const AuthStack = () => {
  // Read once on mount; null while unknown (a fraction of a second).
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    hasSeenOnboardingDefault().then((v) => {
      if (alive) setSeen(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (seen === null) return null;

  return (
    <Stack.Navigator
      initialRouteName={seen ? "Landing" : "Onboarding"}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen
        name="VideoPlayer"
        component={VideoPlayerScreen}
        options={{ animation: "fade_from_bottom" }}
      />
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthStack;
