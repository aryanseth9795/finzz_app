import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import NotesHomeScreen from "../screens/notes/NotesHomeScreen";
import NoteEditorScreen from "../screens/notes/NoteEditorScreen";
import NoteShareScreen from "../screens/notes/NoteShareScreen";

export type NotesStackParamList = {
  NotesHome: undefined;
  NoteEditor: { noteId?: string } | undefined;
  NoteShare: { noteId: string };
};

const Stack = createNativeStackNavigator<NotesStackParamList>();

const NotesStackNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
    <Stack.Screen name="NotesHome" component={NotesHomeScreen} />
    <Stack.Screen name="NoteEditor" component={NoteEditorScreen} />
    <Stack.Screen name="NoteShare" component={NoteShareScreen} />
  </Stack.Navigator>
);

export default NotesStackNavigator;
