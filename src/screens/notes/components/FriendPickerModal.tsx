import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../contexts/ThemeContext";
import Avatar from "../../../components/ui/Avatar";
import { IFriend } from "../../../types";

export interface FriendPickerModalProps {
  visible: boolean;
  mode: "single" | "multi";
  title: string; // header text, e.g. "Label with a friend" / "Share with"
  friends: IFriend[];
  excludeIds?: string[]; // hidden from the list (e.g. people who already have access)
  selectedId?: string | null; // single mode: shows a check on the current choice
  allowNone?: boolean; // single mode: shows a first row "No label"
  hint?: string; // small muted line under the header
  confirmLabel?: string; // multi mode: button text, default "Share"
  onSelect: (ids: string[] | null) => void; // single: [id] or null for "No label"; multi: the selected ids
  onClose: () => void;
}

const FriendPickerModal: React.FC<FriendPickerModalProps> = ({
  visible,
  mode,
  title,
  friends,
  excludeIds,
  selectedId,
  allowNone,
  hint,
  confirmLabel = "Share",
  onSelect,
  onClose,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Selection and search reset each time the modal opens.
  useEffect(() => {
    if (visible) {
      setSearchQuery("");
      setSelectedIds([]);
    }
  }, [visible]);

  // Friends that are not excluded.
  const available = useMemo(() => {
    if (!excludeIds || excludeIds.length === 0) return friends;
    const excluded = new Set(excludeIds);
    return friends.filter((f) => !excluded.has(f._id));
  }, [friends, excludeIds]);

  // Case-insensitive substring match on the name (plain text, not a regex).
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return available;
    return available.filter((f) => (f.name ?? "").toLowerCase().includes(q));
  }, [available, searchQuery]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleConfirm = useCallback(() => {
    const availableIds = new Set(available.map((f) => f._id));
    const ids = selectedIds.filter((id) => availableIds.has(id));
    if (ids.length === 0) return;
    onSelect(ids);
  }, [available, selectedIds, onSelect]);

  const count = selectedIds.length;

  const emptyMessage =
    friends.length === 0
      ? "No friends yet"
      : available.length === 0
        ? "Everyone already has access"
        : "No friends found";

  const renderItem = useCallback(
    ({ item }: { item: IFriend }) => {
      const isMulti = mode === "multi";
      const checked = isMulti
        ? selectedIds.includes(item._id)
        : selectedId === item._id;
      return (
        <TouchableOpacity
          style={[styles.friendRow, { borderBottomColor: colors.separator }]}
          onPress={() => (isMulti ? toggle(item._id) : onSelect([item._id]))}
          accessibilityRole={isMulti ? "checkbox" : "button"}
          accessibilityState={{ checked }}
          accessibilityLabel={item.name}
        >
          <View style={styles.rowLeft}>
            <Avatar uri={item.avatar} name={item.name} size={40} />
            <Text
              style={[
                styles.friendName,
                { color: colors.text, fontSize: fs.md },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </View>
          {isMulti ? (
            <Ionicons
              name={checked ? "checkbox" : "square-outline"}
              size={24}
              color={checked ? colors.primary : colors.textTertiary}
            />
          ) : checked ? (
            <Ionicons name="checkmark" size={24} color={colors.primary} />
          ) : null}
        </TouchableOpacity>
      );
    },
    [mode, selectedIds, selectedId, colors, fs, toggle, onSelect],
  );

  const noneRow =
    mode === "single" && allowNone ? (
      <TouchableOpacity
        style={[styles.friendRow, { borderBottomColor: colors.separator }]}
        onPress={() => onSelect(null)}
        accessibilityRole="button"
        accessibilityLabel="No label"
      >
        <View style={styles.rowLeft}>
          <View
            style={[styles.noneIcon, { backgroundColor: colors.surface }]}
          >
            <Ionicons
              name="close-outline"
              size={22}
              color={colors.textSecondary}
            />
          </View>
          <Text
            style={[
              styles.friendName,
              { color: colors.text, fontSize: fs.md },
            ]}
          >
            No label
          </Text>
        </View>
        {!selectedId ? (
          <Ionicons name="checkmark" size={24} color={colors.primary} />
        ) : null}
      </TouchableOpacity>
    ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalContent, { backgroundColor: colors.background }]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.separator }]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: colors.text, fontSize: fs.lg },
              ]}
            >
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          {hint ? (
            <Text
              style={[
                styles.hint,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              {hint}
            </Text>
          ) : null}
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                fontSize: fs.md,
                borderColor: colors.border,
              },
            ]}
            placeholder="Search friends..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            extraData={mode === "multi" ? selectedIds : selectedId}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={noneRow}
            ListEmptyComponent={
              <Text
                style={[
                  styles.emptyText,
                  { color: colors.textSecondary, fontSize: fs.sm },
                ]}
              >
                {emptyMessage}
              </Text>
            }
          />
          {mode === "multi" ? (
            <View
              style={[styles.footer, { borderTopColor: colors.separator }]}
            >
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: count === 0 ? 0.5 : 1,
                  },
                ]}
                onPress={handleConfirm}
                disabled={count === 0}
                accessibilityRole="button"
                accessibilityState={{ disabled: count === 0 }}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: fs.md }}
                >
                  {`${confirmLabel} (${count})`}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontWeight: "700",
  },
  hint: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchInput: {
    margin: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  friendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  noneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  friendName: {
    fontWeight: "500",
    flexShrink: 1,
  },
  emptyText: {
    textAlign: "center",
    padding: 32,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
});

export default FriendPickerModal;
