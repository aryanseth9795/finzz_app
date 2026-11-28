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

/**
 * Edit (or, for a rejected entry, edit & resubmit). Send `expectedUpdatedAt`
 * (the entry's `updatedAt` as shown) so a change made meanwhile gives 409
 * instead of being overwritten. `remarks: ""` clears the remark.
 */
export const editPoolTxApi = (
  txnId: string,
  data: {
    amount?: number;
    type?: "credit" | "debit";
    date?: string;
    remarks?: string;
    expectedUpdatedAt?: string;
  },
) => api.put(`/pools/tx/${txnId}`, data);

export const deletePoolTxApi = (txnId: string) =>
  api.delete(`/pools/tx/${txnId}`);

/**
 * Verify or reject another member's pending entry (T-029). The reply carries
 * the updated entry; a 409 / 400 reply carries the latest one as `poolTx`.
 */
export const reviewPoolTxApi = (
  txnId: string,
  action: "verify" | "reject",
  remark?: string,
  expectedUpdatedAt?: string,
) =>
  api.post("/pools/tx/review", {
    txnId,
    action,
    ...(remark ? { remark } : {}),
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  });

// ========================
// Stats
// ========================

export const getPoolStatsApi = (poolId: string) =>
  api.get(`/pools/${poolId}/stats`);
