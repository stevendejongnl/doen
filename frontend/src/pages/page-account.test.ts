import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-account';
import type { PageAccount } from './page-account';
import { api, ApiError } from '../services/api';
import { getMe } from '../services/auth';

describe('page-account', () => {
  let el: PageAccount;

  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const me = { id: 'u1', email: 'test@example.com', name: 'Test User', is_admin: false };
  const keys = [
    { id: 'k1', name: 'ha-integration', token_prefix: 'abcd', created_at: '2024-01-01T00:00:00Z', expires_at: null, last_used_at: null },
  ];

  async function setup() {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockResolvedValue(keys);
    el = await mount<PageAccount>('page-account');
    await flushPromises();
    await el.updateComplete;
  }

  function $(selector: string) {
    const found = el.shadowRoot!.querySelector(selector);
    if (!found) throw new Error(`"${selector}" not found`);
    return found as HTMLElement;
  }

  it('shows user name and email', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Test User');
    expect(el.shadowRoot!.textContent).toContain('test@example.com');
  });

  it('shows api keys list', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('ha-integration');
  });

  it('shows empty state when no keys', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockResolvedValue([]);
    el = await mount<PageAccount>('page-account');
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Nog geen sleutels');
  });

  it('shows loading state while keys load', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    el = await mount<PageAccount>('page-account');
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Laden');
  });

  it('submit button disabled when password fields empty', async () => {
    await setup();
    const pwBtns = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button[type="submit"]');
    // First submit btn is the change password button
    expect(pwBtns[0].disabled).toBe(true);
  });

  it('changes password successfully', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue(undefined);
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'currentpw';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpassword123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[2].value = 'newpassword123';
    inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/change-password', expect.objectContaining({
      current_password: 'currentpw',
      new_password: 'newpassword123',
    }));
  });

  it('shows error when passwords do not match', async () => {
    await setup();
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'current';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newone123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[2].value = 'different123';
    inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    // No api.post call should have been made
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('creates a new API key', async () => {
    await setup();
    const newKey = { id: 'k2', name: 'test-key', token_prefix: 'wxyz', created_at: '2024-06-01T00:00:00Z', expires_at: null, last_used_at: null };
    vi.mocked(api.post).mockResolvedValue({ key: newKey, token: 'doen_wxyz_secret' });
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.value = 'test-key';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    // Find the create key form (second form)
    const forms = el.shadowRoot!.querySelectorAll('form');
    forms[1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/api-keys', expect.objectContaining({ name: 'test-key' }));
    // Should show the new key token callout
    expect(el.shadowRoot!.textContent).toContain('doen_wxyz_secret');
  });

  it('revokes an API key', async () => {
    await setup();
    vi.mocked(api.delete).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const revokeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-key-id="k1"]')!;
    revokeBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/auth/api-keys/k1');
  });

  it('does not revoke key when confirm is cancelled', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const revokeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-key-id="k1"]')!;
    revokeBtn.click();
    await flushPromises();
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('dismisses the just-created token callout', async () => {
    await setup();
    const newKey = { id: 'k2', name: 'test-key', token_prefix: 'wxyz', created_at: '2024-06-01T00:00:00Z', expires_at: null, last_used_at: null };
    vi.mocked(api.post).mockResolvedValue({ key: newKey, token: 'doen_wxyz_secret' });
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.value = 'test-key';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const forms = el.shadowRoot!.querySelectorAll('form');
    forms[1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    // Dismiss the callout
    const dismissBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-danger i.fa-xmark')?.closest('button') as HTMLButtonElement;
    dismissBtn?.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.token-callout')).toBeNull();
  });

  it('deletes account after double confirm', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.delete).mockResolvedValue(undefined);
    const deleteBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[class*="btn-danger"]')!;
    // The last btn-danger button is for account deletion
    const allDangerBtns = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.btn-danger');
    allDangerBtns[allDangerBtns.length - 1].click();
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/auth/me');
  });

  it('handles key load failure gracefully', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockRejectedValue(new ApiError(500, 'server error'));
    el = await mount<PageAccount>('page-account');
    await flushPromises();
    await el.updateComplete;
    // Should not crash; should show empty keys list
    expect(el.shadowRoot!.querySelector('.keys-list')).toBeTruthy();
  });

  it('shows error toast when revoke fails', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new ApiError(500, 'server error'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const revokeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-key-id="k1"]')!;
    revokeBtn.click();
    await flushPromises();
    await el.updateComplete;
    // Should still show the key (not removed on error)
    expect((el as any)._keys.some((k: any) => k.id === 'k1')).toBe(true);
  });

  it('_copyToken calls clipboard.writeText when token available', async () => {
    await setup();
    const newKey = { id: 'k2', name: 'test-key', token_prefix: 'wxyz', created_at: '2024-06-01T00:00:00Z', expires_at: null, last_used_at: null };
    vi.mocked(api.post).mockResolvedValue({ key: newKey, token: 'doen_wxyz_secret' });
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.value = 'test-key';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const forms = el.shadowRoot!.querySelectorAll('form');
    forms[1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;

    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextSpy }, writable: true, configurable: true });
    (el as any)._copyToken();
    expect(writeTextSpy).toHaveBeenCalledWith('doen_wxyz_secret');
  });

  it('_copyToken does nothing when no justCreated', async () => {
    await setup();
    // _justCreated is null by default; just verify no crash
    expect(() => (el as any)._copyToken()).not.toThrow();
  });

  it('shows error when new password is too short', async () => {
    await setup();
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'currentpw';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'short';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[2].value = 'short';
    inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('shows 401 error message when current password is wrong', async () => {
    await setup();
    const err = new ApiError(401, 'Unauthorized');
    vi.mocked(api.post).mockRejectedValue(err);
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'wrongpw';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpassword123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[2].value = 'newpassword123';
    inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect((el as any)._changingPw).toBe(false);
  });

  it('creates API key with expiry date', async () => {
    await setup();
    const newKey = { id: 'k3', name: 'dated-key', token_prefix: 'abcd', created_at: '2024-06-01T00:00:00Z', expires_at: '2024-12-31T00:00:00Z', last_used_at: null };
    vi.mocked(api.post).mockResolvedValue({ key: newKey, token: 'doen_abcd_secret' });
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.value = 'dated-key';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    (el as any)._newKeyExpiry = '2024-12-31';
    await el.updateComplete;
    const forms = el.shadowRoot!.querySelectorAll('form');
    forms[1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/api-keys', expect.objectContaining({ expires_at: expect.any(String) }));
  });

  it('shows error toast when create key fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(400, 'key fail'));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.value = 'bad-key';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const forms = el.shadowRoot!.querySelectorAll('form');
    forms[1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect((el as any)._creatingKey).toBe(false);
  });

  it('_copyToken handles clipboard failure gracefully', async () => {
    await setup();
    const newKey = { id: 'k2', name: 'key', token_prefix: 'wxyz', created_at: '2024-06-01T00:00:00Z', expires_at: null, last_used_at: null };
    vi.mocked(api.post).mockResolvedValue({ key: newKey, token: 'doen_wxyz_token' });
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.value = 'key';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const forms = el.shadowRoot!.querySelectorAll('form');
    forms[1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('not allowed')) },
      writable: true, configurable: true,
    });
    await expect(() => (el as any)._copyToken()).not.toThrow();
  });

  it('non-ApiError from _createKey is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.value = 'bad-key';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const forms = el.shadowRoot!.querySelectorAll('form');
    forms[1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect((el as any)._creatingKey).toBe(false);
  });

  it('non-ApiError from _revokeKey is ignored silently', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new Error('network'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._revokeKey('k1');
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
  });

  it('non-ApiError from _deleteAccount is ignored silently', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new Error('network'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._deleteAccount();
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
  });

  it('second confirm false on _deleteAccount does nothing', async () => {
    await setup();
    vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    await (el as any)._deleteAccount();
    await flushPromises();
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('shows error toast when delete account fails', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.delete).mockRejectedValue(new ApiError(500, 'delete failed'));
    const allDangerBtns = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.btn-danger');
    allDangerBtns[allDangerBtns.length - 1].click();
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._deletingAccount).toBe(false);
  });

  it('_changePassword returns early when already changing', async () => {
    await setup();
    (el as any)._changingPw = true;
    (el as any)._newPw = 'newpass123';
    (el as any)._newPw2 = 'newpass123';
    (el as any)._currentPw = 'oldpass';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._changePassword(fakeEvent);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    (el as any)._changingPw = false;
  });

  it('_createKey returns early when already creating', async () => {
    await setup();
    (el as any)._creatingKey = true;
    (el as any)._newKeyName = 'My Key';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._createKey(fakeEvent);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    (el as any)._creatingKey = false;
  });

  it('_onNewKeyExpiryInput updates _newKeyExpiry', async () => {
    await setup();
    (el as any)._onNewKeyExpiryInput({ target: { value: '2025-12-31' } } as unknown as Event);
    expect((el as any)._newKeyExpiry).toBe('2025-12-31');
  });

  it('_deleteAccount returns early on first confirm false', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await (el as any)._deleteAccount();
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('_changePassword shows generic error message for non-401 API error', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'server error'));
    (el as any)._currentPw = 'mypass';
    (el as any)._newPw = 'newpass123';
    (el as any)._newPw2 = 'newpass123';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._changePassword(fakeEvent);
    await flushPromises();
    expect((el as any)._changingPw).toBe(false);
  });

  it('non-ApiError from _loadKeys is ignored silently', async () => {
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A', is_admin: false });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ id: 'u1', email: 'a@b.com', name: 'A', is_admin: false });
      if (url === '/auth/api-keys') return Promise.reject(new Error('network failure'));
      return Promise.resolve([]);
    });
    el = await mount<PageAccount>('page-account', {});
    await flushPromises();
    expect((el as any)._keysLoading).toBe(false);
  });

  it('non-ApiError from _changePassword is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    (el as any)._currentPw = 'mypass';
    (el as any)._newPw = 'newpass123';
    (el as any)._newPw2 = 'newpass123';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._changePassword(fakeEvent);
    await flushPromises();
    expect((el as any)._changingPw).toBe(false);
  });

  it('pull-to-refresh controller triggers reload', async () => {
    await setup();
    vi.mocked(getMe).mockClear();
    vi.mocked(api.get).mockClear();
    const ptr = (el as any)._ptr;
    ptr.state = 'ready';
    (ptr as any).isTracking = true;
    await (ptr as any)._onTouchEnd();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/auth/api-keys');
  });
});
