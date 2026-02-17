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
import CreatePoolScreen from "../screens/pool/CreatePoolScreen";
import PoolChatScreen from "../screens/pool/PoolChatScreen";
import AddEditPoolTxScreen from "../screens/pool/AddEditPoolTxScreen";
import PoolSettingsScreen from "../screens/pool/PoolSettingsScreen";
import PoolStatsScreen from "../screens/pool/PoolStatsScreen";
import EditPoolScreen from "../screens/pool/EditPoolScreen";
import AccountScreen from "../screens/account/AccountScreen";
import ReportScreen from "../screens/reports/ReportScreen";
// Expense screens
import ExpenseScreen from "../screens/expense/ExpenseScreen";
import AddEditExpenseScreen from "../screens/expense/AddEditExpenseScreen";
import ExpenseStatsScreen from "../screens/expense/ExpenseStatsScreen";

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
// Pool Stack (Tab 2)
// ========================
const PoolStack = createNativeStackNavigator();

const PoolStackNavigator = () => {
  return (
    <PoolStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <PoolStack.Screen name="PoolList" component={PoolScreen} />
      <PoolStack.Screen name="CreatePool" component={CreatePoolScreen} />
      <PoolStack.Screen name="PoolChat" component={PoolChatScreen} />
      <PoolStack.Screen name="AddEditPoolTx" component={AddEditPoolTxScreen} />
      <PoolStack.Screen name="PoolSettings" component={PoolSettingsScreen} />
      <PoolStack.Screen name="PoolStats" component={PoolStatsScreen} />
      <PoolStack.Screen name="EditPool" component={EditPoolScreen} />
    </PoolStack.Navigator>
  );
};

// ========================
// Expense Stack (Tab 3 - Replaces Account)
// ========================
const ExpenseStack = createNativeStackNavigator();

const ExpenseStackNavigator = () => {
  return (
    <ExpenseStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <ExpenseStack.Screen name="ExpenseHome" component={ExpenseScreen} />
      <ExpenseStack.Screen
        name="AddEditExpense"
        component={AddEditExpenseScreen}
      />
      <ExpenseStack.Screen name="ExpenseStats" component={ExpenseStatsScreen} />
      <ExpenseStack.Screen name="AccountHome" component={AccountScreen} />
    </ExpenseStack.Navigator>
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
            case "Expenses":
              iconName = focused ? "wallet" : "wallet-outline";
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
          paddingTop: 1,
          paddingBottom: 1,
          height: 95,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 2,
        },
      })}
    >
      <Tab.Screen name="Chats" component={ChatsStackNavigator} />
      <Tab.Screen name="Pool" component={PoolStackNavigator} />
      <Tab.Screen name="Expenses" component={ExpenseStackNavigator} />
    </Tab.Navigator>
  );
};

export default MainTabs;
