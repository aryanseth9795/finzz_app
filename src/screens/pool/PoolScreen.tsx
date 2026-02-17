import React, { useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper, Avatar } from "../../components/ui";
import { useAppDispatch, useAppSelector } from "../../store";
import { setPools, setPoolLoading } from "../../store/slices/poolSlice";
import { getMyPoolsApi } from "../../api/poolApi";
import { IPool } from "../../types";

const PoolScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const dispatch = useAppDispatch();
  const { pools, loading } = useAppSelector((state) => state.pool);
  const { user } = useAppSelector((state) => state.auth);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPools = useCallback(async () => {
    try {
      dispatch(setPoolLoading(true));
      const res = await getMyPoolsApi();
      if (res.data.success) {
        dispatch(setPools(res.data.pools));
      }
    } catch (error) {
      console.error("Failed to fetch pools:", error);
    } finally {
      dispatch(setPoolLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPools();
    setRefreshing(false);
  };

  const renderPoolCard = ({ item }: { item: IPool }) => {
    const isActive = item.status === "active";

    return (
      <TouchableOpacity
        style={[styles.poolCard, { backgroundColor: colors.surface }]}
        onPress={() => navigation.navigate("PoolChat", { poolId: item._id })}
        activeOpacity={0.7}
      >
        {/* Pool Image or Initials */}
        <View
          style={[styles.poolImage, { backgroundColor: colors.primarySurface }]}
        >
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.image} />
          ) : (
            <Text style={[styles.initials, { color: colors.primary }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Pool Info */}
        <View style={styles.poolInfo}>
          <View style={styles.poolHeader}>
            <Text
              style={[styles.poolName, { color: colors.text, fontSize: fs.lg }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isActive
                    ? colors.primary + "20"
                    : colors.textSecondary + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontSize: fs.xs,
                  },
                ]}
              >
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Last Transaction */}
          {item.lastTransaction && (
            <Text
              style={[
                styles.lastTx,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
              numberOfLines={1}
            >
              ₹{item.lastTransaction.amount} • {item.lastTransaction.remark}
            </Text>
          )}

          {/* Members Count */}
          <View style={styles.poolMeta}>
            <Ionicons
              name="people-outline"
              size={14}
              color={colors.textTertiary}
            />
            <Text
              style={[
                styles.memberCount,
                { color: colors.textTertiary, fontSize: fs.xs },
              ]}
            >
              {item.members.length} member{item.members.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textTertiary}
        />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: colors.primarySurface },
        ]}
      >
        <Ionicons
          name="people-circle-outline"
          size={56}
          color={colors.primary}
        />
      </View>
      <Text
        style={[styles.emptyTitle, { color: colors.text, fontSize: fs.xl }]}
      >
        No Pools Yet
      </Text>
      <Text
        style={[
          styles.emptySubtitle,
          { color: colors.textTertiary, fontSize: fs.md },
        ]}
      >
        Create your first pool to track{"\n"}shared expenses with friends
      </Text>
    </View>
  );

  return (
    <SafeAreaWrapper edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs.xxl }]}
        >
          Pools
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Account")}
          activeOpacity={0.8}
        >
          <Avatar uri={user?.avatar} name={user?.name || "U"} size={40} />
        </TouchableOpacity>
      </View>

      {/* Pool List */}
      {loading && pools.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={pools}
          renderItem={renderPoolCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[
            styles.listContainer,
            pools.length === 0 && styles.emptyContainer,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* FAB - Create Pool */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate("CreatePool")}
        activeOpacity={0.8}
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  poolCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  poolImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  initials: {
    fontWeight: "700",
    fontSize: 22,
  },
  poolInfo: {
    flex: 1,
    gap: 4,
  },
  poolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  poolName: {
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  lastTx: {
    fontWeight: "400",
  },
  poolMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberCount: {
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: "center",
    lineHeight: 22,
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

export default PoolScreen;
