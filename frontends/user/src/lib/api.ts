import axios from 'axios';
import { io, Socket } from 'socket.io-client';

export const API_BASE = (import.meta as any).env.VITE_API_BASE_URL as string;
export const USER_URL = (import.meta as any).env.VITE_USER_URL as string;

const TOKEN_KEY = 'tuneslam.userToken';

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) setToken(null);
    return Promise.reject(err);
  },
);

export function makeSocket(): Socket | null {
  const t = getToken();
  if (!t) return null;
  return io(API_BASE, { transports: ['websocket'], auth: { token: t } });
}

export function errMsg(e: any): string {
  return e?.response?.data?.error || e?.message || 'Something went wrong';
}
