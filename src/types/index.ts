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
