import axios from "axios";
import { BASE_URL } from "../constants/api";

/**
 * Public release info for the forced-update gate.
 *
 * Deliberately NOT the authenticated `api` instance: its 401 interceptor
 * refreshes tokens and can sign the user out, and a version check must never
 * be able to do that. Short timeout: never hold up launch.
 */
export const getAppVersionApi = () =>
  axios.get(`${BASE_URL}/app/version`, { timeout: 5000 });
