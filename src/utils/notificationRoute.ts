/**
 * Where a notification tap should land.
 *
 * Pure so it can be tested without a navigator. `navigationRef` dispatches the
 * result; nested navigators need the tab name plus a `screen` param.
 */
export interface NotificationRoute {
  name: string;
  params?: object;
}

export const routeForNotification = (
  data: Record<string, unknown> | undefined,
): NotificationRoute | null => {
  if (!data) return null;

  const type = String(data.type ?? "");
  const chatId = data.chatId ? String(data.chatId) : undefined;
  const poolId = data.poolId ? String(data.poolId) : undefined;
  const noteId = data.noteId ? String(data.noteId) : undefined;

  switch (type) {
    case "txn_added":
    case "txn_verified":
    case "txn_rejected":
    case "txn_reworked":
    case "txn_deleted":
      return chatId
        ? { name: "Chats", params: { screen: "ChatScreen", params: { chatId } } }
        : { name: "Chats", params: { screen: "Home" } };

    case "friend_request":
    case "friend_accepted":
      return { name: "Chats", params: { screen: "AddFriend" } };

    case "pool_tx_added":
    case "pool_tx_verified":
    case "pool_member_added":
      return poolId
        ? { name: "Pool", params: { screen: "PoolChat", params: { poolId } } }
        : { name: "Pool", params: { screen: "PoolList" } };

    case "pool_member_removed":
      return { name: "Pool", params: { screen: "PoolList" } };

    case "note_shared":
      return noteId
        ? {
            name: "Notes",
            // initial: false keeps NotesHome underneath when the stack has
            // not been mounted yet, so the editor has somewhere to go back to.
            params: {
              screen: "NoteEditor",
              params: { noteId },
              initial: false,
            },
          }
        : { name: "Notes", params: { screen: "NotesHome" } };

    default:
      // Unknown or admin broadcast. This used to target `Expenses →
      // Notifications`, a screen that is not registered — so every such tap
      // dropped the user on the Expenses tab instead.
      return { name: "Chats", params: { screen: "Home" } };
  }
};

/**
 * `getLastNotificationResponseAsync()` keeps returning the last tapped
 * notification on every cold start, so a launch tap must be acted on once,
 * keyed by its notification identifier.
 */
export const isNewLaunchResponse = (
  id: string,
  lastHandledId: string | null,
): boolean => !!id && id !== lastHandledId;
