import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper } from "../../components/ui";
import { useAppDispatch, useAppSelector } from "../../store";
import {
  setNotes,
  appendNotes,
  setNotesFilter,
  setNotesLoading,
} from "../../store/slices/notesSlice";
import { listNotesApi, getNoteLabelsApi } from "../../api/notesApi";
import { describeError } from "../../api/axios";
import { logger } from "../../utils/logger";
import {
  createRequestGate,
  isLabelFilterStale,
  sameNotesFilter,
} from "../../utils/notes";
import type { INote, INoteLabel, NoteScope } from "../../types";
import NoteCard from "./components/NoteCard";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const SCOPES: { key: NoteScope; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "shared", label: "Shared with me" },
];

const NotesHomeScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();
  const { items, nextCursor, hasMore, loading, scope, label, q } =
    useAppSelector((state) => state.notes);

  const [searchText, setSearchText] = useState(q);
  const [labels, setLabels] = useState<INoteLabel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<{
    message: string;
    kind: "first" | "more";
  } | null>(null);

  // Ids are issued per page-1 fetch. Responses carrying an older id (a
  // previous filter, or a pagination started before a refetch) are dropped,
  // and closing the gate on unmount drops anything still in flight at logout
  // (MainTabs unmounts and Redux is reset) so it cannot write into the new store.
  const gate = useRef(createRequestGate()).current;
  // Same idea for the label list, so a slow /labels response cannot apply a
  // stale-label reset against a filter the user has already moved on from.
  const labelGate = useRef(createRequestGate()).current;
  // Id of the latest page-1 fetch; loadMore pairs itself with it.
  const listId = useRef(0);
  const loadingMoreRef = useRef(false);
  // The filter the rows currently in the store were fetched with.
  const fetchedFilter = useRef<{
    scope: NoteScope;
    label: string | null;
    q: string;
  } | null>(null);

  useEffect(
    () => () => {
      gate.close();
      labelGate.close();
    },
    [gate, labelGate],
  );

  // Debounced search -> store.
  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === q) return;
    const t = setTimeout(
      () => dispatch(setNotesFilter({ q: trimmed })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchText, q, dispatch]);

  const fetchFirstPage = useCallback(async () => {
    const id = gate.next();
    listId.current = id;
    setError(null);
    const filter = { scope, label, q };
    // A new filter must not keep showing rows fetched under the old one (or
    // leave them there if this fetch fails). A same-filter refresh keeps them.
    if (
      fetchedFilter.current &&
      !sameNotesFilter(fetchedFilter.current, filter)
    ) {
      dispatch(setNotes({ notes: [], nextCursor: null, hasMore: true }));
      fetchedFilter.current = null;
    }
    dispatch(setNotesLoading(true));
    try {
      const res = await listNotesApi({
        scope,
        label: label ?? undefined,
        q: q || undefined,
        limit: PAGE_SIZE,
      });
      if (!gate.isCurrent(id)) return;
      fetchedFilter.current = filter;
      dispatch(
        setNotes({
          notes: res.data.notes,
          nextCursor: res.data.nextCursor,
          hasMore: res.data.hasMore,
        }),
      );
    } catch (e) {
      if (!gate.isCurrent(id)) return;
      logger.error("Failed to fetch notes:", e);
      dispatch(setNotesLoading(false));
      setError({ message: describeError(e), kind: "first" });
    }
  }, [dispatch, gate, scope, label, q]);

  const fetchLabels = useCallback(async () => {
    const id = labelGate.next();
    try {
      const res = await getNoteLabelsApi();
      if (!labelGate.isCurrent(id)) return;
      const next = res.data.labels ?? [];
      setLabels(next);
      // The labelled person may have vanished (their last note was cleared or
      // deleted); a filter on them would otherwise hide every note.
      if (isLabelFilterStale(label, next)) {
        dispatch(setNotesFilter({ label: null }));
      }
    } catch (e) {
      // Labels are a filter convenience; the list itself still works without
      // them, so a failure here is logged rather than blocking the screen.
      logger.error("Failed to fetch note labels:", e);
    }
  }, [dispatch, labelGate, label]);

  // Runs on focus and again whenever scope/label/q change (the callback
  // identity changes), so there is one refetch path for all of them.
  useFocusEffect(
    useCallback(() => {
      void fetchFirstPage();
      void fetchLabels();
    }, [fetchFirstPage, fetchLabels]),
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loading || loadingMoreRef.current) return;
    const id = listId.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await listNotesApi({
        scope,
        label: label ?? undefined,
        q: q || undefined,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      if (!gate.isCurrent(id)) return;
      dispatch(
        appendNotes({
          notes: res.data.notes,
          nextCursor: res.data.nextCursor,
          hasMore: res.data.hasMore,
        }),
      );
    } catch (e) {
      if (!gate.isCurrent(id)) return;
      logger.error("Failed to fetch more notes:", e);
      setError({ message: describeError(e), kind: "more" });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [dispatch, gate, hasMore, nextCursor, loading, scope, label, q]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFirstPage(), fetchLabels()]);
    setRefreshing(false);
  };

  const onRetry = () => {
    if (error?.kind === "more") void loadMore();
    else void fetchFirstPage();
  };

  const selectScope = (next: NoteScope) => {
    if (next === scope) return;
    dispatch(
      next === "shared"
        ? setNotesFilter({ scope: next, label: null })
        : setNotesFilter({ scope: next }),
    );
  };

  const selectLabel = (next: string | null) => {
    if (next === label) return;
    dispatch(setNotesFilter({ label: next }));
  };

  const renderItem = useCallback(
    ({ item }: { item: INote }) => (
      <NoteCard
        note={item}
        onPress={() => navigation.navigate("NoteEditor", { noteId: item._id })}
      />
    ),
    [navigation],
  );

  const renderChip = (
    key: string,
    text: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderColor: active ? colors.primary : colors.separator,
        },
      ]}
    >
      <Text
        style={{
          color: active ? "#fff" : colors.text,
          fontSize: fs.sm,
          fontWeight: "500",
        }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (error?.kind === "first") {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color={colors.danger}
          />
          <Text
            style={[styles.errorText, { color: colors.text, fontSize: fs.md }]}
          >
            {error.message}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Text style={[styles.retryText, { fontSize: fs.md }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    let title = "No notes yet";
    let subtitle = "Tap + to write your first note.";
    let icon: keyof typeof Ionicons.glyphMap = "document-text-outline";
    if (q || label) {
      title = "No matches";
      subtitle = "Try a different search or label.";
      icon = "search-outline";
    } else if (scope === "shared") {
      title = "Nothing shared with you yet";
      subtitle = "Notes your friends share with you will show up here.";
      icon = "people-outline";
    }

    return (
      <View style={styles.emptyState}>
        <View
          style={[
            styles.emptyIconContainer,
            { backgroundColor: colors.primarySurface },
          ]}
        >
          <Ionicons name={icon} size={48} color={colors.primary} />
        </View>
        <Text
          style={[styles.emptyTitle, { color: colors.text, fontSize: fs.xl }]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.emptySubtitle,
            { color: colors.textTertiary, fontSize: fs.md },
          ]}
        >
          {subtitle}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return null;
  };

  // label !== null keeps the row (and its "Everyone" chip) available even when
  // /labels came back empty, so an active label filter can always be cleared.
  const showLabelChips =
    scope !== "shared" && (labels.length > 0 || label !== null);
  // Keep the previous list visible when a refetch fails; only show a banner.
  const showErrorBanner = !!error && (error.kind === "more" || items.length > 0);

  return (
    <SafeAreaWrapper edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs.xxl }]}
        >
          Notes
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontSize: fs.md }]}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search notes"
            placeholderTextColor={colors.inputPlaceholder}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchText("")}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scope segmented control */}
      <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
        {SCOPES.map((s) => {
          const active = scope === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.segment,
                active && { backgroundColor: colors.primary },
              ]}
              onPress={() => selectScope(s.key)}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  color: active ? "#fff" : colors.textSecondary,
                  fontSize: fs.sm,
                  fontWeight: "600",
                }}
                numberOfLines={1}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Label chips */}
      {showLabelChips && (
        <View style={styles.chipsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
            keyboardShouldPersistTaps="handled"
          >
            {renderChip("everyone", "Everyone", label === null, () =>
              selectLabel(null),
            )}
            {renderChip("none", "No label", label === "none", () =>
              selectLabel("none"),
            )}
            {labels.map((l) =>
              renderChip(
                l.user._id,
                `${l.user.name} (${l.count})`,
                label === l.user._id,
                () => selectLabel(l.user._id),
              ),
            )}
          </ScrollView>
        </View>
      )}

      {/* Inline error (list stays visible underneath) */}
      {showErrorBanner && error && (
        <View
          style={[styles.banner, { backgroundColor: colors.danger + "20" }]}
        >
          <Text
            style={[styles.bannerText, { color: colors.danger, fontSize: fs.sm }]}
            numberOfLines={2}
          >
            {error.message}
          </Text>
          <TouchableOpacity onPress={onRetry} activeOpacity={0.8}>
            <Text
              style={[styles.bannerRetry, { color: colors.danger, fontSize: fs.sm }]}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notes list */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[
          styles.listContainer,
          items.length === 0 && styles.emptyContainer,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={error ? undefined : loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
      />

      {/* FAB - New note */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate("NoteEditor", {})}
        activeOpacity={0.8}
        accessibilityLabel="New note"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
  },
  segmented: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 3,
    borderRadius: 10,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  chipsWrap: {
    marginTop: 12,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerText: {
    flex: 1,
  },
  bannerRetry: {
    fontWeight: "700",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 96,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  errorText: {
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
  footer: {
    paddingVertical: 12,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default NotesHomeScreen;
