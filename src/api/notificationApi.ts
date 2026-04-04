import api from "./axios";

export const getNotificationsApi = (limit = 50) =>
  api.get("/notifications", { params: { limit } });

export const markNotificationReadApi = (id: string) =>
  api.patch(`/notifications/${id}/read`);

export const markAllNotificationsReadApi = () =>
  api.patch("/notifications/read-all");
