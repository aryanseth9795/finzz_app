import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Avatar } from "../../components/ui";
import ChatCard from "../../components/ChatCard";
import { getUserChatsApi } from "../../api/chatApi";
import { getPendingRequestsApi } from "../../api/friendApi";
import { useAppSelector, useAppDispatch } from "../../store";
import { setChats, setLoading } from "../../store/slices/chatSlice";
import { setIncomingRequests } from "../../store/slices/friendSlice";
import { cacheManager, CACHE_KEYS } from "../../utils/cacheManager";
import { CACHE_DURATION } from "../../constants/api";
import { IChat } from "../../types";

const HomeScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();

  const { chats, loading } = useAppSelector((state) => state.chat);
  const { user } = useAppSelector((state) => state.auth);
  const { incomingRequests } = useAppSelector((state) => state.friend);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) dispatch(setLoading(true));

        // Try cache first
        const cached = await cacheManager.get<IChat[]>(
          CACHE_KEYS.CHATS,
          CACHE_DURATION.CHATS,
        );
        if (cached && showLoader) {
          dispatch(setChats(cached));
        }

        // Fetch fresh data
        const response = await getUserChatsApi();
        console.log(response.data);
        const freshChats = response.data.chats || response.data;
        dispatch(setChats(freshChats));
        await cacheManager.set(CACHE_KEYS.CHATS, freshChats);
      } catch (error) {
        console.error("Failed to fetch chats:", error);
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch],
  );

  const fetchFriendRequests = useCallback(async () => {
    try {
      const response = await getPendingRequestsApi();
      dispatch(setIncomingRequests(response.data.incoming || []));
    } catch (error) {
      console.log("Failed to fetch requests", error);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchChats();
    fetchFriendRequests();
  }, [fetchChats, fetchFriendRequests]);

  // Re-fetch when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchChats(false);
    });
    return unsubscribe;
  }, [navigation, fetchChats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchChats(false);
    setRefreshing(false);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View
        style={[styles.emptyIcon, { backgroundColor: colors.primarySurface }]}
      >
        <Ionicons name="chatbubbles-outline" size={48} color={colors.primary} />
      </View>
      <Text
        style={[styles.emptyTitle, { color: colors.text, fontSize: fs.xl }]}
      >
        No chats yet
      </Text>
      <Text
        style={[
          styles.emptySubtitle,
          { color: colors.textTertiary, fontSize: fs.md },
        ]}
      >
        Add friends to start tracking{"\n"}transactions together
      </Text>
    </View>
  );

  return (
    <SafeAreaWrapper edges={["top"]}>
      {/* Header */}
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <View style={styles.headerLeft}>
          <Text
            style={[
              styles.headerLogo,
              { color: colors.primary, fontSize: 28 }, // Branding size
            ]}
          >
            Finzz
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate("AddFriend")}
            style={[
              styles.headerButton,
              { backgroundColor: colors.surfaceSecondary }, // Subtle background
            ]}
          >
            <Ionicons name="person-add-outline" size={22} color={colors.text} />
            {/* Notification Badge */}
            {incomingRequests.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {incomingRequests.length > 9 ? "9+" : incomingRequests.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Account")}
            activeOpacity={0.8}
          >
            <Avatar uri={user?.avatar} name={user?.name || "U"} size={40} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat List */}
      {loading && chats.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ChatCard
              chat={item}
              currentUserId={user?._id || ""}
              onPress={() =>
                navigation.navigate("ChatScreen", {
                  chatId: item._id,
                  chat: item,
                })
              }
            />
          )}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={
            chats.length === 0 ? styles.emptyList : undefined
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12, // Reduced vertical padding
    paddingTop: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerLogo: {
    fontWeight: "900", // Heavy weight for logo
    letterSpacing: -1,
    fontStyle: "italic", // Optional flair
  },
  headerTitle: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16, // Increased gap
  },
  headerButton: {
    width: 44, // Slightly larger touch target
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
    lineHeight: 24,
  },
  emptyList: {
    flexGrow: 1,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444", // Red-500
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  badgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
});

export default HomeScreen;
