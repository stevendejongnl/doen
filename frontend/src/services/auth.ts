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
  preferences?: UserPreferences;
}

export async function login(email: string, password: string): Promise<Me> {
  const tokens = await api.post<AuthTokens>('/auth/login', { email, password });
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
  return api.get<Me>('/auth/me');
}

export function getMe(): Promise<Me> {
  return api.get<Me>('/auth/me');
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('access_token');
}
