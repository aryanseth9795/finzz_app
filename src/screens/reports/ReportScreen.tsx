import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaWrapper } from "../../components/ui";
import { getMonthlyReportApi, getPerFriendReportApi } from "../../api/statsApi";
import { IMonthlyBreakdown } from "../../types";

const ReportScreen = ({ route, navigation }: any) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs } = theme;
  const { chatId, friendId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<IMonthlyBreakdown[]>([]);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        let response;
        if (friendId) {
          response = await getPerFriendReportApi(friendId);
        } else {
          response = await getMonthlyReportApi();
        }

        // Backend returns: {success, report: [{year, month (number), totalCredit, totalDebit, net, count}]}
        // Map to frontend IMonthlyBreakdown: {month (string), credit, debit, net}
        const backendReport = response.data.report || [];
        const mappedReport: IMonthlyBreakdown[] = backendReport.map(
          (item: any) => {
            const monthNames = [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ];
            const monthName = monthNames[item.month - 1] || "Unknown";
            const monthYear = `${monthName} ${item.year}`;

            return {
              month: monthYear,
              credit: item.totalCredit || 0,
              debit: item.totalDebit || 0,
              net: item.net || 0,
            };
          },
        );

        setMonthlyData(mappedReport);
      } catch (error) {
        console.error("Failed to fetch report:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [friendId]);

  const renderMonthCard = ({ item }: { item: IMonthlyBreakdown }) => {
    const isPositive = item.net >= 0;

    return (
      <View
        style={[
          styles.monthCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Text
          style={[styles.monthLabel, { color: colors.text, fontSize: fs.lg }]}
        >
          {item.month}
        </Text>
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Ionicons name="arrow-down" size={14} color={colors.credit} />
            <Text
              style={[
                styles.breakdownLabel,
                { color: colors.textTertiary, fontSize: fs.xs },
              ]}
            >
              Received
            </Text>
            <Text
              style={[
                styles.breakdownValue,
                { color: colors.credit, fontSize: fs.md },
              ]}
            >
              ₹{item.credit.toLocaleString("en-IN")}
            </Text>
          </View>
          <View
            style={[styles.divider, { backgroundColor: colors.separator }]}
          />
          <View style={styles.breakdownItem}>
            <Ionicons name="arrow-up" size={14} color={colors.debit} />
            <Text
              style={[
                styles.breakdownLabel,
                { color: colors.textTertiary, fontSize: fs.xs },
              ]}
            >
              Given
            </Text>
            <Text
              style={[
                styles.breakdownValue,
                { color: colors.debit, fontSize: fs.md },
              ]}
            >
              ₹{item.debit.toLocaleString("en-IN")}
            </Text>
          </View>
          <View
            style={[styles.divider, { backgroundColor: colors.separator }]}
          />
          <View style={styles.breakdownItem}>
            <Ionicons
              name={isPositive ? "trending-up" : "trending-down"}
              size={14}
              color={isPositive ? colors.credit : colors.debit}
            />
            <Text
              style={[
                styles.breakdownLabel,
                { color: colors.textTertiary, fontSize: fs.xs },
              ]}
            >
              Net
            </Text>
            <Text
              style={[
                styles.breakdownValue,
                {
                  color: isPositive ? colors.credit : colors.debit,
                  fontSize: fs.md,
                },
              ]}
            >
              ₹{Math.abs(item.net).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaWrapper edges={["top", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text, fontSize: fs.lg }]}
        >
          Reports
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={monthlyData}
          keyExtractor={(item, index) => `${item.month}-${index}`}
          renderItem={renderMonthCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="analytics-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                No report data available yet
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
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  monthCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  monthLabel: {
    fontWeight: "700",
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  breakdownItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  breakdownLabel: {
    fontWeight: "500",
  },
  breakdownValue: {
    fontWeight: "700",
  },
  divider: {
    width: 1,
    height: 40,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
});

export default ReportScreen;
