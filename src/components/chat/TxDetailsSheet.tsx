import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import { useTheme } from "../../contexts/ThemeContext";
import type { ITx } from "../../types";
import { formatDate } from "../../utils/dates";
import { formatCurrency } from "../../utils/money";
import { isRefTo } from "../../utils/entities";
import {
  CARRY_FORWARD_ID,
  txActions,
  txDirectionText,
  txStatusOf,
  txTimeline,
  type TimelineEntry,
  type TxAction,
  type TxStatus,
} from "../../utils/transactions";

export interface TxDetailsSheetProps {
  tx: ITx | null; // null = hidden
  meId?: string | null;
  members?: { _id: string; name?: string }[];
  friendName?: string;
  busy?: boolean; // disables the action buttons
  onClose: () => void;
  onEdit: (tx: ITx) => void; // used for both "edit" and "resubmit"
  onDelete: (tx: ITx) => void;
  onVerify: (tx: ITx) => void;
  onReject: (tx: ITx) => void;
}

const STATUS_LABEL: Record<TxStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};

const ACTION_LABEL: Record<TxAction, string> = {
  edit: "Edit",
  resubmit: "Edit & resubmit",
  delete: "Delete",
  verify: "Verify",
  reject: "Reject",
};

const formatAt = (at?: string): string | null => {
  if (!at) return null;
  const d = dayjs(at);
  return d.isValid() ? d.format("DD MMM YYYY, h:mm A") : null;
};

