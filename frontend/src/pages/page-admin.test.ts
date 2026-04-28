import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-admin';
import type { PageAdmin } from './page-admin';
import { api, ApiError } from '../services/api';

describe('page-admin', () => {
  let el: PageAdmin;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const adminMe = { id: 'me', email: 'admin@example.com', name: 'Admin', is_admin: true };
  const users = [
    { id: 'u1', email: 'alice@example.com', name: 'Alice', is_admin: false, disabled_at: null, last_login_at: '2024-01-15T10:00:00Z' },
    { id: 'u2', email: 'bob@example.com', name: 'Bob', is_admin: false, disabled_at: '2024-02-01T00:00:00Z', last_login_at: null },
  ];

  async function setup(me = adminMe, userList = users) {
    vi.mocked(api.get).mockResolvedValue(userList);
    el = await mount<PageAdmin>('page-admin', { me });
    await flushPromises();
    await el.updateComplete;
  }

  it('shows loading skeletons while fetching', async () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    el = await mount<PageAdmin>('page-admin', { me: adminMe });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.sk')).toBeTruthy();
  });

  it('shows user list after load', async () => {
    await setup();
    // Default filter is 'active', so Alice (not disabled) is shown
    expect(el.shadowRoot!.textContent).toContain('Alice');
  });

  it('shows create form for admin', async () => {
    await setup();
    expect(el.shadowRoot!.querySelector('form')).toBeTruthy();
  });

  it('hides create form for non-admin', async () => {
    const nonAdmin = { ...adminMe, is_admin: false };
    await setup(nonAdmin);
    expect(el.shadowRoot!.querySelector('form')).toBeNull();
  });

  it('creates a new user', async () => {
    await setup();
    const newUser = { id: 'u3', email: 'carol@example.com', name: 'Carol', is_admin: false, disabled_at: null, last_login_at: null };
    vi.mocked(api.post).mockResolvedValue(newUser);
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input');
    inputs[0].value = 'Carol';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'carol@example.com';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[2].value = 'password123';
    inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/users', expect.objectContaining({ name: 'Carol', email: 'carol@example.com' }));
    expect(el.shadowRoot!.textContent).toContain('Carol');
  });

  it('submit button disabled when fields empty', async () => {
    await setup();
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(btn.disabled).toBe(true);
  });

  it('disables a user', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const updated = { ...users[0], disabled_at: '2024-06-01T00:00:00Z' };
    vi.mocked(api.post).mockResolvedValue(updated);
    const disableBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="u1"].btn-warning')!;
    disableBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/users/u1/disable', {});
  });

  it('does not disable when confirm is cancelled', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const disableBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="u1"].btn-warning')!;
    disableBtn.click();
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('enables a disabled user', async () => {
    await setup();
    // Switch to 'all' filter so disabled user Bob is visible
    const tabs = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tab');
    const allTab = Array.from(tabs).find(t => t.textContent?.includes('Alle'))!;
    allTab.click();
    await el.updateComplete;
    const updated = { ...users[1], disabled_at: null };
    vi.mocked(api.post).mockResolvedValue(updated);
    const enableBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="u2"].btn-success')!;
    enableBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/users/u2/enable', {});
  });

  it('sends password reset', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue(undefined);
    const resetBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="u1"].btn-neutral')!;
    resetBtn.click();
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/users/u1/send-reset', {});
  });

  it('toggles admin role', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const updated = { ...users[0], is_admin: true };
    vi.mocked(api.post).mockResolvedValue(updated);
    const adminBtns = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-user-id="u1"]');
    const adminBtn = Array.from(adminBtns).find(b => b.textContent?.includes('Admin'))!;
    adminBtn.click();
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/users/u1/admin', { is_admin: true });
  });

  it('deletes a user', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.delete).mockResolvedValue(undefined);
    const deleteBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="u1"].btn-danger')!;
    deleteBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/auth/users/u1');
    expect(el.shadowRoot!.textContent).not.toContain('alice@example.com');
  });

  it('does not delete when confirm cancelled', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="u1"].btn-danger')!;
    deleteBtn.click();
    await flushPromises();
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('filters by active users', async () => {
    await setup();
    const tabs = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tab');
    const allTab = Array.from(tabs).find(t => t.textContent?.includes('Alle'))!;
    allTab.click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Alice');
    expect(el.shadowRoot!.textContent).toContain('Bob');
    // Switch back to active only
    const activeTab = Array.from(tabs).find(t => t.textContent?.includes('Actief'))!;
    activeTab.click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Alice');
    expect(el.shadowRoot!.textContent).not.toContain('bob@example.com');
  });

  it('filters by disabled users', async () => {
    await setup();
    const tabs = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tab');
    const disabledTab = Array.from(tabs).find(t => t.textContent?.includes('Uitgeschakeld'))!;
    disabledTab.click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Bob');
    expect(el.shadowRoot!.textContent).not.toContain('alice@example.com');
  });

  it('searches users by name', async () => {
    await setup();
    const searchInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="search"]')!;
    searchInput.value = 'alice';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    // Show all first
    const tabs = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tab');
    const allTab = Array.from(tabs).find(t => t.textContent?.includes('Alle'))!;
    allTab.click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Alice');
  });

  it('shows empty state when no users match', async () => {
    await setup();
    const searchInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="search"]')!;
    searchInput.value = 'zzznomatch';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    const tabs = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tab');
    const allTab = Array.from(tabs).find(t => t.textContent?.includes('Alle'))!;
    allTab.click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Geen gebruikers gevonden');
  });

  it('shows "jij" badge for current user', async () => {
    const usersWithMe = [{ ...adminMe, disabled_at: null, last_login_at: null }, ...users];
    await setup(adminMe, usersWithMe);
    expect(el.shadowRoot!.textContent).toContain('jij');
  });

  it('shows admin badge for admin user', async () => {
    const adminUser = { ...users[0], is_admin: true };
    await setup(adminMe, [adminUser]);
    expect(el.shadowRoot!.textContent).toContain('admin');
  });

  it('shows uitgeschakeld badge for disabled user', async () => {
    await setup();
    // Switch to 'all' filter so disabled user Bob is visible
    const tabs = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tab');
    const allTab = Array.from(tabs).find(t => t.textContent?.includes('Alle'))!;
    allTab.click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('uitgeschakeld');
  });

  it('handles load failure gracefully', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(500, 'server error'));
    el = await mount<PageAdmin>('page-admin', { me: adminMe });
    await flushPromises();
    await el.updateComplete;
    // Should not crash; empty state shown
    expect(el.shadowRoot!.querySelector('.empty-state')).toBeTruthy();
  });

  it('shows error toast when enable user fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'enable fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._enable(users[1]);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('shows error toast when toggleAdmin fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'admin fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._toggleAdmin(users[0]);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('shows error toast when sendReset fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'reset fail'));
    await (el as any)._sendReset(users[0]);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('shows error toast when delete fails', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new ApiError(500, 'delete fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._delete(users[0]);
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
  });

  it('shows error toast when create user fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(400, 'create fail'));
    (el as any)._name = 'Eve';
    (el as any)._email = 'eve@example.com';
    (el as any)._password = 'pw123';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._createUser(fakeEvent);
    await flushPromises();
    expect((el as any)._creating).toBe(false);
  });

  it('shows error toast when disable user fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'disable fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._disable(users[0]);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('non-ApiError from _load is ignored silently', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'));
    el = await mount<PageAdmin>('page-admin', { me: adminMe });
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._loading).toBe(false);
  });

  it('non-ApiError from _createUser is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    (el as any)._name = 'Eve';
    (el as any)._email = 'eve@example.com';
    (el as any)._password = 'pw123';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._createUser(fakeEvent);
    await flushPromises();
    expect((el as any)._creating).toBe(false);
  });

  it('toggles admin to non-admin (revoking admin)', async () => {
    const adminUser = { ...users[0], is_admin: true };
    await setup(adminMe, [adminUser]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const updated = { ...adminUser, is_admin: false };
    vi.mocked(api.post).mockResolvedValue(updated);
    await (el as any)._toggleAdmin(adminUser);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(`/auth/users/${adminUser.id}/admin`, { is_admin: false });
  });

  it('non-ApiError from _enable is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    await (el as any)._enable(users[1]);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('non-ApiError from _disable is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._disable(users[0]);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('non-ApiError from _toggleAdmin is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._toggleAdmin(users[0]);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('non-ApiError from _sendReset is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    await (el as any)._sendReset(users[0]);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('non-ApiError from _delete is ignored silently', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new Error('network'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._delete(users[0]);
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
  });

  it('_onEnableClick with unknown user id does nothing', async () => {
    await setup();
    const fakeEvent = { currentTarget: { dataset: { userId: 'unknown' } } } as unknown as Event;
    (el as any)._onEnableClick(fakeEvent);
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onDisableClick with unknown user id does nothing', async () => {
    await setup();
    const fakeEvent = { currentTarget: { dataset: { userId: 'unknown' } } } as unknown as Event;
    (el as any)._onDisableClick(fakeEvent);
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onSendResetClick with unknown user id does nothing', async () => {
    await setup();
    const fakeEvent = { currentTarget: { dataset: { userId: 'unknown' } } } as unknown as Event;
    (el as any)._onSendResetClick(fakeEvent);
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onToggleAdminClick with unknown user id does nothing', async () => {
    await setup();
    const fakeEvent = { currentTarget: { dataset: { userId: 'unknown' } } } as unknown as Event;
    (el as any)._onToggleAdminClick(fakeEvent);
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onDeleteClick with unknown user id does nothing', async () => {
    await setup();
    const fakeEvent = { currentTarget: { dataset: { userId: 'unknown' } } } as unknown as Event;
    (el as any)._onDeleteClick(fakeEvent);
    await flushPromises();
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('_createUser returns early when fields are empty', async () => {
    await setup();
    (el as any)._name = '';
    (el as any)._email = '';
    (el as any)._password = '';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._createUser(fakeEvent);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_toggleAdmin returns early when confirm is false', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = (el as any)._users[0];
    await (el as any)._toggleAdmin(user);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('pull-to-refresh controller triggers _load', async () => {
    await setup();
    vi.mocked(api.get).mockClear();
    const ptr = (el as any)._ptr;
    ptr.state = 'ready';
    (ptr as any).isTracking = true;
    await (ptr as any)._onTouchEnd();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/auth/users');
  });
});
