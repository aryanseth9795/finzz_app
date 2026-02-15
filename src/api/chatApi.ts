import api from "./axios";

export const getUserChatsApi = () => api.get("/chats");

export const getChatByIdApi = (chatId: string) => api.get(`/chats/${chatId}`);
