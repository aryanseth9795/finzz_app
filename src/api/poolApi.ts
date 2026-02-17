import api from "./axios";

// ========================
// Pool CRUD
// ========================

export const createPoolApi = (data: {
  name: string;
  description?: string;
  rules?: string;
}) => api.post("/pools/create", data);

export const getMyPoolsApi = () => api.get("/pools/my");

export const getPoolByIdApi = (poolId: string) => api.get(`/pools/${poolId}`);

export const updatePoolApi = (poolId: string, data: FormData | object) =>
  api.put(`/pools/${poolId}`, data);

export const deletePoolApi = (poolId: string) => api.delete(`/pools/${poolId}`);

// ========================
// Membership
// ========================

export const addPoolMemberApi = (poolId: string, userId: string) =>
  api.post(`/pools/${poolId}/add-member`, { userId });

export const removePoolMemberApi = (poolId: string, userId: string) =>
  api.post(`/pools/${poolId}/remove-member`, { userId });

export const leavePoolApi = (poolId: string) =>
  api.post(`/pools/${poolId}/leave`);

// ========================
// Status
// ========================

export const closePoolApi = (poolId: string) =>
  api.put(`/pools/${poolId}/close`);

export const reopenPoolApi = (poolId: string) =>
  api.put(`/pools/${poolId}/reopen`);

// ========================
// Transactions
// ========================

export const addPoolTxApi = (data: {
  poolId: string;
  amount: number;
  type: "credit" | "debit";
  date: string;
  remarks?: string;
}) => api.post("/pools/tx/create", data);

export const getPoolTxnsApi = (
  poolId: string,
  cursor?: string,
  year?: number,
  month?: number,
) => {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  if (year) params.append("year", year.toString());
  if (month) params.append("month", month.toString());
  const qs = params.toString();
  return api.get(`/pools/tx/${poolId}${qs ? `?${qs}` : ""}`);
};

export const editPoolTxApi = (txnId: string, data: object) =>
  api.put(`/pools/tx/${txnId}`, data);

export const deletePoolTxApi = (txnId: string) =>
  api.delete(`/pools/tx/${txnId}`);

export const verifyPoolTxApi = (txnId: string) =>
  api.post("/pools/tx/verify", { txnId });

// ========================
// Stats
// ========================

export const getPoolStatsApi = (poolId: string) =>
  api.get(`/pools/${poolId}/stats`);
