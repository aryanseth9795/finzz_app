import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Avatar, Input, Button } from "../../components/ui";
import {
  searchByPhoneApi,
  sendFriendRequestApi,
  getPendingRequestsApi,
  acceptFriendRequestApi,
  rejectFriendRequestApi,
} from "../../api/friendApi";
import { useAppSelector, useAppDispatch } from "../../store";
import {
  setIncomingRequests,
  setSentRequests,
  removeIncomingRequest,
  setSearchResult,
} from "../../store/slices/friendSlice";
import { setChats } from "../../store/slices/chatSlice";
import { cacheManager, CACHE_KEYS } from "../../utils/cacheManager";
import { getUserChatsApi } from "../../api/chatApi";
import { IFriendRequest } from "../../types";

const FriendsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();

  const { incomingRequests, sentRequests, searchResult } = useAppSelector(
    (state) => state.friend,
  );
  const [searchPhone, setSearchPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"incoming" | "sent">("incoming");

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getPendingRequestsApi();
      const data = response.data;
      dispatch(setIncomingRequests(data.incoming || []));
      dispatch(setSentRequests(data.sent || []));
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSearch = async () => {
    if (!searchPhone.trim()) return;
    setSearching(true);
    try {
      const response = await searchByPhoneApi(searchPhone.trim());
      dispatch(setSearchResult({ exists: true, user: response.data.user }));
    } catch (error: any) {
      if (error?.response?.status === 404) {
        dispatch(setSearchResult({ exists: false }));
      } else {
        Alert.alert("Error", error?.response?.data?.message || "Search failed");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (toUserId: string) => {
    try {
      await sendFriendRequestApi(toUserId);
      Alert.alert("Success", "Friend request sent!");
      dispatch(setSearchResult(null));
      setSearchPhone("");
      fetchRequests();
      await cacheManager.remove(CACHE_KEYS.FRIENDS);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to send request",
      );
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await acceptFriendRequestApi(requestId);
      dispatch(removeIncomingRequest(requestId));
      await cacheManager.remove(CACHE_KEYS.FRIENDS);
      await cacheManager.remove(CACHE_KEYS.CHATS);

      // Immediately refresh chats in Redux so HomeScreen shows the new chat
      const response = await getUserChatsApi();
      const freshChats = response.data.chats || response.data;
      dispatch(setChats(freshChats));
      await cacheManager.set(CACHE_KEYS.CHATS, freshChats);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to accept",
      );
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectFriendRequestApi(requestId);
      dispatch(removeIncomingRequest(requestId));
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to reject",
      );
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const renderRequestCard = ({ item }: { item: IFriendRequest }) => {
    const isIncoming = activeTab === "incoming";
    const person = isIncoming ? item.from : item.to;

    return (
      <View
        style={[
          styles.requestCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            // Shadow for card
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          },
        ]}
      >
        <Avatar uri={person.avatar} name={person.name} size={50} />
        <View style={styles.requestInfo}>
          <Text
            style={[
              styles.requestName,
              { color: colors.text, fontSize: fs.md },
            ]}
          >
            {person.name}
          </Text>
          <Text
            style={[
              styles.requestPhone,
              { color: colors.textTertiary, fontSize: fs.sm },
            ]}
          >
            {person.phone}
          </Text>
        </View>
        {isIncoming && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              onPress={() => handleAccept(item._id)}
              style={[styles.actionBtn, { backgroundColor: colors.success }]}
            >
              <Ionicons name="checkmark" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleReject(item._id)}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.surfaceSecondary }, // Subtle reject
              ]}
            >
              <Ionicons name="close" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
        {!isIncoming && (
          <View
            style={[
              styles.pendingBadge,
              { backgroundColor: colors.warning + "20" }, // 20% opacity
            ]}
          >
            <Text
              style={[
                styles.pendingText,
                { color: colors.warning, fontSize: fs.xs },
              ]}
            >
              Pending
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaWrapper edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs.xxl }]}
        >
          Friends
        </Text>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={colors.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                value={searchPhone}
                onChangeText={(text) => {
                  setSearchPhone(text);
                  if (searchResult) dispatch(setSearchResult(null));
                }}
                placeholder="Search phone number..."
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                style={[styles.textInput, { color: colors.text }]}
              />
            </View>
          </View>
          <Button
            title="Search"
            onPress={handleSearch}
            loading={searching}
            size="md"
            style={{
              marginTop: 0,
              height: 50,
              paddingHorizontal: 24,
              borderRadius: 16,
            }}
          />
        </View>

        {/* Search Result */}
        {searchResult && (
          <View
            style={[
              styles.searchResultCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {searchResult.exists && searchResult.user ? (
              <View style={styles.searchResultContent}>
                <Avatar
                  uri={searchResult.user.avatar}
                  name={searchResult.user.name}
                  size={48}
                />
                <View style={styles.searchResultInfo}>
                  <Text style={[styles.requestName, { color: colors.text }]}>
                    {searchResult.user.name}
                  </Text>
                  <Text
                    style={[
                      styles.requestPhone,
                      { color: colors.textTertiary },
                    ]}
                  >
                    {searchResult.user.phone}
                  </Text>
                </View>
                <Button
                  title="Add Friend"
                  onPress={() => handleSendRequest(searchResult.user!._id)}
                  size="sm"
                  variant="primary"
                />
              </View>
            ) : (
              <View style={styles.notFoundContainer}>
                <Ionicons
                  name="person-remove-outline"
                  size={24}
                  color={colors.textTertiary}
                />
                <Text
                  style={[styles.notFoundText, { color: colors.textTertiary }]}
                >
                  User not found
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.surfaceSecondary }]}>
        {(["incoming", "sent"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tab,
              activeTab === tab && {
                backgroundColor: colors.background, // Card-like tab
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === tab ? colors.text : colors.textTertiary,
                  fontSize: fs.sm,
                  fontWeight: activeTab === tab ? "700" : "600",
                },
              ]}
            >
              {tab === "incoming" ? "Incoming" : "Sent"}
            </Text>
            {tab === "incoming" && incomingRequests.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {incomingRequests.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Request List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activeTab === "incoming" ? incomingRequests : sentRequests}
          keyExtractor={(item) => item._id}
          renderItem={renderRequestCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Ionicons
                  name={
                    activeTab === "incoming"
                      ? "mail-unread-outline"
                      : "paper-plane-outline"
                  }
                  size={40}
                  color={colors.textTertiary}
                />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeTab === "incoming"
                  ? "No incoming requests"
                  : "No sent requests"}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    // borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginTop: 0,
    marginBottom: 20,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "flex-end", // Align input and button
    gap: 12,
  },
  searchInput: {
    flex: 1,
  },
  searchResultCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
  },
  searchResultContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  searchResultInfo: {
    flex: 1,
  },
  notFoundContainer: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  notFoundText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  tabText: {
    // defined inline
  },
  tabBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  requestPhone: {
    opacity: 0.7,
  },
  requestActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingText: {
    fontWeight: "700",
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 16,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
  },
});

export default FriendsScreen;
