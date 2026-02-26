import api from "./axios";

export const loginApi = (phone: string, password: string) =>
  api.post("/users/login", { phone, password });

export const registerApi = (
  name: string,
  phone: string,
  email: string,
  password: string,
) => api.post("/users/register", { name, phone, email, password });

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

// ─── OTP / Email Verification ───────────────────────────────
export const sendOtpApi = (email: string) =>
  api.post("/users/send-otp", { email });

export const verifyOtpApi = (email: string, otp: string) =>
  api.post("/users/verify-otp", { email, otp });

export const forgotPasswordApi = (email: string) =>
  api.post("/users/forgot-password", { email });

export const resetPasswordApi = (
  email: string,
  otp: string,
  newPassword: string,
) => api.post("/users/reset-password", { email, otp, newPassword });

export const changePasswordApi = (oldPassword: string, newPassword: string) =>
  api.post("/users/change-password", { oldPassword, newPassword });

export const sendVerifyEmailOtpApi = (email: string) =>
  api.post("/users/send-verify-email-otp", { email });

export const verifyEmailApi = (email: string, otp: string) =>
  api.post("/users/verify-email", { email, otp });
