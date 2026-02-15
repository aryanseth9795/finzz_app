import api from "./axios";

export const loginApi = (phone: string, password: string) =>
  api.post("/users/login", { phone, password });

export const registerApi = (name: string, phone: string, password: string) =>
  api.post("/users/register", { name, phone, password });

export const logoutApi = () => api.get("/users/logout");

export const refreshTokenApi = (refreshToken: string) =>
  api.post(
    "/users/refresh",
    {},
    { headers: { Authorization: `Bearer ${refreshToken}` } },
  );

export const getProfileApi = () => api.get("/users/profile");

export const updateProfileApi = (data: { name?: string }) =>
  api.put("/users/profile", data);

export const updatePushTokenApi = (pushToken: string) =>
  api.post("/users/push-token", { pushToken });

export const uploadAvatarApi = (imageUri: string) => {
  const formData = new FormData();
  formData.append("avatar", {
    uri: imageUri,
    type: "image/jpeg",
    name: "avatar.jpg",
  } as any);

  return api.post("/users/upload-avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
