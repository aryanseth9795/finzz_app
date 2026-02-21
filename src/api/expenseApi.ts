import api from "./axios";

export const addExpenseApi = (data: {
  amount: number;
  date: string;
  remarks?: string;
  category?: string;
}) => api.post("/expenses", data);

export const getExpensesApi = (
  ledgerId?: string,
  cursor?: string,
  limit?: number,
) => api.get("/expenses", { params: { ledgerId, cursor, limit } });

export const editExpenseApi = (id: string, data: object) =>
  api.put(`/expenses/${id}`, data);

export const deleteExpenseApi = (id: string) => api.delete(`/expenses/${id}`);

export const checkDuplicateExpenseApi = (amount: number, date: string) =>
  api.get("/expenses/check-duplicate", { params: { amount, date } });

export const getExpenseStatsApi = (period?: string) =>
  api.get("/expenses/stats", { params: { period } });

export const getAdvancedStatsApi = (year?: number, month?: number) =>
  api.get("/expenses/advanced-stats", { params: { year, month } });

export const getExpenseLedgersApi = () => api.get("/expenses/ledgers");

export const closeLedgerApi = (year: number, month: number) =>
  api.post("/expenses/ledgers/close", { year, month });

export const getExpenseExportHtmlApi = (ledgerId: string) =>
  api.get("/expenses/export", { params: { ledgerId } });
