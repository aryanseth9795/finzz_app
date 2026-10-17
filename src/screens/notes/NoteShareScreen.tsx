import React from "react";
import { Text } from "react-native";
import SafeAreaWrapper from "../../components/ui/SafeAreaWrapper";
import { useTheme } from "../../contexts/ThemeContext";

const NoteShareScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  return (
    <SafeAreaWrapper>
      <Text style={{ color: theme.colors.text }}>NoteShareScreen</Text>
    </SafeAreaWrapper>
  );
};

export default NoteShareScreen;
