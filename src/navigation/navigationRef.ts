import {
  createNavigationContainerRef,
  CommonActions,
} from "@react-navigation/native";
import { routeForNotification } from "../utils/notificationRoute";

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
 * Resolve once the navigator has mounted, or `false` after `timeoutMs`.
 *
 * A cold-start tap is read while the splash screen is still showing, before
 * the NavigationContainer exists; routing it immediately silently dropped it.
 */
export const waitForNavigation = (timeoutMs = 10000): Promise<boolean> =>
  new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      if (navigationRef.isReady()) return resolve(true);
      if (Date.now() - started >= timeoutMs) return resolve(false);
      setTimeout(poll, 100);
    };
    poll();
  });

/**
 * Route a notification payload to the screen it refers to.
 *
 * Nested navigators need an explicit tab plus a `screen` param; navigating to
 * a bare screen name only searches the current navigator and its parents, not
 * sibling stacks — which is the same mistake that made the Account screen's
 * "Reports" menu item a silent no-op. The mapping lives in
 * `routeForNotification` so it can be tested without a navigator.
 */
export const routeNotification = (data: Record<string, unknown> | undefined) => {
  if (!navigationRef.isReady()) return;
  const route = routeForNotification(data);
  if (route) navigate(route.name, route.params);
};
