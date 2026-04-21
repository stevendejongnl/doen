import { api } from './api';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserPreferences {
  todo_view?: 'list' | 'kanban' | 'calendar';
  calendar_range?: 'day' | 'week' | 'month';
}

export interface Me {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  disabled_at?: string | null;
  last_login_at?: string | null;
  preferences?: UserPreferences;
}

export interface AuthStatus {
  has_users: boolean;
}

const BASE = import.meta.env.VITE_API_URL ?? '';

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${BASE}/auth/status`);
  if (!res.ok) return { has_users: true }; // safe default
  return res.json();
}

export async function login(email: string, password: string): Promise<Me> {
  const tokens = await api.post<AuthTokens>('/auth/login', { email, password });
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
  return api.get<Me>('/auth/me');
}

export async function registerFirst(
  email: string,
  name: string,
  password: string,
): Promise<Me> {
  const tokens = await api.post<AuthTokens>('/auth/register', { email, name, password });
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
  return api.get<Me>('/auth/me');
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post<void>('/auth/password-reset/request', { email });
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post<void>('/auth/password-reset/confirm', {
    token,
    new_password: newPassword,
  });
}

export function getMe(): Promise<Me> {
  return api.get<Me>('/auth/me');
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('access_token');
}
