import api from "./axios";

/** Public release info for the forced-update gate. Short timeout: never hold up launch. */
export const getAppVersionApi = () => api.get("/app/version", { timeout: 5000 });
