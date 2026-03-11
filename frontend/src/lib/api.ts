import axios from "axios";
import {
  clearAuthStorage,
  getAccessToken,
  getImpersonationBackup,
  getRefreshToken,
  restoreAuthFromImpersonationBackup,
  updateAccessToken
} from "./auth-storage";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const api = axios.create({
  baseURL
});

let isRefreshing = false;
let pendingRequests: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(callback: (token: string | null) => void) {
  pendingRequests.push(callback);
}

function onRefreshed(token: string | null) {
  pendingRequests.forEach((callback) => callback(token));
  pendingRequests = [];
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      if (!getImpersonationBackup() || !restoreAuthFromImpersonationBackup()) {
        clearAuthStorage();
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((token) => {
          if (!token) {
            reject(error);
            return;
          }

          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post(`${baseURL}/auth/refresh`, {
        refreshToken
      });

      updateAccessToken(response.data.accessToken);
      onRefreshed(response.data.accessToken);

      originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      onRefreshed(null);
      if (!getImpersonationBackup() || !restoreAuthFromImpersonationBackup()) {
        clearAuthStorage();
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