const TxDetailsSheet: React.FC<TxDetailsSheetProps> = ({
  tx,
  meId,
  members,
  friendName,
  busy = false,
  onClose,
  onEdit,
  onDelete,
  onVerify,
  onReject,
}) => {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius, fontSize, fontWeight } = theme;
  const insets = useSafeAreaInsets();

  const derived = useMemo(() => {
    if (!tx || tx._id === CARRY_FORWARD_ID) return null;
    const ctx = { meId, members };
    return {
      status: txStatusOf(tx),
      direction: txDirectionText(tx, { ...ctx, friendName }),
      timeline: txTimeline(tx, ctx),
      actions: txActions(tx, meId),
    };
  }, [tx, meId, members, friendName]);

  if (!tx || !derived) {
    return (
      <Modal
        visible={false}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View />
      </Modal>
    );
  }

  const { status, direction, timeline, actions } = derived;

  const toMe = isRefTo(tx.to, meId);
  const fromMe = isRefTo(tx.from, meId);
  const amountColor = toMe
    ? colors.credit
    : fromMe
      ? colors.debit
      : colors.text;

  const statusColor =
    status === "verified"
      ? colors.verified
      : status === "rejected"
        ? colors.danger
        : colors.pending;

  const handlers: Record<TxAction, () => void> = {
    edit: () => onEdit(tx),
    resubmit: () => onEdit(tx),
    delete: () => onDelete(tx),
    verify: () => onVerify(tx),
    reject: () => onReject(tx),
  };

  const timelineTitle = (e: TimelineEntry): string => {
    switch (e.kind) {
      case "created":
        return `Created by ${e.who ?? "Unknown"}`;
      case "edited":
        return e.note ? `Edited (${e.note})` : "Edited";
      case "verified":
        return `Verified by ${e.who ?? "Unknown"}`;
      case "rejected":
        return `Rejected by ${e.who ?? "Unknown"}`;
      default:
        return `Waiting for ${e.who ?? "Unknown"} to verify`;
    }
  };

  const dotColor = (e: TimelineEntry): string => {
    switch (e.kind) {
      case "verified":
        return colors.verified;
      case "rejected":
        return colors.danger;
      case "waiting":
        return colors.pending;
      default:
        return colors.primary;
    }
  };

  const renderButton = (action: TxAction) => {
    const label = ACTION_LABEL[action];

    let bg: string = colors.primarySurface;
    let fg: string = colors.primary;
    let border: string = colors.primary;
    if (action === "verify") {
      bg = colors.primary;
      fg = colors.textInverse;
    } else if (action === "delete") {
      bg = colors.danger;
      fg = colors.textInverse;
      border = colors.danger;
    } else if (action === "reject") {
      bg = "transparent";
      fg = colors.danger;
      border = colors.danger;
    }

    return (
      <TouchableOpacity
        key={action}
        style={[
          styles.button,
          {
            backgroundColor: bg,
            borderColor: border,
            borderRadius: borderRadius.md,
            opacity: busy ? 0.5 : 1,
          },
        ]}
        onPress={handlers[action]}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: busy }}
      >
        <Text
          style={{
            color: fg,
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + spacing.lg,
              paddingHorizontal: spacing.xl,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { paddingTop: spacing.xl }]}>
            <View style={styles.headerMain}>
              <Text
                style={{
                  color: amountColor,
                  fontSize: fontSize.display,
                  fontWeight: fontWeight.heavy,
                }}
                accessibilityLabel={`Amount ${formatCurrency(tx.amount)}`}
              >
                {formatCurrency(tx.amount)}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: fontSize.md,
                  marginTop: spacing.xs,
                }}
              >
                {direction}
              </Text>
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: statusColor + "26",
                    borderRadius: borderRadius.full,
                    marginTop: spacing.md,
                  },
                ]}
                accessibilityLabel={`Status ${STATUS_LABEL[status]}`}
              >
                <Text
                  style={{
                    color: statusColor,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {STATUS_LABEL[status]}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                  marginTop: spacing.lg,
                },
              ]}
            >
              <View style={styles.row}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: fontSize.sm,
                  }}
                >
                  Date
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {formatDate(tx.date)}
                </Text>
              </View>
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
              <View style={styles.row}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: fontSize.sm,
                  }}
                >
                  Remarks
                </Text>
                <Text
                  style={[
                    styles.remarks,
                    {
                      color: tx.remarks ? colors.text : colors.textTertiary,
                      fontSize: fontSize.md,
                      fontWeight: fontWeight.medium,
                    },
                  ]}
                >
                  {tx.remarks ? tx.remarks : "No remarks"}
                </Text>
              </View>
            </View>

            {timeline.length > 0 && (
              <View style={{ marginTop: spacing.xl }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: fontSize.md,
                    fontWeight: fontWeight.bold,
                    marginBottom: spacing.md,
                  }}
                >
                  Timeline
                </Text>
                {timeline.map((e, i) => {
                  const last = i === timeline.length - 1;
                  const color = dotColor(e);
                  const hollow = e.kind === "waiting";
                  const when = formatAt(e.at);
                  return (
                    <View key={`${e.kind}-${i}`} style={styles.tlRow}>
                      <View style={styles.tlRail}>
                        <View
                          style={[
                            styles.dot,
                            {
                              borderColor: color,
                              backgroundColor: hollow ? "transparent" : color,
                            },
                          ]}
                        />
                        {!last && (
                          <View
                            style={[
                              styles.line,
                              { backgroundColor: colors.border },
                            ]}
                          />
                        )}
                      </View>
                      <View
                        style={[
                          styles.tlBody,
                          { paddingBottom: last ? 0 : spacing.lg },
                        ]}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: fontSize.md,
                            fontWeight: fontWeight.medium,
                          }}
                        >
                          {timelineTitle(e)}
                        </Text>
                        {when && (
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: fontSize.sm,
                              marginTop: 2,
                            }}
                          >
                            {when}
                          </Text>
                        )}
                        {e.kind === "rejected" && !!e.note && (
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: fontSize.sm,
                              fontStyle: "italic",
                              marginTop: 2,
                            }}
                          >
                            {`“${e.note}”`}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {actions.length > 0 ? (
            <View
              style={[
                styles.actions,
                { marginTop: spacing.xl, gap: spacing.md },
              ]}
            >
              {actions.map(renderButton)}
            </View>
          ) : status === "verified" ? (
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: fontSize.sm,
                textAlign: "center",
                marginTop: spacing.xl,
              }}
            >
              {"Verified transactions can’t be changed"}
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerMain: { flex: 1, alignItems: "flex-start" },
  pill: { paddingHorizontal: 12, paddingVertical: 4 },
  scroll: { flexGrow: 0 },
  card: { borderWidth: 1, paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    gap: 16,
  },
  remarks: { flex: 1, textAlign: "right" },
  divider: { height: StyleSheet.hairlineWidth },
  tlRow: { flexDirection: "row" },
  tlRail: { width: 20, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 3 },
  line: { width: 2, flex: 1, marginTop: 2 },
  tlBody: { flex: 1, marginLeft: 8 },
  actions: { flexDirection: "column" },
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1.5,
  },
});

export default React.memo(TxDetailsSheet);
