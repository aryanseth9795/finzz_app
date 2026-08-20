import {
  createNavigationContainerRef,
  CommonActions,
} from "@react-navigation/native";

/**
 * Navigation reference usable from outside React components.
 *
 * Needed because notification taps arrive from a native listener that has no
 * access to a navigation prop. `useNotifications.handleNotificationTap` was a
 * stub that logged to the console and returned, with the routing logic
 * commented out — so tapping any push notification simply opened the app to
 * whatever screen it was last on.
 */
export const navigationRef = createNavigationContainerRef();

/** Navigate from outside the component tree, ignoring calls before mount. */
export const navigate = (name: string, params?: object) => {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(CommonActions.navigate({ name, params }));
};

/**
 * Route a notification payload to the screen it refers to.
 *
 * Nested navigators need an explicit tab plus a `screen` param; navigating to
 * a bare screen name only searches the current navigator and its parents, not
 * sibling stacks — which is the same mistake that made the Account screen's
 * "Reports" menu item a silent no-op.
 */
export const routeNotification = (data: Record<string, unknown> | undefined) => {
  if (!data || !navigationRef.isReady()) return;

  const type = String(data.type ?? "");
  const chatId = data.chatId ? String(data.chatId) : undefined;
  const poolId = data.poolId ? String(data.poolId) : undefined;

  switch (type) {
    case "txn_added":
    case "txn_verified":
    case "txn_rejected":
    case "txn_reworked":
    case "txn_deleted":
      if (chatId) {
        navigate("Chats", { screen: "ChatScreen", params: { chatId } });
      } else {
        navigate("Chats", { screen: "Home" });
      }
      return;

    case "friend_request":
    case "friend_accepted":
      navigate("Chats", { screen: "AddFriend" });
      return;

    case "pool_tx_added":
    case "pool_tx_verified":
    case "pool_member_added":
      if (poolId) {
        navigate("Pool", { screen: "PoolChat", params: { poolId } });
      } else {
        navigate("Pool", { screen: "PoolList" });
      }
      return;

    case "pool_member_removed":
      navigate("Pool", { screen: "PoolList" });
      return;

    default:
      // Unknown or admin broadcast: the notification feed is the useful
      // destination, rather than doing nothing at all.
      navigate("Expenses", { screen: "Notifications" });
  }
};
