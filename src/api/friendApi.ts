import api from "./axios";

export const searchByPhoneApi = (phone: string) =>
  api.post("/friends/search", { phone });

export const checkContactsApi = (phoneNumbers: string[]) =>
  api.post("/friends/check-contacts", { phoneNumbers });

export const sendFriendRequestApi = (toUserId: string) =>
  api.post("/friends/request", { toUserId });

export const getPendingRequestsApi = () => api.get("/friends/requests");

export const acceptFriendRequestApi = (requestId: string) =>
  api.post("/friends/accept", { requestId });

export const rejectFriendRequestApi = (requestId: string) =>
  api.post("/friends/reject", { requestId });

export const getFriendsListApi = () => api.get("/friends/list");

export const removeFriendApi = (friendId: string) =>
  api.delete(`/friends/remove/${friendId}`);
