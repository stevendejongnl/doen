import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-login';
import type { PageLogin } from './page-login';
import { ApiError } from '../services/api';
import { login, registerFirst, requestPasswordReset, getAuthStatus } from '../services/auth';

describe('page-login', () => {
  let el: PageLogin;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  function $(selector: string) {
    const found = el.shadowRoot!.querySelector(selector);
    if (!found) throw new Error(`"${selector}" not found`);
    return found as HTMLElement;
  }
  function $$(selector: string) {
    return Array.from(el.shadowRoot!.querySelectorAll(selector)) as HTMLElement[];
  }

  describe('login mode', () => {
    beforeEach(async () => {
      vi.mocked(getAuthStatus).mockResolvedValue({ has_users: true });
      el = await mount<PageLogin>('page-login');
      await flushPromises();
      await el.updateComplete;
    });

    it('renders login form', async () => {
      expect($$('input').length).toBeGreaterThanOrEqual(2);
    });

    it('shows brand name', async () => {
      expect(el.shadowRoot!.textContent).toContain('Doen');
    });

    it('calls login on submit', async () => {
      const user = { id: 'u1', email: 'a@b.com', name: 'Test', is_admin: false };
      vi.mocked(login).mockResolvedValue(user as never);
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'a@b.com';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'password123';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      expect(vi.mocked(login)).toHaveBeenCalledWith('a@b.com', 'password123');
    });

    it('fires logged-in event on success', async () => {
      const user = { id: 'u1', email: 'a@b.com', name: 'Test', is_admin: false };
      vi.mocked(login).mockResolvedValue(user as never);
      const events: CustomEvent[] = [];
      el.addEventListener('logged-in', (e) => events.push(e as CustomEvent));
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'a@b.com';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'password123';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(events[0]?.detail).toEqual(user);
    });

    it('shows error on login failure', async () => {
      vi.mocked(login).mockRejectedValue(new ApiError(401, 'invalid'));
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'a@b.com';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'wrongpass';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.error')).toBeTruthy();
    });

    it('shows disabled account error on 403', async () => {
      vi.mocked(login).mockRejectedValue(new ApiError(403, 'forbidden'));
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'a@b.com';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'pass';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('uitgeschakeld');
    });

    it('shows generic error on network failure', async () => {
      vi.mocked(login).mockRejectedValue(new Error('network'));
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'a@b.com';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'pass123';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.error')).toBeTruthy();
    });

    it('navigates to forgot mode on link click', async () => {
      ($('.link-btn') as HTMLButtonElement).click();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('herstellen');
    });

    it('does nothing when _loading is true on login submit', async () => {
      (el as any)._loading = true;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      expect(vi.mocked(login)).not.toHaveBeenCalled();
    });
  });

  describe('register-first mode', () => {
    beforeEach(async () => {
      vi.mocked(getAuthStatus).mockResolvedValue({ has_users: false });
      el = await mount<PageLogin>('page-login');
      await flushPromises();
      await el.updateComplete;
    });

    it('shows register first form', async () => {
      expect(el.shadowRoot!.textContent).toContain('Beheerder aanmaken');
    });

    it('registers first user', async () => {
      const user = { id: 'u1', email: 'admin@example.com', name: 'Admin', is_admin: true };
      vi.mocked(registerFirst).mockResolvedValue(user as never);
      const events: CustomEvent[] = [];
      el.addEventListener('logged-in', (e) => events.push(e as CustomEvent));
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'Admin';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'admin@example.com';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[2].value = 'adminpass123';
      inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(events[0]?.detail).toEqual(user);
    });

    it('shows error when password too short', async () => {
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'Admin';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'admin@example.com';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[2].value = 'abc';
      inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.error')).toBeTruthy();
    });

    it('shows error on registration failure', async () => {
      vi.mocked(registerFirst).mockRejectedValue(new ApiError(409, 'conflict'));
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'Admin';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'admin@example.com';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[2].value = 'goodpass123';
      inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.error')).toBeTruthy();
    });

    it('shows generic error on non-ApiError registration failure', async () => {
      vi.mocked(registerFirst).mockRejectedValue(new Error('network error'));
      const inputs = $$('input') as HTMLInputElement[];
      inputs[0].value = 'Admin';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = 'admin@example.com';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[2].value = 'goodpass123';
      inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect((el as any)._error).toContain('Verbinding mislukt');
    });

    it('does nothing when _loading is true on register submit', async () => {
      (el as any)._loading = true;
      const fakeEvent = { preventDefault: vi.fn() } as unknown as Event;
      await (el as any)._submitRegisterFirst(fakeEvent);
      expect(vi.mocked(registerFirst)).not.toHaveBeenCalled();
    });
  });

  describe('forgot password mode', () => {
    beforeEach(async () => {
      vi.mocked(getAuthStatus).mockResolvedValue({ has_users: true });
      el = await mount<PageLogin>('page-login');
      await flushPromises();
      await el.updateComplete;
      // Navigate to forgot mode
      ($('.link-btn') as HTMLButtonElement).click();
      await el.updateComplete;
    });

    it('shows forgot password form', async () => {
      expect(el.shadowRoot!.textContent).toContain('herstellen');
    });

    it('does nothing when email is empty on forgot submit', async () => {
      (el as any)._email = '';
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      expect(vi.mocked(requestPasswordReset)).not.toHaveBeenCalled();
    });

    it('does nothing when _loading is true on forgot submit', async () => {
      (el as any)._loading = true;
      (el as any)._email = 'x@x.com';
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      expect(vi.mocked(requestPasswordReset)).not.toHaveBeenCalled();
    });

    it('submits forgot password request', async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue(undefined as never);
      const input = $('input[type="email"]') as HTMLInputElement;
      input.value = 'user@example.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.success')).toBeTruthy();
    });

    it('shows confirmation even on error (privacy)', async () => {
      vi.mocked(requestPasswordReset).mockRejectedValue(new Error('not found'));
      const input = $('input[type="email"]') as HTMLInputElement;
      input.value = 'user@example.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.success')).toBeTruthy();
    });

    it('goes back to login on back button', async () => {
      const backBtn = $$('.link-btn').find(b => b.textContent?.includes('Terug'))!;
      (backBtn as HTMLButtonElement).click();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('Inloggen');
    });

  it('shows error in forgot form when _error is set', async () => {
    (el as any)._error = 'Something went wrong';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.error')).toBeTruthy();
  });

    it('goes back to login after reset sent', async () => {
      vi.mocked(requestPasswordReset).mockResolvedValue(undefined as never);
      const input = $('input[type="email"]') as HTMLInputElement;
      input.value = 'user@example.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
      await el.updateComplete;
      (el.shadowRoot!.querySelector('.link-btn') as HTMLButtonElement).click();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('Inloggen');
    });
  });
});
