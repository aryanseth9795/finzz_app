import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Avatar, SafeAreaWrapper } from "../../components/ui";
import { useTheme } from "../../contexts/ThemeContext";
import {
  getNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from "../../api/notificationApi";
import { INotification } from "../../types";
import { cacheManager, CACHE_KEYS } from "../../utils/cacheManager";

dayjs.extend(relativeTime);

const NotificationsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const cached = await cacheManager.get<INotification[]>(
        CACHE_KEYS.NOTIFICATIONS,
      );
      if (cached && showLoader) {
        setNotifications(cached);
      }

      const response = await getNotificationsApi();
      const nextNotifications = response.data.notifications || [];
      setNotifications(nextNotifications);
      setUnreadCount(response.data.unreadCount ?? 0);
      await cacheManager.set(CACHE_KEYS.NOTIFICATIONS, nextNotifications);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications(false);
    setRefreshing(false);
  };

  const handleMarkRead = async (item: INotification) => {
    if (item.read) return;
    try {
      await markNotificationReadApi(item._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await cacheManager.remove(CACHE_KEYS.NOTIFICATIONS);
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      await cacheManager.remove(CACHE_KEYS.NOTIFICATIONS);
    } catch {
      // silent
    }
  };

  const getNotificationIcon = (type: INotification["type"]) => {
    switch (type) {
      case "friend_request":
      case "friend_accepted":
        return "people-outline";
      case "txn_added":
      case "txn_verified":
      case "txn_rejected":
      case "txn_reworked":
      case "txn_deleted":
        return "swap-horizontal-outline";
      case "pool_tx_added":
      case "pool_tx_verified":
        return "wallet-outline";
      case "pool_member_added":
      case "pool_member_removed":
        return "people-circle-outline";
      default:
        return "notifications-outline";
    }
  };

  const getNotificationBody = (item: INotification) => {
    if (item.body) return item.body;

    const senderName = item.sender?.name || "Someone";
    switch (item.type) {
      case "friend_request":
        return `${senderName} sent you a friend request.`;
      case "friend_accepted":
        return `${senderName} accepted your friend request.`;
      case "txn_added":
        return `${senderName} added a transaction for review.`;
      case "txn_verified":
        return `${senderName} verified your transaction.`;
      case "txn_rejected":
        return `${senderName} rejected your transaction.`;
      case "txn_reworked":
        return `${senderName} resubmitted a transaction for review.`;
      case "txn_deleted":
        return `${senderName} deleted a rejected transaction.`;
      case "pool_tx_added":
        return `${senderName} added a pool transaction.`;
      case "pool_tx_verified":
        return `${senderName} verified a pool transaction.`;
      case "pool_member_added":
        return `${senderName} added you to a pool.`;
      case "pool_member_removed":
        return `${senderName} removed you from a pool.`;
      default:
        return "You have a new notification.";
    }
  };

  const renderNotification = ({ item }: { item: INotification }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => handleMarkRead(item)}
      style={[
        styles.notificationCard,
        {
          backgroundColor: item.read
            ? colors.card
            : colors.primarySurface || colors.card,
          borderColor: item.read ? colors.cardBorder : colors.primary + "40",
        },
      ]}
    >
      {/* Unread dot */}
      {!item.read && (
        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
      )}
      <Avatar
        uri={item.sender?.avatar}
        name={item.sender?.name || "F"}
        size={46}
      />
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: colors.primarySurface },
              ]}
            >
              <Ionicons
                name={getNotificationIcon(item.type)}
                size={14}
                color={colors.primary}
              />
            </View>
            <Text
              style={[styles.notificationTitle, { color: colors.text, fontSize: fs.sm }]}
              numberOfLines={1}
            >
              {item.title || "Finzz update"}
            </Text>
          </View>
          <Text
            style={[styles.timeText, { color: colors.textTertiary, fontSize: fs.xs }]}
          >
            {dayjs(item.createdAt).fromNow()}
          </Text>
        </View>
        <Text
          style={[styles.notificationBody, { color: colors.textSecondary, fontSize: fs.sm }]}
        >
          {getNotificationBody(item)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaWrapper edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs.lg }]}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>All read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={
            notifications.length === 0 ? styles.emptyList : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="notifications-off-outline"
                size={52}
                color={colors.textTertiary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text, fontSize: fs.md }]}>
                No notifications yet
              </Text>
              <Text
                style={[
                  styles.emptyBody,
                  { color: colors.textSecondary, fontSize: fs.sm },
                ]}
              >
                Friend requests, transaction updates, and pool activity will appear here.
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: {
    fontWeight: "700",
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  markAllBtn: { paddingRight: 4 },
  markAllText: { fontSize: 12, fontWeight: "700" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyTitle: {
    fontWeight: "700",
  },
  emptyBody: {
    textAlign: "center",
    lineHeight: 20,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationTitle: {
    fontWeight: "700",
    flex: 1,
  },
  timeText: {
    fontWeight: "500",
  },
  notificationBody: {
    lineHeight: 20,
  },
});

export default NotificationsScreen;
