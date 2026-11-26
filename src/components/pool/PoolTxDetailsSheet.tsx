/**
 * Details of one pool entry (T-029): amount, money in / out, status, date,
 * remarks, a timeline (who added it and when, edits, who verified or rejected
 * it, the reject remark) and the actions the signed-in member may take.
 *
 * Built like the friend ledger's `TxDetailsSheet`. Everything it shows comes
 * from the row already loaded in the pool ledger: opening it makes no request.
 * Rejecting asks for an optional remark inside the sheet itself (no second
 * Modal on top of this one), with the keyboard handled by listeners rather
 * than KeyboardAvoidingView, which is unreliable inside a Modal edge to edge.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import { useTheme } from "../../contexts/ThemeContext";
import { ToastHost } from "../../contexts/ToastContext";
import type { IPoolTx } from "../../types";
import { formatDate } from "../../utils/dates";
import { formatCurrency } from "../../utils/money";
import type { TimelineEntry } from "../../utils/transactions";
import {
  poolTxActions,
  poolTxStatusOf,
  poolTxTimeline,
  type PoolTxAction,
  type PoolTxStatus,
} from "../../utils/poolTx";

export const REJECT_REMARK_MAX = 200;

export interface PoolTxDetailsSheetProps {
  tx: IPoolTx | null; // null = hidden
  meId?: string | null;
  members?: { _id: string; name?: string }[];
  poolClosed: boolean;
  busy?: boolean; // disables the action buttons
  onClose: () => void;
  onEdit: (tx: IPoolTx) => void; // "edit" and "resubmit"
  onDelete: (tx: IPoolTx) => void;
  onVerify: (tx: IPoolTx) => void;
  onReject: (tx: IPoolTx, remark: string) => void;
}

const STATUS_LABEL: Record<PoolTxStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};

const ACTION_LABEL: Record<PoolTxAction, string> = {
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

const timelineTitle = (e: TimelineEntry): string => {
  switch (e.kind) {
    case "created":
      return `Added by ${e.who ?? "Unknown"}`;
    case "edited":
      return e.note ? `Edited (${e.note})` : "Edited";
    case "verified":
      return `Verified by ${e.who ?? "Unknown"}`;
    case "rejected":
      return `Rejected by ${e.who ?? "Unknown"}`;
    default:
      return "Waiting for another member to verify";
  }
};

const PoolTxDetailsSheet: React.FC<PoolTxDetailsSheetProps> = ({
  tx: txProp,
  meId,
  members,
  poolClosed,
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

  // Keep the last non-null entry so the slide-out animation still has content.
  const lastTxRef = useRef<IPoolTx | null>(null);
  if (txProp) lastTxRef.current = txProp;
  const tx = txProp ?? lastTxRef.current;
  const visible = !!txProp;

  // Reject step: the remark box replaces the buttons until sent or cancelled.
  const [rejecting, setRejecting] = useState(false);
  const [remark, setRemark] = useState("");
  const txKey = txProp ? `${txProp._id}:${txProp.updatedAt}` : null;
  useEffect(() => {
    // A new entry, a new version of it, or closing: start over.
    setRejecting(false);
    setRemark("");
  }, [txKey]);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
      setKeyboardHeight(0);
    };
  }, [visible]);
  // Android reports the keyboard without the navigation bar below it, which
  // edge to edge is covered too.
  const keyboardInset =
    keyboardHeight > 0
      ? keyboardHeight + (Platform.OS === "android" ? insets.bottom : 0)
      : 0;

  const derived = useMemo(() => {
    if (!tx) return null;
    const ctx = { meId, members };
    return {
      status: poolTxStatusOf(tx),
      timeline: poolTxTimeline(tx, ctx),
      actions: poolTxActions(tx, meId, poolClosed),
    };
  }, [tx, meId, members, poolClosed]);

  if (!tx || !derived) {
    return (
      <Modal visible={false} transparent animationType="slide" onRequestClose={onClose}>
        <View />
      </Modal>
    );
  }

  const { status, timeline, actions } = derived;
  const isCredit = tx.type === "credit";
  const rejected = status === "rejected";
  const amountColor = rejected
    ? colors.textTertiary
    : isCredit
      ? colors.primary
      : colors.danger;
  const statusColor =
    status === "verified"
      ? colors.verified
      : rejected
        ? colors.danger
        : colors.pending;

  const handlers: Record<PoolTxAction, () => void> = {
    edit: () => onEdit(tx),
    resubmit: () => onEdit(tx),
    delete: () => onDelete(tx),
    verify: () => onVerify(tx),
    reject: () => setRejecting(true),
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

  const renderButton = (
    key: string,
    label: string,
    kind: "primary" | "soft" | "danger" | "outlineDanger" | "plain",
    onPress: () => void,
  ) => {
    let bg: string = colors.primarySurface;
    let fg: string = colors.primary;
    let border: string = colors.primary;
    if (kind === "primary") {
      bg = colors.primary;
      fg = colors.textInverse;
    } else if (kind === "danger") {
      bg = colors.danger;
      fg = colors.textInverse;
      border = colors.danger;
    } else if (kind === "outlineDanger") {
      bg = "transparent";
      fg = colors.danger;
      border = colors.danger;
    } else if (kind === "plain") {
      bg = "transparent";
      fg = colors.textSecondary;
      border = colors.border;
    }
    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.button,
          {
            backgroundColor: bg,
            borderColor: border,
            borderRadius: borderRadius.md,
            opacity: busy ? 0.5 : 1,
          },
        ]}
        onPress={onPress}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: busy }}
      >
        <Text style={{ color: fg, fontSize: fontSize.md, fontWeight: fontWeight.semibold }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const actionKind = (a: PoolTxAction) =>
    a === "verify"
      ? "primary"
      : a === "delete"
        ? "danger"
        : a === "reject"
          ? "outlineDanger"
          : "soft";

  const footer = () => {
    if (rejecting) {
      return (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold }}>
            Why are you rejecting it? (optional)
          </Text>
          <TextInput
            value={remark}
            onChangeText={setRemark}
            placeholder="e.g. Amount is wrong, it was ₹4,000"
            placeholderTextColor={colors.textTertiary}
            maxLength={REJECT_REMARK_MAX}
            multiline
            autoFocus
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderRadius: borderRadius.md,
                fontSize: fontSize.md,
              },
            ]}
            accessibilityLabel="Reason for rejecting"
          />
          <Text style={{ color: colors.textTertiary, fontSize: fontSize.xs, textAlign: "right" }}>
            {`${remark.length}/${REJECT_REMARK_MAX}`}
          </Text>
          {renderButton("send-reject", "Reject entry", "danger", () =>
            onReject(tx, remark.trim()),
          )}
          {renderButton("cancel-reject", "Cancel", "plain", () => {
            setRejecting(false);
            setRemark("");
          })}
        </View>
      );
    }
    if (actions.length > 0) {
      return (
        <View style={[styles.actions, { marginTop: spacing.xl, gap: spacing.md }]}>
          {actions.map((a) => renderButton(a, ACTION_LABEL[a], actionKind(a), handlers[a]))}
        </View>
      );
    }
    const note = poolClosed
      ? "This pool is closed, so entries can't be changed"
      : status === "verified"
        ? "Verified entries can't be changed"
        : rejected && !actions.length
          ? "Only the member who added it can fix or delete it"
          : null;
    return note ? (
      <Text
        style={{
          color: colors.textTertiary,
          fontSize: fontSize.sm,
          textAlign: "center",
          marginTop: spacing.xl,
        }}
      >
        {note}
      </Text>
    ) : null;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom:
                (keyboardInset > 0 ? keyboardInset : insets.bottom) + spacing.lg,
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
                  textDecorationLine: rejected ? "line-through" : "none",
                }}
                accessibilityLabel={`Amount ${formatCurrency(tx.amount)}`}
              >
                {formatCurrency(tx.amount)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, marginTop: spacing.xs }}>
                {isCredit ? "Money in" : "Money out"}
                {tx.editedAt ? " · edited" : ""}
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
                <Text style={{ color: statusColor, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                  {STATUS_LABEL[status]}
                </Text>
              </View>
              {rejected && (
                <Text style={{ color: colors.textTertiary, fontSize: fontSize.sm, marginTop: spacing.sm }}>
                  {"Not counted in the pool totals"}
                </Text>
              )}
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
            keyboardShouldPersistTaps="handled"
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
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Date</Text>
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.medium }}>
                  {formatDate(tx.date)}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.row}>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Remarks</Text>
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
                          { borderColor: color, backgroundColor: hollow ? "transparent" : color },
                        ]}
                      />
                      {!last && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                    </View>
                    <View style={[styles.tlBody, { paddingBottom: last ? 0 : spacing.lg }]}>
                      <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.medium }}>
                        {timelineTitle(e)}
                      </Text>
                      {when && (
                        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 }}>
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
          </ScrollView>

          {footer()}
        </Pressable>
      </Pressable>
      {/* A toast raised while this Modal is open must render inside it (Android). */}
      {visible ? <ToastHost /> : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerMain: { flex: 1, alignItems: "flex-start" },
  pill: { paddingHorizontal: 12, paddingVertical: 4 },
  scroll: { flexGrow: 0, flexShrink: 1 },
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
  input: {
    borderWidth: 1,
    minHeight: 72,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1.5,
  },
});

export default React.memo(PoolTxDetailsSheet);
