// ========================
// User & Auth Types
// ========================
export interface IUser {
  _id: string;
  name: string;
  phone: string;
  avatar?: string;
}

export interface AuthResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  user: IUser;
}

// ========================
// Chat Types
// ========================
export interface ILastTransaction {
  amount: number;
  date: string;
  remark?: string;
  to: string;
  from: string;
}

export interface IChat {
  _id: string;
  members: IUser[];
  groupChat: boolean;
  lastTransaction?: ILastTransaction;
  createdAt: string;
  updatedAt: string;
}

// ========================
// Transaction Types
// ========================
export interface ITx {
  _id: string;
  chatId: string;
  amount: number;
  date: string;
  remarks?: string;
  to: string;
  from: string;
  addedBy: string | { _id: string; name: string }; // Can be ID or populated object
  verified: boolean;
  verifiedBy?: string | { _id: string; name: string }; // Can be ID or populated object
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITxPaginatedResponse {
  txns: ITx[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ========================
// Friend Types
// ========================
export interface IFriend {
  _id: string;
  name: string;
  phone: string;
  avatar?: string;
}

export interface IFriendRequest {
  _id: string;
  from: IUser;
  to: IUser;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface IContactSyncResult {
  registered: IFriend[];
  unregistered: string[];
}

// ========================
// Stats Types
// ========================
export interface IUserMonthlyStats {
  userId: string;
  name: string;
  totalSent: number;
  totalReceived: number;
  net: number; // positive = has to receive, negative = has to send
}

export interface IChatStats {
  year: number;
  month: number;
  members: Record<string, IUserMonthlyStats>;
  carryForward: Record<string, number>; // per-user opening balance from prior months
  txCount: number;
}

export interface IAvailableMonth {
  year: number;
  month: number;
  txCount: number;
}

export interface IMonthlyBreakdown {
  month: string;
  credit: number;
  debit: number;
  net: number;
}

// ========================
// Notification Types
// ========================
export interface INotification {
  _id: string;
  type: "friend_request" | "friend_accepted" | "txn_added" | "txn_verified";
  sender: IUser;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

// ========================
// Pool Types
// ========================
export interface IPool {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  rules?: string;
  admin: IUser;
  members: IUser[];
  status: "active" | "closed";
  lastTransaction?: {
    amount: number;
    date: string;
    remark: string;
    addedBy: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IPoolTx {
  _id: string;
  poolId: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  remarks?: string;
  addedBy: string | { _id: string; name: string };
  verified: boolean;
  verifiedBy?: string | { _id: string; name: string };
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IPoolStats {
  totalCredited: number;
  totalDebited: number;
  netBalance: number;
  durationDays: number;
  memberBreakdown: Array<{
    userId: string;
    name: string;
    totalCredited: number;
    totalDebited: number;
    net: number;
  }>;
}

// ========================
// Expense Types
// ========================
export interface IExpense {
  _id: string;
  userId: string;
  ledgerId: string;
  amount: number;
  date: string;
  remarks?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IExpenseLedger {
  _id: string;
  userId: string;
  year: number;
  month: number; // 1-12
  status: "open" | "closed";
  closedAt?: string;
  totalExpenses: number;
}

export interface IExpenseStats {
  daily?: Array<{ date: string; total: number; count: number }>;
  monthly?: Array<{ month: string; total: number; count: number }>;
  yearly?: Array<{ year: number; total: number; count: number }>;
  grandTotal: number;
}

export interface IAdvancedExpenseStats {
  selectedMonth: { year: number; month: number };
  summary: {
    total: number;
    count: number;
    avgDailySpend: number;
    activeDays: number;
  };
  monthlyTrend: Array<{
    month: string;
    year: number;
    monthNum: number;
    total: number;
    count: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    total: number;
    count: number;
  }>;
  categoryBreakdown: Array<{
    name: string;
    total: number;
    count: number;
    percentage: number;
  }>;
  top5Expenses: Array<{
    _id: string;
    amount: number;
    date: string;
    remarks: string;
    category: string;
  }>;
}
