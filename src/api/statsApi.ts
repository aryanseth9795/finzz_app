import api from "./axios";

export const getChatStatsApi = (
  chatId: string,
  year?: number,
  month?: number,
) => {
  const params = new URLSearchParams();
  if (year) params.append("year", year.toString());
  if (month) params.append("month", month.toString());
  const qs = params.toString();
  return api.get(`/stats/chat/${chatId}${qs ? `?${qs}` : ""}`);
};

export const getChatMonthsApi = (chatId: string) =>
  api.get(`/stats/chat/${chatId}/months`);

export const getMonthlyReportApi = () => api.get("/stats/monthly");

export const getPerFriendReportApi = (friendId: string) =>
  api.get(`/stats/friend/${friendId}`);
