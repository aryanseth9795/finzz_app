import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { SafeAreaWrapper, Avatar } from "../../components/ui";
import { useAppDispatch } from "../../store";
import { upsertNote } from "../../store/slices/notesSlice";
import {
  getNoteSharesApi,
  upsertNoteSharesApi,
  revokeNoteShareApi,
  revokeAllNoteSharesApi,
} from "../../api/notesApi";
import { getFriendsListApi } from "../../api/friendApi";
import { describeError } from "../../api/axios";
import { noteErrorKind } from "../../utils/notes";
import { logger } from "../../utils/logger";
import { IFriend, INoteShare, NotePermission } from "../../types";
import FriendPickerModal from "./components/FriendPickerModal";

const GONE_MESSAGE = "This note is no longer available";

const NoteShareScreen = ({ route, navigation }: any) => {
  const { noteId } = route.params;
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const { showSuccessToast, showErrorToast } = useToast();
  const dispatch = useAppDispatch();

  const [shares, setShares] = useState<INoteShare[]>([]);
  const [friends, setFriends] = useState<IFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Synchronous guard: state updates are async, so two quick taps could both
  // pass a `busy` state check before the first re-render disables the controls.
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const beginBusy = (): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  };
  const endBusy = () => {
    busyRef.current = false;
    if (mountedRef.current) setBusy(false);
  };

  /** True (after toast + goBack) when the note is gone or no longer ours. */
  const handleGone = (error: unknown): boolean => {
    const kind = noteErrorKind(error);
    if (kind === "gone" || kind === "forbidden") {
      showErrorToast(GONE_MESSAGE);
      navigation.goBack();
      return true;
    }
    return false;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sharesRes, friendsRes] = await Promise.all([
        getNoteSharesApi(noteId),
        getFriendsListApi(),
      ]);
      if (!mountedRef.current) return;
      setShares(sharesRes.data.shares ?? []);
      setFriends(friendsRes.data.friends ?? []);
    } catch (error) {
      if (!mountedRef.current) return;
      const kind = noteErrorKind(error);
      if (kind === "gone" || kind === "forbidden") {
        showErrorToast(GONE_MESSAGE);
        navigation.goBack();
        return;
      }
      logger.error("Failed to load note shares", error);
      setLoadError(describeError(error));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  const reloadShares = async () => {
    const res = await getNoteSharesApi(noteId);
    if (mountedRef.current) setShares(res.data.shares ?? []);
  };

  const handleTogglePermission = async (
    userId: string,
    permission: NotePermission,
  ) => {
    const previous = shares.find((s) => s.user._id === userId)?.permission;
    if (!previous || previous === permission) return;
    if (!beginBusy()) return;

    setShares((prev) =>
      prev.map((s) => (s.user._id === userId ? { ...s, permission } : s)),
    );
    try {
      const res = await upsertNoteSharesApi(noteId, [{ userId, permission }]);
      if (res.data?.note) dispatch(upsertNote(res.data.note));
    } catch (error) {
      if (mountedRef.current) {
        setShares((prev) =>
          prev.map((s) =>
            s.user._id === userId ? { ...s, permission: previous } : s,
          ),
        );
      }
      if (!handleGone(error)) showErrorToast(describeError(error));
    } finally {
      endBusy();
    }
  };

  const handleRemove = (userId: string, name: string) => {
    if (busyRef.current) return;
    Alert.alert(`Stop sharing with ${name}?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (!beginBusy()) return;
          try {
            const res = await revokeNoteShareApi(noteId, userId);
            if (mountedRef.current) {
              setShares((prev) => prev.filter((s) => s.user._id !== userId));
            }
            showSuccessToast("Access removed");
            // The revoke response may not carry the note; the editor refetches
            // on focus, so the dispatch is only done when we have it.
            if (res?.data?.note) dispatch(upsertNote(res.data.note));
            try {
              await reloadShares();
            } catch (reloadError) {
              logger.error("Failed to refresh shares", reloadError);
            }
          } catch (error) {
            if (!handleGone(error)) showErrorToast(describeError(error));
          } finally {
            endBusy();
          }
        },
      },
    ]);
  };

  const handleRemoveAll = () => {
    if (busyRef.current) return;
    Alert.alert(
      "Stop sharing with everyone?",
      "Everyone listed here will lose access to this note.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop sharing",
          style: "destructive",
          onPress: async () => {
            if (!beginBusy()) return;
            try {
              const res = await revokeAllNoteSharesApi(noteId);
              if (mountedRef.current) setShares([]);
              if (res?.data?.note) dispatch(upsertNote(res.data.note));
            } catch (error) {
              if (!handleGone(error)) showErrorToast(describeError(error));
            } finally {
              endBusy();
            }
          },
        },
      ],
    );
  };

  const handleAddPeople = async (ids: string[] | null) => {
    if (!ids || ids.length === 0) return;
    if (!beginBusy()) return;
    setPickerVisible(false);
    try {
      const res = await upsertNoteSharesApi(
        noteId,
        ids.map((id) => ({ userId: id, permission: "view" as NotePermission })),
      );
      if (res.data?.note) dispatch(upsertNote(res.data.note));
      showSuccessToast("Shared");
      try {
        await reloadShares();
      } catch (reloadError) {
        logger.error("Failed to refresh shares", reloadError);
      }
    } catch (error) {
      if (!handleGone(error)) showErrorToast(describeError(error));
    } finally {
      endBusy();
    }
  };

  const header = (
    <View style={[styles.header, { borderBottomColor: colors.separator }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs.xl }]}>
        Share note
      </Text>
      <View style={styles.headerRight}>
        {busy ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            accessibilityLabel="Saving changes"
          />
        ) : null}
      </View>
    </View>
  );

  if (loading || loadError) {
    return (
      <SafeAreaWrapper edges={["top"]}>
        {header}
        <View style={styles.centered}>
          {loadError ? (
            <>
              <Ionicons
                name="cloud-offline-outline"
                size={44}
                color={colors.textTertiary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginTop: 12,
                  marginHorizontal: 32,
                }}
              >
                {loadError}
              </Text>
              <TouchableOpacity
                onPress={load}
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Retry loading share settings"
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              accessibilityLabel="Loading share settings"
            />
          )}
        </View>
      </SafeAreaWrapper>
    );
  }

  const renderToggle = (share: INoteShare) => {
    const options: { value: NotePermission; label: string }[] = [
      { value: "view", label: "View" },
      { value: "edit", label: "Edit" },
    ];
    return (
      <View
        style={[
          styles.segmented,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        {options.map((opt) => {
          const active = share.permission === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.segment,
                active && { backgroundColor: colors.primary },
              ]}
              onPress={() => handleTogglePermission(share.user._id, opt.value)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`${opt.label} access for ${share.user.name}`}
              accessibilityState={{ selected: active, disabled: busy }}
            >
              <Text
                style={{
                  fontSize: fs.xs,
                  fontWeight: "600",
                  color: active ? "#fff" : colors.textSecondary,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaWrapper edges={["top"]}>
      {header}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text
          style={[styles.explainer, { color: colors.textSecondary, fontSize: fs.sm }]}
        >
          Only the people listed here can see this note.
        </Text>

        {shares.length === 0 ? (
          <View
            style={[styles.emptyCard, { backgroundColor: colors.surface }]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={22}
              color={colors.textTertiary}
            />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fs.md,
                flex: 1,
              }}
            >
              Private — only you can see this note.
            </Text>
          </View>
        ) : (
          <View style={[styles.list, { backgroundColor: colors.surface }]}>
            {shares.map((share, index) => (
              <View
                key={share.user._id}
                style={[
                  styles.row,
                  index < shares.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  },
                ]}
              >
                <Avatar
                  uri={share.user.avatar}
                  name={share.user.name}
                  size={40}
                />
                <Text
                  style={[styles.name, { color: colors.text, fontSize: fs.md }]}
                  numberOfLines={1}
                >
                  {share.user.name}
                </Text>
                {renderToggle(share)}
                <TouchableOpacity
                  onPress={() => handleRemove(share.user._id, share.user.name)}
                  disabled={busy}
                  style={[styles.removeButton, busy && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Stop sharing with ${share.user.name}`}
                  accessibilityState={{ disabled: busy }}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={colors.danger}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          disabled={busy}
          style={[
            styles.addButton,
            { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add people"
          accessibilityState={{ disabled: busy }}
        >
          <Ionicons name="person-add-outline" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: fs.md }}>
            Add people
          </Text>
        </TouchableOpacity>

        {shares.length > 0 ? (
          <TouchableOpacity
            onPress={handleRemoveAll}
            disabled={busy}
            style={[styles.stopAll, busy && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Stop sharing with everyone"
            accessibilityState={{ disabled: busy }}
          >
            <Text
              style={{
                color: colors.danger,
                fontWeight: "600",
                fontSize: fs.md,
              }}
            >
              Stop sharing with everyone
            </Text>
          </TouchableOpacity>
        ) : null}

        <Text
          style={[styles.footnote, { color: colors.textTertiary, fontSize: fs.xs }]}
        >
          Person labels don't give access.
        </Text>
      </ScrollView>

      <FriendPickerModal
        visible={pickerVisible}
        mode="multi"
        title="Share with"
        friends={friends}
        excludeIds={shares.map((s) => s.user._id)}
        confirmLabel="Share"
        hint="New people get view-only access. You can change it here."
        onSelect={handleAddPeople}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontWeight: "600",
  },
  headerRight: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },
  explainer: {
    lineHeight: 20,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  list: {
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  name: {
    flex: 1,
    fontWeight: "500",
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  stopAll: {
    alignItems: "center",
    paddingVertical: 8,
  },
  footnote: {
    textAlign: "center",
    marginTop: 8,
  },
});

export default NoteShareScreen;
