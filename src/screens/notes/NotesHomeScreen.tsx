import React from "react";
import { Text } from "react-native";
import SafeAreaWrapper from "../../components/ui/SafeAreaWrapper";
import { useTheme } from "../../contexts/ThemeContext";

const NotesHomeScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  return (
    <SafeAreaWrapper>
      <Text style={{ color: theme.colors.text }}>NotesHomeScreen</Text>
    </SafeAreaWrapper>
  );
};

export default NotesHomeScreen;
