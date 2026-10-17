import React from "react";
import { Text } from "react-native";
import SafeAreaWrapper from "../../components/ui/SafeAreaWrapper";
import { useTheme } from "../../contexts/ThemeContext";

const NoteEditorScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  return (
    <SafeAreaWrapper>
      <Text style={{ color: theme.colors.text }}>NoteEditorScreen</Text>
    </SafeAreaWrapper>
  );
};

export default NoteEditorScreen;
