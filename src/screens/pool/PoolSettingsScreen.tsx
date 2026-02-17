import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper } from "../../components/ui";
import { useAppSelector } from "../../store";
import {
  getPoolByIdApi,
  deletePoolApi,
  closePoolApi,
  reopenPoolApi,
  leavePoolApi,
  addPoolMemberApi,
  removePoolMemberApi,
} from "../../api/poolApi";
import { IPool, IFriend } from "../../types";
import { getFriendsListApi } from "../../api/friendApi";

const PoolSettingsScreen = ({ route, navigation }: any) => {
  const { poolId } = route.params;
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const [pool, setPool] = useState<IPool | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [friends, setFriends] = useState<IFriend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const userId = useAppSelector((state) => state.auth.user?._id);

  useEffect(() => {
    fetchPool();
    fetchFriends();
  }, []);

  const fetchPool = async () => {
    try {
      const res = await getPoolByIdApi(poolId);
      if (res.data.success) {
        setPool(res.data.pool);
      }
    } catch (error) {
      console.error("Failed to fetch pool:", error);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await getFriendsListApi();
      if (res.data.success) {
        setFriends(res.data.friends);
      }
    } catch (error) {
      console.error("Failed to fetch friends:", error);
    }
  };

  const handleAddMember = async (friendId: string) => {
    try {
      setLoading(true);
      await addPoolMemberApi(poolId, friendId);
      Alert.alert("Success", "Member added successfully!");
      setShowAddMemberModal(false);
      fetchPool();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to add member",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      "Remove Member?",
      `Are you sure you want to remove ${memberName} from this pool?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removePoolMemberApi(poolId, memberId);
              Alert.alert("Success", "Member removed successfully!");
              fetchPool();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to remove member",
              );
            }
          },
        },
      ],
    );
  };

  const handleCloseReopen = async () => {
    if (!pool) return;
    const action = pool.status === "active" ? "close" : "reopen";

    Alert.alert(
      `${action === "close" ? "Close" : "Reopen"} Pool?`,
      `Are you sure you want to ${action} this pool?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action === "close" ? "Close" : "Reopen",
          style: "destructive",
          onPress: async () => {
            try {
              if (action === "close") {
                await closePoolApi(poolId);
              } else {
                await reopenPoolApi(poolId);
              }
              Alert.alert("Success", `Pool ${action}ed successfully!`);
              fetchPool();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message || `Failed to ${action} pool`,
              );
            }
          },
        },
      ],
    );
  };

  const handleDeletePool = () => {
    Alert.alert(
      "Delete Pool?",
      "This will permanently delete the pool and all its transactions. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePoolApi(poolId);
              Alert.alert("Success", "Pool deleted successfully!");
              navigation.navigate("PoolList");
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to delete pool",
              );
            }
          },
        },
      ],
    );
  };

  const handleLeavePool = () => {
    Alert.alert("Leave Pool?", "Are you sure you want to leave this pool?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await leavePoolApi(poolId);
            Alert.alert("Success", "You left the pool successfully!");
            navigation.navigate("PoolList");
          } catch (error: any) {
            Alert.alert(
              "Error",
              error.response?.data?.message || "Failed to leave pool",
            );
          }
        },
      },
    ]);
  };

  if (!pool) {
    return (
      <SafeAreaWrapper edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaWrapper>
    );
  }

  const isAdmin = pool.admin._id === userId;

  // Filter friends not in pool
  const availableFriends = friends.filter(
    (friend) =>
      !pool.members.some((member) => member._id === friend._id) &&
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaWrapper edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs.xl }]}
        >
          Pool Settings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container}>
        {/* Pool Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              POOL INFO
            </Text>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => navigation.navigate("EditPool", { poolId })}
                style={styles.editButton}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.editText,
                    { color: colors.primary, fontSize: fs.xs },
                  ]}
                >
                  Edit
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            <Text
              style={[styles.poolName, { color: colors.text, fontSize: fs.xl }]}
            >
              {pool.name}
            </Text>
            {pool.description && (
              <Text
                style={[
                  styles.poolDescription,
                  { color: colors.textSecondary, fontSize: fs.sm },
                ]}
              >
                {pool.description}
              </Text>
            )}
            {pool.rules && (
              <View style={styles.rulesContainer}>
                <Text
                  style={[
                    styles.rulesLabel,
                    { color: colors.textTertiary, fontSize: fs.xs },
                  ]}
                >
                  RULES
                </Text>
                <Text
                  style={[
                    styles.rulesText,
                    { color: colors.text, fontSize: fs.sm },
                  ]}
                >
                  {pool.rules}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textSecondary, fontSize: fs.sm },
              ]}
            >
              MEMBERS ({pool.members.length})
            </Text>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => setShowAddMemberModal(true)}
                style={styles.addButton}
              >
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.addText,
                    { color: colors.primary, fontSize: fs.xs },
                  ]}
                >
                  Add
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View
            style={[styles.membersList, { backgroundColor: colors.surface }]}
          >
            {pool.members.map((member, index) => (
              <View
                key={member._id}
                style={[
                  styles.memberRow,
                  index < pool.members.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  },
                ]}
              >
                <View style={styles.memberInfo}>
                  <Text
                    style={[
                      styles.memberName,
                      { color: colors.text, fontSize: fs.md },
                    ]}
                  >
                    {member.name}
                  </Text>
                  {member._id === pool.admin._id && (
                    <View
                      style={[
                        styles.adminBadge,
                        { backgroundColor: colors.primary + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.adminBadgeText,
                          { color: colors.primary, fontSize: fs.xs },
                        ]}
                      >
                        ADMIN
                      </Text>
                    </View>
                  )}
                </View>
                {isAdmin && member._id !== pool.admin._id && (
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(member._id, member.name)}
                    style={styles.removeButton}
                  >
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={colors.danger}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.textSecondary, fontSize: fs.sm },
            ]}
          >
            ACTIONS
          </Text>
          <View
            style={[styles.actionsList, { backgroundColor: colors.surface }]}
          >
            {/* View Stats */}
            <TouchableOpacity
              style={[
                styles.actionRow,
                {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.separator,
                },
              ]}
              onPress={() => navigation.navigate("PoolStats", { poolId })}
            >
              <Ionicons
                name="stats-chart-outline"
                size={20}
                color={colors.primary}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: colors.text, fontSize: fs.md },
                ]}
              >
                View Statistics
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            {/* Close/Reopen (Admin only) */}
            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.actionRow,
                  {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  },
                ]}
                onPress={handleCloseReopen}
              >
                <Ionicons
                  name={
                    pool.status === "active"
                      ? "lock-closed-outline"
                      : "lock-open-outline"
                  }
                  size={20}
                  color={colors.text}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: colors.text, fontSize: fs.md },
                  ]}
                >
                  {pool.status === "active" ? "Close Pool" : "Reopen Pool"}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}

            {/* Leave Pool (Non-admin) */}
            {!isAdmin && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleLeavePool}
              >
                <Ionicons name="exit-outline" size={20} color={colors.danger} />
                <Text
                  style={[
                    styles.actionText,
                    { color: colors.danger, fontSize: fs.md },
                  ]}
                >
                  Leave Pool
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}

            {/* Delete Pool (Admin only) */}
            {isAdmin && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleDeletePool}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.danger}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: colors.danger, fontSize: fs.md },
                  ]}
                >
                  Delete Pool
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.separator },
              ]}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: colors.text, fontSize: fs.lg },
                ]}
              >
                Add Member
              </Text>
              <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
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
            />
            <FlatList
              data={availableFriends}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.friendRow,
                    { borderBottomColor: colors.separator },
                  ]}
                  onPress={() => handleAddMember(item._id)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.friendName,
                      { color: colors.text, fontSize: fs.md },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Ionicons
                    name="add-circle-outline"
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.textSecondary, fontSize: fs.sm },
                  ]}
                >
                  {searchQuery
                    ? "No friends found"
                    : "All friends are already members"}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editText: {
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addText: {
    fontWeight: "600",
  },
  infoCard: {
    padding: 20,
    borderRadius: 12,
    gap: 12,
  },
  poolName: {
    fontWeight: "700",
  },
  poolDescription: {
    lineHeight: 20,
  },
  rulesContainer: {
    marginTop: 8,
    gap: 6,
  },
  rulesLabel: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  rulesText: {
    lineHeight: 20,
  },
  membersList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  memberName: {
    fontWeight: "500",
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  removeButton: {
    padding: 4,
  },
  actionsList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontWeight: "500",
  },
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
  friendName: {
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    padding: 32,
  },
});

export default PoolSettingsScreen;
