import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper } from "../../components/ui";
import { getPoolStatsApi } from "../../api/poolApi";
import { IPoolStats } from "../../types";

const PoolStatsScreen = ({ route, navigation }: any) => {
  const { poolId } = route.params;
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const [stats, setStats] = useState<IPoolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await getPoolStatsApi(poolId);
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await getPoolStatsApi(poolId);
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (error) {
      console.error("Failed to refresh stats:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (!stats) {
    return (
      <SafeAreaWrapper edges={["top"]}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.textTertiary}
          />
          <Text
            style={[
              styles.errorText,
              { color: colors.textSecondary, fontSize: fs.md },
            ]}
          >
            Failed to load statistics
          </Text>
          <TouchableOpacity
            style={[
              styles.retryBtn,
              { backgroundColor: colors.primarySurface },
            ]}
            onPress={fetchStats}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs.lg }]}
        >
          Pool Statistics
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Overview Cards */}
        <View style={styles.overviewRow}>
          {/* Credited */}
          <View
            style={[
              styles.overviewCard,
              {
                backgroundColor: colors.primarySurface,
                borderColor: colors.primary + "30",
              },
            ]}
          >
            <Ionicons
              name="arrow-down-circle"
              size={24}
              color={colors.primary}
            />
            <Text
              style={[
                styles.overviewValue,
                { color: colors.primary, fontSize: fs.xl },
              ]}
            >
              ₹{stats.totalCredited.toLocaleString("en-IN")}
            </Text>
            <Text
              style={[
                styles.overviewLabel,
                { color: colors.primary, fontSize: 10 },
              ]}
            >
              TOTAL CREDITED
            </Text>
          </View>

          {/* Debited */}
          <View
            style={[
              styles.overviewCard,
              {
                backgroundColor: colors.dangerLight,
                borderColor: colors.danger + "30",
              },
            ]}
          >
            <Ionicons name="arrow-up-circle" size={24} color={colors.danger} />
            <Text
              style={[
                styles.overviewValue,
                { color: colors.danger, fontSize: fs.xl },
              ]}
            >
              ₹{stats.totalDebited.toLocaleString("en-IN")}
            </Text>
            <Text
              style={[
                styles.overviewLabel,
                { color: colors.danger, fontSize: 10 },
              ]}
            >
              TOTAL DEBITED
            </Text>
          </View>
        </View>

        {/* Summary Row */}
        <View style={styles.summaryRow}>
          {/* Net Balance */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.separator,
              },
            ]}
          >
            <Ionicons
              name="wallet-outline"
              size={20}
              color={stats.netBalance >= 0 ? colors.primary : colors.danger}
            />
            <View style={styles.summaryContent}>
              <Text
                style={[
                  styles.summaryLabel,
                  { color: colors.textSecondary, fontSize: 10 },
                ]}
              >
                NET BALANCE
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      stats.netBalance >= 0 ? colors.primary : colors.danger,
                    fontSize: fs.lg,
                  },
                ]}
              >
                ₹{Math.abs(stats.netBalance).toLocaleString("en-IN")}
              </Text>
            </View>
          </View>

          {/* Duration */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.separator,
              },
            ]}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
            <View style={styles.summaryContent}>
              <Text
                style={[
                  styles.summaryLabel,
                  { color: colors.textSecondary, fontSize: 10 },
                ]}
              >
                DAYS ACTIVE
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: colors.text, fontSize: fs.lg },
                ]}
              >
                {stats.durationDays}
              </Text>
            </View>
          </View>
        </View>

        {/* Member Breakdown */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.textSecondary, fontSize: fs.xs },
            ]}
          >
            MEMBER BREAKDOWN
          </Text>
          <View
            style={[styles.memberList, { backgroundColor: colors.surface }]}
          >
            {/* Table Header */}
            <View
              style={[
                styles.memberTableHeader,
                { borderBottomColor: colors.separator },
              ]}
            >
              <Text
                style={[
                  styles.memberTableHeaderText,
                  { color: colors.textTertiary, flex: 2 },
                ]}
              >
                Member
              </Text>
              <Text
                style={[
                  styles.memberTableHeaderText,
                  { color: colors.textTertiary, flex: 1.5, textAlign: "right" },
                ]}
              >
                Credited
              </Text>
              <Text
                style={[
                  styles.memberTableHeaderText,
                  { color: colors.textTertiary, flex: 1.5, textAlign: "right" },
                ]}
              >
                Debited
              </Text>
              <Text
                style={[
                  styles.memberTableHeaderText,
                  { color: colors.textTertiary, flex: 1.5, textAlign: "right" },
                ]}
              >
                Net
              </Text>
            </View>

            {/* Member Rows */}
            {stats.memberBreakdown.map((member, index) => (
              <View
                key={member.userId}
                style={[
                  styles.memberRow,
                  index < stats.memberBreakdown.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  },
                ]}
              >
                <View style={{ flex: 2 }}>
                  <Text
                    style={[
                      styles.memberName,
                      { color: colors.text, fontSize: fs.sm },
                    ]}
                    numberOfLines={1}
                  >
                    {member.name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.memberAmount,
                    {
                      color: colors.primary,
                      fontSize: fs.sm,
                      flex: 1.5,
                      textAlign: "right",
                    },
                  ]}
                >
                  ₹{member.totalCredited.toLocaleString("en-IN")}
                </Text>
                <Text
                  style={[
                    styles.memberAmount,
                    {
                      color: colors.danger,
                      fontSize: fs.sm,
                      flex: 1.5,
                      textAlign: "right",
                    },
                  ]}
                >
                  ₹{member.totalDebited.toLocaleString("en-IN")}
                </Text>
                <Text
                  style={[
                    styles.memberNet,
                    {
                      color: member.net >= 0 ? colors.primary : colors.danger,
                      fontSize: fs.sm,
                      flex: 1.5,
                      textAlign: "right",
                    },
                  ]}
                >
                  {member.net >= 0 ? "+" : ""}₹
                  {Math.abs(member.net).toLocaleString("en-IN")}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    marginLeft: -8,
  },
  headerTitle: {
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    fontWeight: "500",
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    fontWeight: "700",
    fontSize: 14,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  // Overview Cards
  overviewRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  overviewCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  overviewValue: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  overviewLabel: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Summary Row
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  // Section
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  memberList: {
    borderRadius: 14,
    overflow: "hidden",
  },
  memberTableHeader: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberTableHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  memberName: {
    fontWeight: "600",
  },
  memberAmount: {
    fontWeight: "600",
  },
  memberNet: {
    fontWeight: "800",
  },
});

export default PoolStatsScreen;
