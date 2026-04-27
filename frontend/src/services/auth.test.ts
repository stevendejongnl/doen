import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.unmock('../services/api');
vi.unmock('../services/auth');

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
  },
  logout: vi.fn(),
  purgeOffers: vi.fn(),
  resetBalances: vi.fn(),
  adjustBalance: vi.fn(),
  sseConnect: vi.fn(),
}));

import { api } from '../services/api';
import {
  getAuthStatus, login, registerFirst, requestPasswordReset,
  confirmPasswordReset, getMe, isLoggedIn,
} from './auth';

const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

const tokens = { access_token: 'acc', refresh_token: 'ref', token_type: 'bearer' };
const me = { id: 'u1', email: 'me@example.com', name: 'Me', is_admin: false };

describe('auth service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    localStorage.clear();
  });

  describe('getAuthStatus', () => {
    it('returns parsed status when ok', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ has_users: true }) } as Response);
      const status = await getAuthStatus();
      expect(status).toEqual({ has_users: true });
    });

    it('returns safe default when not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false } as Response);
      const status = await getAuthStatus();
      expect(status).toEqual({ has_users: true });
    });
  });

  describe('login', () => {
    it('posts credentials, stores tokens, and returns me', async () => {
      vi.mocked(api.post).mockResolvedValue(tokens);
      vi.mocked(api.get).mockResolvedValue(me);
      const result = await login('me@example.com', 'pass');
      expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'me@example.com', password: 'pass' });
      expect(localStorage.getItem('access_token')).toBe('acc');
      expect(localStorage.getItem('refresh_token')).toBe('ref');
      expect(result).toEqual(me);
    });
  });

  describe('registerFirst', () => {
    it('posts registration, stores tokens, and returns me', async () => {
      vi.mocked(api.post).mockResolvedValue(tokens);
      vi.mocked(api.get).mockResolvedValue(me);
      const result = await registerFirst('me@example.com', 'Me', 'pass');
      expect(api.post).toHaveBeenCalledWith('/auth/register', { email: 'me@example.com', name: 'Me', password: 'pass' });
      expect(localStorage.getItem('access_token')).toBe('acc');
      expect(result).toEqual(me);
    });
  });

  describe('requestPasswordReset', () => {
    it('posts to password reset request endpoint', async () => {
      vi.mocked(api.post).mockResolvedValue(undefined);
      await requestPasswordReset('me@example.com');
      expect(api.post).toHaveBeenCalledWith('/auth/password-reset/request', { email: 'me@example.com' });
    });
  });

  describe('confirmPasswordReset', () => {
    it('posts to password reset confirm endpoint', async () => {
      vi.mocked(api.post).mockResolvedValue(undefined);
      await confirmPasswordReset('tok123', 'newpass');
      expect(api.post).toHaveBeenCalledWith('/auth/password-reset/confirm', { token: 'tok123', new_password: 'newpass' });
    });
  });

  describe('getMe', () => {
    it('calls api.get /auth/me', async () => {
      vi.mocked(api.get).mockResolvedValue(me);
      const result = await getMe();
      expect(api.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(me);
    });
  });

  describe('isLoggedIn', () => {
    it('returns true when access_token is set', () => {
      localStorage.setItem('access_token', 'tok');
      expect(isLoggedIn()).toBe(true);
    });

    it('returns false when no access_token', () => {
      expect(isLoggedIn()).toBe(false);
    });
  });
});
