import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../contexts/ThemeContext";
import { Avatar } from "../../../components/ui";
import type { INote } from "../../../types";
import {
  noteDisplayTitle,
  notePreview,
  noteListTimestamp,
} from "../../../utils/notes";

interface NoteCardProps {
  note: INote;
  onPress: () => void;
}

const NoteCard = ({ note, onPress }: NoteCardProps) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;

  const preview = notePreview(note);
  const isRecipient = note.role === "editor" || note.role === "viewer";
  const sharedWith = note.sharedWith ?? 0;
  const showOwnerMeta = !isRecipient && (!!note.personLabel || sharedWith > 0);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.title, { color: colors.text, fontSize: fs.lg }]}
        numberOfLines={1}
      >
        {noteDisplayTitle(note)}
      </Text>

      {preview.length > 0 && (
        <Text
          style={[styles.preview, { color: colors.textSecondary, fontSize: fs.md }]}
          numberOfLines={2}
        >
          {preview}
        </Text>
      )}

      {isRecipient && (
        <View
          style={[styles.badge, { backgroundColor: colors.primarySurface }]}
        >
          <Text
            style={[styles.badgeText, { color: colors.primary, fontSize: fs.xs }]}
            numberOfLines={1}
          >
            {`From ${note.owner.name} · ${
              note.role === "editor" ? "Can edit" : "View only"
            }`}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text
          style={[styles.timestamp, { color: colors.textTertiary, fontSize: fs.xs }]}
          numberOfLines={1}
        >
          {noteListTimestamp(note, new Date())}
        </Text>

        {showOwnerMeta && (
          <View style={styles.meta}>
            {note.personLabel ? (
              <View
                style={[styles.chip, { backgroundColor: colors.primarySurface }]}
              >
                <Avatar
                  uri={note.personLabel.avatar}
                  name={note.personLabel.name}
                  size={16}
                />
                <Text
                  style={[styles.chipText, { color: colors.text, fontSize: fs.xs }]}
                  numberOfLines={1}
                >
                  {note.personLabel.name}
                </Text>
              </View>
            ) : null}
            {sharedWith > 0 && (
              <View style={styles.shared}>
                <Ionicons name="people" size={14} color={colors.textTertiary} />
                <Text
                  style={[
                    styles.sharedText,
                    { color: colors.textTertiary, fontSize: fs.xs },
                  ]}
                >
                  {sharedWith}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  title: {
    fontWeight: "600",
  },
  preview: {
    lineHeight: 20,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: "100%",
  },
  badgeText: {
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  timestamp: {
    flexShrink: 1,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 3,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexShrink: 1,
  },
  chipText: {
    fontWeight: "500",
    flexShrink: 1,
  },
  shared: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  sharedText: {
    fontWeight: "500",
  },
});

export default React.memo(NoteCard);
