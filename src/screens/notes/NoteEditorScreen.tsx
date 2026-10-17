import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, usePreventRemove } from "@react-navigation/native";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { SafeAreaWrapper } from "../../components/ui";
import Avatar from "../../components/ui/Avatar";
import { describeError } from "../../api/axios";
import { getFriendsListApi } from "../../api/friendApi";
import {
  getNoteApi,
  createNoteApi,
  updateNoteApi,
  setNoteLabelApi,
  deleteNoteApi,
  revokeNoteShareApi,
} from "../../api/notesApi";
import { store, useAppDispatch, useAppSelector } from "../../store";
import { upsertNote, removeNote } from "../../store/slices/notesSlice";
import {
  shouldIgnoreRouteNoteId,
  NOTE_TITLE_MAX,
  NOTE_BODY_MAX,
  canEditNote,
  canManageNote,
  isNoteBlank,
  isNoteDirty,
  noteFooter,
  noteErrorKind,
  conflictNote,
} from "../../utils/notes";
import FriendPickerModal from "./components/FriendPickerModal";
import type { IFriend, INote, INotePerson, NoteRole } from "../../types";

const LABEL_HINT = "Labels are only visible to you. They don't share the note.";
const ICON_BTN = 36;

// "gone" = the note no longer exists / is no longer shared. It exists so a
// stranded editor (opened straight from a push, nothing to go back to) never
// sits on the loading spinner if navigating away fails.
type Status = "loading" | "error" | "ready" | "gone";

/** The counter only appears once a field is within 10% of its limit. */
const nearLimit = (length: number, max: number) => length >= max * 0.9;

/** True while the logged-in account is still the one this screen was opened by. */
const sameSession = (uid: string): boolean =>
  !!uid && store.getState().auth.user?._id === uid;

const NoteEditorScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const { showSuccessToast, showErrorToast } = useToast();
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user?._id) ?? "";

  const paramNoteId: string | undefined = route.params?.noteId;
  // The note this screen owns (see shouldIgnoreRouteNoteId). A new draft owns
  // `null` from the start; an id screen claims its note once it has loaded.
  const ownedIdRef = useRef<string | null | undefined>(
    paramNoteId ? undefined : null,
  );
  const routeNoteId: string | undefined = shouldIgnoreRouteNoteId(
    ownedIdRef.current,
    paramNoteId,
  )
    ? (ownedIdRef.current ?? undefined)
    : paramNoteId;

  // Role hint from the list row, used only when the full note failed to load.
  const listRole = useAppSelector((s) =>
    routeNoteId
      ? s.notes.items.find((n) => n._id === routeNoteId)?.role
      : undefined,
  );

  // `note` is the saved baseline (server copy). null = a new, unsaved draft.
  const [note, setNote] = useState<INote | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>(routeNoteId ? "loading" : "ready");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Label picked before a first save (a new note has no server copy yet).
  const [newLabel, setNewLabel] = useState<INotePerson | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [friends, setFriends] = useState<IFriend[]>([]);

  // Leaving: state (not just a ref) so usePreventRemove's condition is false
  // on a committed render before the navigation action is dispatched.
  const [leaving, setLeaving] = useState(false);
  const pendingActionRef = useRef<any>(null);

  const mountedRef = useRef(true);
  // Account this screen was opened by. A save/load that resolves after logout
  // must not write into the freshly reset store (the next account would see it).
  const sessionUidRef = useRef(me);
  const savingRef = useRef(false);
  const busyRef = useRef(false); // delete / leave / label in flight
  const friendsStateRef = useRef<"idle" | "loading" | "loaded">("idle");
  const loadedRef = useRef(false);
  const reqRef = useRef(0);
  const noteRef = useRef<INote | null>(null);
  const draftRef = useRef({ title: "", body: "" });

  noteRef.current = note;
  draftRef.current = { title, body };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const role: NoteRole = note?.role ?? listRole ?? "owner";
  const isOwner = canManageNote(role);
  const canEdit = canEditNote(role);
  const isNew = !note;
  const noteId = note?._id ?? routeNoteId;

  const saved = useMemo(
    () => ({ title: note?.title ?? "", body: note?.body ?? "" }),
    [note],
  );
  const draft = useMemo(() => ({ title, body }), [title, body]);
  const dirty = status === "ready" && canEdit && isNoteDirty(saved, draft);
  const canSave = dirty && !isNoteBlank(draft) && !saving;

  // ---------------------------------------------------------------- leaving

  usePreventRemove(dirty && !leaving, ({ data }) => {
    Alert.alert("Discard changes?", "Your unsaved edits will be lost.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          pendingActionRef.current = data.action;
          setLeaving(true);
        },
      },
    ]);
  });

  // Declared after usePreventRemove so its effect has run for the new value.
  /**
   * Go back, or, when this editor is the only route in the Notes stack (opened
   * straight from a push), replace it with the list. `navigation.canGoBack()`
   * is not usable here: it also reports true when only a parent navigator (the
   * tabs) can go back, and GO_BACK would then bubble up and jump to Chats.
   */
  const exit = useCallback(() => {
    const st = navigation.getState?.();
    if ((st?.index ?? 0) > 0) navigation.goBack();
    else navigation.replace("NotesHome");
  }, [navigation]);

  useEffect(() => {
    if (!leaving) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) navigation.dispatch(action);
    else exit();
  }, [leaving, navigation, exit]);

  const leave = useCallback(() => {
    pendingActionRef.current = null;
    setLeaving(true);
  }, []);

  const handleAccessLost = useCallback(
    (r: NoteRole) => {
      showErrorToast(
        r === "owner"
          ? "This note no longer exists"
          : "This note is no longer shared with you",
      );
      const id = noteRef.current?._id ?? routeNoteId;
      if (id && sameSession(sessionUidRef.current)) dispatch(removeNote(id));
      // Never leave the screen on a spinner, even if navigation fails.
      reqRef.current++; // drop any load still in flight
      if (mountedRef.current) setStatus("gone");
      leave();
    },
    [dispatch, leave, routeNoteId, showErrorToast],
  );

  /** Shared error handling. Returns true when the error ended the screen. */
  const handleError = useCallback(
    (e: unknown, r: NoteRole): boolean => {
      const kind = noteErrorKind(e);
      if (kind === "gone" || (kind === "forbidden" && r !== "owner")) {
        handleAccessLost(r);
        return true;
      }
      showErrorToast(describeError(e));
      return false;
    },
    [handleAccessLost, showErrorToast],
  );

  // ---------------------------------------------------------------- loading

  const loadFull = useCallback(async () => {
    if (!routeNoteId) return;
    const req = ++reqRef.current;
    setStatus("loading");
    setLoadError(null);
    try {
      const res = await getNoteApi(routeNoteId);
      if (!mountedRef.current || req !== reqRef.current) return;
      const n: INote = res.data.note;
      loadedRef.current = true;
      ownedIdRef.current = n._id;
      setNote(n);
      setTitle(n.title);
      setBody(n.body);
      setStatus("ready");
    } catch (e) {
      if (!mountedRef.current || req !== reqRef.current) return;
      const kind = noteErrorKind(e);
      if (kind === "gone" || kind === "forbidden") {
        handleAccessLost(listRole ?? "viewer");
        return;
      }
      setLoadError(describeError(e));
      setStatus("error");
    }
  }, [routeNoteId, listRole, handleAccessLost]);

  useEffect(() => {
    if (!routeNoteId) return;
    // After a first save setParams({ noteId }) lands here with the note
    // already in state; no need to fetch it again.
    if (noteRef.current?._id === routeNoteId) return;
    loadFull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeNoteId]);

  // Returning from the share screen: pick up sharedWith (and anything else
  // that changed) without trampling what the user is typing.
  useFocusEffect(
    useCallback(() => {
      const current = noteRef.current;
      if (!current || !loadedRef.current || savingRef.current) return;
      const req = ++reqRef.current;
      (async () => {
        try {
          const res = await getNoteApi(current._id);
          if (!mountedRef.current || req !== reqRef.current) return;
          const fresh: INote = res.data.note;
          const base = noteRef.current;
          if (!base) return;
          const isDirty = isNoteDirty(
            { title: base.title, body: base.body },
            draftRef.current,
          );
          if (isDirty) {
            // Keep the baseline version/text: bumping the version here would
            // silently turn a real conflict into an overwrite on the next save.
            setNote({
              ...base,
              role: fresh.role,
              sharedWith: fresh.sharedWith,
              personLabel: fresh.personLabel,
            });
          } else {
            setNote(fresh);
            setTitle(fresh.title);
            setBody(fresh.body);
          }
          if (sameSession(sessionUidRef.current)) dispatch(upsertNote(fresh));
        } catch (e) {
          if (!mountedRef.current || req !== reqRef.current) return;
          // A failed background refresh is only worth surfacing when access is gone.
          const kind = noteErrorKind(e);
          if (kind === "gone" || (kind === "forbidden" && current.role !== "owner")) {
            handleAccessLost(current.role);
          }
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // ------------------------------------------------------------------- save

  const persist = useCallback(
    async (base: INote | null, t: string, b: string) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      try {
        const res = base
          ? await updateNoteApi(base._id, { title: t, body: b, version: base.version })
          : await createNoteApi({
              title: t,
              body: b,
              personLabel: newLabel?._id ?? null,
            });
        const savedNote: INote = res.data.note;
        // Not gated on mountedRef: leaving mid-save must still refresh the
        // list. Gated on the session so a save finishing after logout cannot
        // leak into the next account.
        if (sameSession(sessionUidRef.current)) dispatch(upsertNote(savedNote));
        if (!mountedRef.current) return;
        setNote(savedNote);
        // Adopt any normalisation the server applied, unless the user has
        // already typed something else while the request was in flight.
        if (draftRef.current.title === t) setTitle(savedNote.title);
        if (draftRef.current.body === b) setBody(savedNote.body);
        if (!base) {
          // Claim the id first so our own setParams is not mistaken for a
          // foreign one. setParams targets this route's key, so the screen is
          // not remounted and getId only matters for later NAVIGATE/PUSH.
          ownedIdRef.current = savedNote._id;
          navigation.setParams({ noteId: savedNote._id });
        }
        loadedRef.current = true;
        showSuccessToast("Saved");
      } catch (e) {
        if (!mountedRef.current) return;
        const r = base?.role ?? "owner";
        if (noteErrorKind(e) === "conflict") {
          const latest = conflictNote(e);
          if (latest) {
            promptConflict(latest, t, b);
          } else {
            showErrorToast(describeError(e));
          }
        } else {
          handleError(e, r);
        }
      } finally {
        savingRef.current = false;
        if (mountedRef.current) setSaving(false);
      }
    },
    // promptConflict is a hoisted function declaration below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, navigation, newLabel, showSuccessToast, showErrorToast, handleError],
  );

  function promptConflict(latest: INote, t: string, b: string) {
    Alert.alert(
      "Note changed",
      `${latest.lastEditedBy?.name ?? "Someone"} changed this note while you were editing.`,
      [
        {
          text: "Load theirs",
          onPress: () => {
            if (sameSession(sessionUidRef.current)) dispatch(upsertNote(latest));
            if (!mountedRef.current) return;
            setNote(latest);
            setTitle(latest.title);
            setBody(latest.body);
          },
        },
        {
          text: "Keep mine",
          onPress: () => {
            if (!mountedRef.current) return;
            // Adopt their version (so the next save is accepted) but keep my text.
            setNote(latest);
            if (!isNoteDirty({ title: latest.title, body: latest.body }, { title: t, body: b })) {
              return;
            }
            persist(latest, t, b);
          },
        },
      ],
      { cancelable: false },
    );
  }

  const handleSave = () => {
    if (!canSave || savingRef.current) return;
    persist(note, title, body);
  };

  // ------------------------------------------------------------------ label

  const openLabelPicker = async () => {
    if (!isOwner) return;
    setPickerOpen(true);
    if (friendsStateRef.current !== "idle") return;
    friendsStateRef.current = "loading";
    try {
      const res = await getFriendsListApi();
      friendsStateRef.current = "loaded";
      if (mountedRef.current) setFriends(res.data.friends ?? []);
    } catch (e) {
      friendsStateRef.current = "idle";
      if (mountedRef.current) {
        setPickerOpen(false);
        showErrorToast(describeError(e));
      }
    }
  };

  const currentLabel: INotePerson | null = note
    ? (note.personLabel ?? null)
    : newLabel;

  const handleLabelSelect = async (ids: string[] | null) => {
    setPickerOpen(false);
    const id = ids?.[0] ?? null;
    if (id === (currentLabel?._id ?? null)) return;

    if (!note) {
      // Unsaved note: local only; it is sent with the create request.
      const f = friends.find((x) => x._id === id);
      setNewLabel(f ? { _id: f._id, name: f.name, avatar: f.avatar } : null);
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await setNoteLabelApi(note._id, id);
      const updated: INote = res.data.note;
      if (sameSession(sessionUidRef.current)) dispatch(upsertNote(updated));
      if (!mountedRef.current) return;
      // Metadata only: the draft and the baseline text/version stay as they are.
      setNote((prev) =>
        prev ? { ...prev, personLabel: updated.personLabel ?? null } : prev,
      );
    } catch (e) {
      if (mountedRef.current) handleError(e, note.role);
    } finally {
      busyRef.current = false;
    }
  };

  // ------------------------------------------------------- delete / leave

  const performDelete = async () => {
    if (!note || busyRef.current) return;
    busyRef.current = true;
    try {
      await deleteNoteApi(note._id);
      if (sameSession(sessionUidRef.current)) dispatch(removeNote(note._id));
      if (!mountedRef.current) return;
      showSuccessToast("Note deleted");
      leave();
    } catch (e) {
      if (mountedRef.current) handleError(e, note.role);
    } finally {
      busyRef.current = false;
    }
  };

  const performRemoveFromMine = async () => {
    if (!note || !me || busyRef.current) return;
    busyRef.current = true;
    try {
      await revokeNoteShareApi(note._id, me);
      if (sameSession(sessionUidRef.current)) dispatch(removeNote(note._id));
      if (!mountedRef.current) return;
      showSuccessToast("Removed from your notes");
      leave();
    } catch (e) {
      if (mountedRef.current) handleError(e, note.role);
    } finally {
      busyRef.current = false;
    }
  };

  const openMenu = () => {
    if (isOwner) {
      if (!note) return; // nothing to delete on an unsaved draft
      Alert.alert("Note options", undefined, [
        {
          text: "Delete note",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Delete note?",
              "Delete this note? It will also disappear for everyone it's shared with.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: performDelete },
              ],
            ),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    } else {
      Alert.alert("Note options", undefined, [
        {
          text: "Remove from my notes",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Remove from my notes?",
              "You won't be able to see this note unless it's shared with you again.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: performRemoveFromMine,
                },
              ],
            ),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const openShare = () => {
    if (!note) return;
    navigation.navigate("NoteShare", { noteId: note._id });
  };

  // ----------------------------------------------------------------- render

  const backButton = (
    <TouchableOpacity
      onPress={exit}
      style={styles.backButton}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </TouchableOpacity>
  );

  if (status !== "ready") {
    return (
      <SafeAreaWrapper edges={["top"]}>
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          {backButton}
          <Text
            style={[styles.headerTitle, { color: colors.text, fontSize: fs.lg }]}
          >
            Note
          </Text>
          <View style={{ width: ICON_BTN }} />
        </View>
        <View style={styles.center}>
          {status === "gone" ? (
            <>
              <Ionicons
                name="document-outline"
                size={44}
                color={colors.textTertiary}
              />
              <Text
                style={[
                  styles.centerText,
                  { color: colors.textSecondary, fontSize: fs.md },
                ]}
              >
                This note is no longer available.
              </Text>
              <TouchableOpacity
                onPress={exit}
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Back to notes"
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: fs.md }}>
                  Back to notes
                </Text>
              </TouchableOpacity>
            </>
          ) : status === "error" ? (
            <>
              <Ionicons
                name="cloud-offline-outline"
                size={44}
                color={colors.textTertiary}
              />
              <Text
                style={[
                  styles.centerText,
                  { color: colors.textSecondary, fontSize: fs.md },
                ]}
              >
                {loadError ?? "Could not load this note."}
              </Text>
              <TouchableOpacity
                onPress={loadFull}
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: fs.md }}>
                  Retry
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>
      </SafeAreaWrapper>
    );
  }

  const sharedCount = note?.sharedWith ?? 0;
  const ownerName = note?.owner?.name ?? "";

  return (
    <SafeAreaWrapper edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        {backButton}
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs.lg }]}
          numberOfLines={1}
        >
          {isNew ? "New note" : "Note"}
        </Text>
        <View style={styles.actions}>
          {canEdit ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.4 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: !canSave }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: fs.sm }}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
          {isOwner ? (
            <>
              <TouchableOpacity
                onPress={openLabelPicker}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Label with a friend"
              >
                <Ionicons
                  name={currentLabel ? "person" : "person-outline"}
                  size={22}
                  color={currentLabel ? colors.primary : colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openShare}
                disabled={isNew}
                style={[styles.iconButton, { opacity: isNew ? 0.4 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={
                  sharedCount > 0
                    ? `Share, shared with ${sharedCount}`
                    : "Share"
                }
                accessibilityHint={isNew ? "Save to share" : undefined}
                accessibilityState={{ disabled: isNew }}
              >
                <Ionicons
                  name={sharedCount > 0 ? "people" : "people-outline"}
                  size={22}
                  color={sharedCount > 0 ? colors.primary : colors.text}
                />
                {sharedCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.badgeText}>{sharedCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </>
          ) : null}
          {!isOwner || note ? (
            <TouchableOpacity
              onPress={openMenu}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {!isOwner && note ? (
          <View style={[styles.banner, { backgroundColor: colors.surface }]}>
            <Ionicons
              name={canEdit ? "create-outline" : "eye-outline"}
              size={16}
              color={colors.textSecondary}
            />
            <Text
              style={[
                styles.bannerText,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              {canEdit
                ? `Shared by ${ownerName} · you can edit`
                : `View only · shared by ${ownerName}`}
            </Text>
          </View>
        ) : null}

        <View style={styles.body}>
          <TextInput
            style={[styles.titleInput, { color: colors.text, fontSize: fs.xl }]}
            placeholder="Title"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={NOTE_TITLE_MAX}
            editable={canEdit}
            multiline={false}
            returnKeyType="next"
            accessibilityLabel="Note title"
          />
          {nearLimit(title.length, NOTE_TITLE_MAX) ? (
            <Text
              style={[
                styles.counter,
                { color: colors.textTertiary, fontSize: fs.xs },
              ]}
            >
              {`${title.length}/${NOTE_TITLE_MAX}`}
            </Text>
          ) : null}

          {isOwner && (currentLabel || isNew) ? (
            <View style={styles.chipRow}>
              {currentLabel ? (
                <TouchableOpacity
                  onPress={openLabelPicker}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Label: ${currentLabel.name}`}
                >
                  <Avatar
                    uri={currentLabel.avatar}
                    name={currentLabel.name}
                    size={18}
                  />
                  <Text
                    style={{ color: colors.text, fontSize: fs.sm }}
                    numberOfLines={1}
                  >
                    {currentLabel.name}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {isNew ? (
                <Text style={{ color: colors.textTertiary, fontSize: fs.xs }}>
                  Save to share
                </Text>
              ) : null}
            </View>
          ) : null}

          <TextInput
            style={[styles.bodyInput, { color: colors.text, fontSize: fs.md }]}
            placeholder={canEdit ? "Start typing…" : ""}
            placeholderTextColor={colors.textTertiary}
            value={body}
            onChangeText={setBody}
            maxLength={NOTE_BODY_MAX}
            editable={canEdit}
            multiline
            textAlignVertical="top"
            scrollEnabled
            accessibilityLabel="Note body"
          />
          {nearLimit(body.length, NOTE_BODY_MAX) ? (
            <Text
              style={[
                styles.counter,
                { color: colors.textTertiary, fontSize: fs.xs },
              ]}
            >
              {`${body.length}/${NOTE_BODY_MAX}`}
            </Text>
          ) : null}
        </View>

        {note ? (
          <Text
            style={[
              styles.footer,
              {
                color: colors.textTertiary,
                fontSize: fs.xs,
                borderTopColor: colors.separator,
              },
            ]}
          >
            {noteFooter(note, me, new Date())}
          </Text>
        ) : null}
      </KeyboardAvoidingView>

      <FriendPickerModal
        visible={pickerOpen}
        mode="single"
        title="Label with a friend"
        friends={friends}
        selectedId={currentLabel?._id ?? null}
        allowNone
        hint={LABEL_HINT}
        onSelect={handleLabelSelect}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconButton: {
    width: ICON_BTN,
    height: ICON_BTN,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    minWidth: 56,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  centerText: { textAlign: "center" },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerText: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  titleInput: {
    fontWeight: "700",
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: "70%",
  },
  bodyInput: {
    flex: 1,
    paddingVertical: 8,
    lineHeight: 22,
  },
  counter: {
    textAlign: "right",
    paddingVertical: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default NoteEditorScreen;
