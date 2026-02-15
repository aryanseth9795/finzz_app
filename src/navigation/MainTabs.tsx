
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
// Screens
import HomeScreen from "../screens/home/HomeScreen";
import ChatScreen from "../screens/chat/ChatScreen";
import AddEditTxScreen from "../screens/chat/AddEditTxScreen";
import FriendsScreen from "../screens/friends/FriendsScreen";
import PoolScreen from "../screens/pool/PoolScreen";
import AccountScreen from "../screens/account/AccountScreen";
import ReportScreen from "../screens/reports/ReportScreen";

// ========================
// Chats Stack (Tab 1)
// ========================
const ChatsStack = createNativeStackNavigator();

const ChatsStackNavigator = () => {
  return (
    <ChatsStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <ChatsStack.Screen name="Home" component={HomeScreen} />
      <ChatsStack.Screen name="ChatScreen" component={ChatScreen} />
      <ChatsStack.Screen name="AddEditTx" component={AddEditTxScreen} />
      <ChatsStack.Screen name="AddFriend" component={FriendsScreen} />
      <ChatsStack.Screen name="Report" component={ReportScreen} />
    </ChatsStack.Navigator>
  );
};

// ========================
// Account Stack (Tab 3)
// ========================
const AccountStack = createNativeStackNavigator();

const AccountStackNavigator = () => {
  return (
    <AccountStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <AccountStack.Screen name="AccountHome" component={AccountScreen} />
      <AccountStack.Screen name="Report" component={ReportScreen} />
    </AccountStack.Navigator>
  );
};

// ========================
// Bottom Tab Navigator
// ========================
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "chatbubble";

          switch (route.name) {
            case "Chats":
              iconName = focused ? "chatbubbles" : "chatbubbles-outline";
              break;
            case "Pool":
              iconName = focused ? "people-circle" : "people-circle-outline";
              break;
            case "Account":
              iconName = focused ? "person-circle" : "person-circle-outline";
              break;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 2,
          paddingTop: 4,
          paddingBottom: 4,
          // marginBottom: 10,

          // height:60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 4,
        },
      })}
    >
      <Tab.Screen name="Chats" component={ChatsStackNavigator} />
      <Tab.Screen name="Pool" component={PoolScreen} />
      <Tab.Screen name="Account" component={AccountStackNavigator} />
    </Tab.Navigator>
  );
};

export default MainTabs;
