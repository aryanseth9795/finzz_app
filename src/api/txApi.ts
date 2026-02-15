import api from "./axios";

export const addTxApi = (data: {
  chatId: string;
  amount: number;
  date: string;
  remarks?: string;
  to: string;
  from: string;
}) => api.post("/txns/createtx", data);

export const getTxnsApi = (
  chatId: string,
  cursor?: string,
  year?: number,
  month?: number,
) => {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  if (year) params.append("year", year.toString());
  if (month) params.append("month", month.toString());
  const qs = params.toString();
  return api.get(`/txns/gettx/${chatId}${qs ? `?${qs}` : ""}`);
};

export const verifyTxApi = (txnId: string) =>
  api.post("/txns/verifytx", { txnId });

export const editTxApi = (txnId: string, data: object) =>
  api.put(`/txns/edittx/${txnId}`, data);

export const deleteTxApi = (txnId: string) =>
  api.delete(`/txns/deletetx/${txnId}`);

export const getAllUserTxnsApi = () => api.get("/txns/usersfriend");
