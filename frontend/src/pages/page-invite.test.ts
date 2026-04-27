import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-invite';
import type { PageInvite } from './page-invite';
import { api, ApiError } from '../services/api';
import { isLoggedIn, getMe } from '../services/auth';

describe('page-invite', () => {
  let el: PageInvite;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const details = {
    group_id: 'g1',
    group_name: 'The Group',
    inviter_name: 'Alice',
    email: 'bob@example.com',
    existing_user: false,
  };

  function $(selector: string) {
    const found = el.shadowRoot!.querySelector(selector);
    if (!found) throw new Error(`"${selector}" not found in shadow DOM`);
    return found as HTMLElement;
  }

  it('shows loading state initially', async () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // never resolves
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    expect(el.shadowRoot!.textContent).toContain('laden');
  });

  it('shows error when invitation not found', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(410, 'expired'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('verlopen');
  });

  it('shows signup form for new user not logged in', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('form')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('Account aanmaken');
  });

  it('shows accept button for logged-in user with matching email', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'bob@example.com', name: 'Bob', is_admin: false });
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.btn')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('accepteren');
  });

  it('shows wrong account message when logged-in email does not match', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockResolvedValue({ id: 'u2', email: 'other@example.com', name: 'Other', is_admin: false });
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Verkeerd account');
  });

  it('shows login link for existing user not logged in', async () => {
    const existingUserDetails = { ...details, existing_user: true };
    vi.mocked(api.get).mockResolvedValue(existingUserDetails);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('al een account');
  });

  it('accepts invitation as existing logged-in user', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'bob@example.com', name: 'Bob', is_admin: false });
    vi.mocked(api.post).mockResolvedValue({ group_id: 'g1', user_id: 'u1', tokens: null });
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.btn') as HTMLElement).click();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Gelukt');
  });

  it('shows error when accepting fails', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'bob@example.com', name: 'Bob', is_admin: false });
    vi.mocked(api.post).mockRejectedValue(new ApiError(400, 'Bad request'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.btn') as HTMLElement).click();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.error')).toBeTruthy();
  });

  it('signs up new user with name and password', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    vi.mocked(api.post).mockResolvedValue({
      group_id: 'g1', user_id: 'u1',
      tokens: { access_token: 'at', refresh_token: 'rt' },
    });
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;

    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    const pwInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="password"]')!;
    nameInput.value = 'Bob';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput.value = 'password123';
    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Gelukt');
  });

  it('shows general error when invitation load fails generically', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('niet laden');
  });

  it('shows expired message when invite returns 410', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(410, 'Gone'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('verlopen');
  });

  it('_onNameInput sets _name', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    (el as any)._onNameInput({ target: { value: 'Alice' } });
    expect((el as any)._name).toBe('Alice');
  });

  it('_onPasswordInput sets _password', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    (el as any)._onPasswordInput({ target: { value: 'secret123' } });
    expect((el as any)._password).toBe('secret123');
  });

  it('_acceptAsExistingUser shows generic error for non-ApiError', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'bob@example.com', name: 'Bob', is_admin: false });
    vi.mocked(api.post).mockRejectedValue(new Error('network error'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    await (el as any)._acceptAsExistingUser();
    await flushPromises();
    expect((el as any)._error).toContain('mislukt');
  });

  it('shows non-410 API error from _load', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(500, 'server error'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('server error');
  });

  it('shows generic error when _load fails with non-ApiError', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('connection reset'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Kan uitnodiging niet laden');
  });

  it('sets _currentEmail to null when getMe fails for logged-in user', async () => {
    vi.mocked(api.get).mockResolvedValue({ ...details, existing_user: true });
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockRejectedValue(new Error('auth fail'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._currentEmail).toBeNull();
  });

  it('setTimeout redirect fires after accept as existing user', async () => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'bob@example.com', name: 'Bob', is_admin: false });
    vi.mocked(api.post).mockResolvedValue({ group_id: 'g1', user_id: 'u1', tokens: null });
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await vi.runAllTimersAsync();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.btn') as HTMLElement).click();
    await vi.runAllTimersAsync();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Gelukt');
    vi.useRealTimers();
  });

  it('setTimeout redirect fires after signup', async () => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    vi.mocked(api.post).mockResolvedValue({
      group_id: 'g1', user_id: 'u1',
      tokens: { access_token: 'at', refresh_token: 'rt' },
    });
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await vi.runAllTimersAsync();
    await el.updateComplete;
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    const pwInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="password"]')!;
    nameInput.value = 'Bob';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput.value = 'password123';
    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.runAllTimersAsync();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Gelukt');
    vi.useRealTimers();
  });

  it('_acceptAsExistingUser returns early when no details', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'bob@example.com', name: 'Bob', is_admin: false });
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    (el as any)._details = null;
    await (el as any)._acceptAsExistingUser();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_acceptWithSignup returns early when password too short', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    const pwInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="password"]')!;
    nameInput.value = 'Bob';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput.value = 'short';
    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_acceptWithSignup without tokens still shows success', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    vi.mocked(api.post).mockResolvedValue({ group_id: 'g1', user_id: 'u1', tokens: null });
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    const pwInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="password"]')!;
    nameInput.value = 'Bob';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput.value = 'password123';
    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Gelukt');
  });

  it('_acceptWithSignup non-ApiError sets generic error', async () => {
    vi.mocked(api.get).mockResolvedValue(details);
    vi.mocked(isLoggedIn).mockReturnValue(false);
    vi.mocked(api.post).mockRejectedValue(new Error('network error'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    const pwInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="password"]')!;
    nameInput.value = 'Bob';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput.value = 'password123';
    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._error).toContain('mislukt');
  });

  it('shows error when register fails', async () => {
    const inviteDetails = {
      group_id: 'g1', group_name: 'G', inviter_name: 'Alice',
      email: 'bob@example.com', existing_user: false,
    };
    vi.mocked(api.get).mockResolvedValue(inviteDetails);
    vi.mocked(api.post).mockRejectedValue(new ApiError(400, 'bad request'));
    el = await mount<PageInvite>('page-invite', { token: 'tok1' });
    await flushPromises();
    await el.updateComplete;

    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    const pwInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="password"]')!;
    nameInput.value = 'Bob';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput.value = 'password123';
    pwInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._error).toBeTruthy();
    expect((el as any)._submitting).toBe(false);
  });
});
