import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import dayjs from "dayjs";
import { useTheme } from "../contexts/ThemeContext";
import Avatar from "./ui/Avatar";
import { IChat } from "../types";
import { otherMember, isRefTo } from "../utils/entities";

interface ChatCardProps {
  chat: IChat;
  currentUserId: string;
  onPress: () => void;
}

const ChatCard: React.FC<ChatCardProps> = ({
  chat,
  currentUserId,
  onPress,
}) => {
  const { theme } = useTheme();
  const { colors, fontSize: fs, spacing: sp } = theme;

  /**
   * The counterparty, tolerating deleted users.
   *
   * `chat.members.find(m => m._id !== currentUserId)` threw a TypeError on a
   * `null` member — inside `Array.prototype.find`, which is why it surfaced as
   * an unexplained red screen rather than a handled error, on the HOME TAB,
   * the app's landing screen.
   *
   * Nulls got there because the server's delete cascade left dangling
   * ObjectIds that `populate` resolves to null. That cascade is fixed, but
   * corrupt rows already exist in production, so the client must not assume
   * they are gone.
   */
  const friend = otherMember(chat.members, currentUserId);
  const lastTx = chat.lastTransaction;

  // A chat whose only other member was deleted still renders, as a tombstone,
  // rather than taking down the whole list.
  const displayName = friend?.name ?? "Deleted user";
  const isCredit = isRefTo(lastTx?.to, currentUserId);

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    const date = dayjs(dateStr);
    const now = dayjs();
    if (date.isSame(now, "day")) return date.format("h:mm A");
    if (date.isSame(now.subtract(1, "day"), "day")) return "Yesterday";
    if (date.isSame(now, "year")) return date.format("DD MMM");
    return date.format("DD/MM/YY");
  };


  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={[
        styles.container,
        {
          borderBottomColor: colors.separatorLight || colors.separator,
        },
      ]}
    >
      <Avatar uri={friend?.avatar} name={displayName} size={56} />

      <View style={styles.content}>
        <View style={styles.mainInfo}>
          <Text
            style={[styles.name, { color: colors.text, fontSize: fs.lg }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {lastTx ? (
            <Text
              style={[
                styles.preview,
                { color: colors.textTertiary, fontSize: fs.sm },
              ]}
              numberOfLines={1}
            >
              {lastTx.remark ||
                (isCredit ? "Received payment" : "Sent payment")}
            </Text>
          ) : (
            <Text
              style={[
                styles.preview,
                { color: colors.textTertiary, fontSize: fs.sm },
              ]}
            >
              Tap to start chatting
            </Text>
          )}
        </View>

        <View style={styles.metaInfo}>
          {lastTx?.date && (
            <Text
              style={[
                styles.date,
                { color: colors.textTertiary, fontSize: 11 },
              ]}
            >
              {formatDate(lastTx.date)}
            </Text>
          )}
          {/* {lastTx && (
            <View
              style={[
                styles.amountBadge,
                {
                  backgroundColor: isCredit ? colors.creditBg : colors.debitBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.amount,
                  {
                    color: isCredit ? colors.credit : colors.debit,
                    fontSize: 13,
                  },
                ]}
              >
                {isCredit ? "+" : "-"}₹{lastTx.amount?.toLocaleString("en-IN")}
              </Text>
            </View>
          )} */}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mainInfo: {
    flex: 1,
    marginRight: 12,
    justifyContent: "center",
  },
  name: {
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  preview: {
    fontWeight: "500",
    opacity: 0.8,
  },
  metaInfo: {
    alignItems: "flex-end",
    gap: 6,
  },
  date: {
    fontWeight: "600",
    opacity: 0.7,
  },
  amountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  amount: {
    fontWeight: "700",
  },
});

export default React.memo(ChatCard);
