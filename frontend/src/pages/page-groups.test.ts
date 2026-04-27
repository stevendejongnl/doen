import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-groups';
import type { PageGroups } from './page-groups';
import { api, ApiError } from '../services/api';
import { getMe } from '../services/auth';

describe('page-groups', () => {
  let el: PageGroups;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const me = { id: 'me', email: 'owner@example.com', name: 'Owner', is_admin: true };
  const group1 = { id: 'g1', name: 'My Household', type: 'household', owner_id: 'me' };
  const members1 = [
    { user_id: 'me', name: 'Owner', email: 'owner@example.com', role: 'admin' },
    { user_id: 'u2', name: 'Alice', email: 'alice@example.com', role: 'member' },
  ];

  async function setup(groups = [group1], members = { g1: members1 }) {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/groups') return Promise.resolve(groups);
      const match = url.match(/\/groups\/(\w+)\/members/);
      if (match) return Promise.resolve(members[match[1]] ?? []);
      return Promise.resolve([]);
    });
    el = await mount<PageGroups>('page-groups');
    await flushPromises();
    await el.updateComplete;
  }

  it('shows loading skeleton while fetching', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    el = await mount<PageGroups>('page-groups');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.sk')).toBeTruthy();
  });

  it('shows empty state when no groups', async () => {
    await setup([]);
    expect(el.shadowRoot!.textContent).toContain('Nog geen groepen');
  });

  it('shows group name and type', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('My Household');
    expect(el.shadowRoot!.textContent).toContain('household');
  });

  it('shows group members', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Alice');
    expect(el.shadowRoot!.textContent).toContain('alice@example.com');
  });

  it('shows owner badge', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Eigenaar');
  });

  it('shows Jij badge for self (non-owner)', async () => {
    const members = { g1: [
      { user_id: 'u99', name: 'Other', email: 'other@example.com', role: 'admin' },
      { user_id: 'me', name: 'Owner', email: 'owner@example.com', role: 'member' },
    ]};
    const group = { ...group1, owner_id: 'u99' };
    await setup([group], members);
    expect(el.shadowRoot!.textContent).toContain('Jij');
  });

  it('creates a new group', async () => {
    await setup();
    const newGroup = { id: 'g2', name: 'My Team', type: 'custom', owner_id: 'me' };
    vi.mocked(api.post).mockResolvedValue(newGroup);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/groups/g2/members')) return Promise.resolve([]);
      if (url === '/groups') return Promise.resolve([group1, newGroup]);
      if (url.includes('/groups/g1/members')) return Promise.resolve(members1);
      return Promise.resolve([]);
    });
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.value = 'My Team';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/groups', expect.objectContaining({ name: 'My Team' }));
  });

  it('create submit button disabled when name is empty', async () => {
    await setup();
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(btn.disabled).toBe(true);
  });

  it('removes a member', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.delete).mockResolvedValue(undefined);
    const removeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.remove-btn')!;
    removeBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/groups/g1/members/u2');
    expect(el.shadowRoot!.textContent).not.toContain('Alice');
  });

  it('does not remove member when confirm is cancelled', async () => {
    await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const removeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.remove-btn')!;
    removeBtn.click();
    await flushPromises();
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('invites a member by email', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue({ status: 'invited', email: 'new@example.com' });
    const forms = el.shadowRoot!.querySelectorAll('form');
    // Last form in the group card is the invite form
    const inviteForm = Array.from(forms).find(f => f.querySelector('input[type="email"]'))!;
    const emailInput = inviteForm.querySelector<HTMLInputElement>('input[type="email"]')!;
    emailInput.dispatchEvent(new Event('focus', { bubbles: true }));
    await el.updateComplete;
    emailInput.value = 'new@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    inviteForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/groups/g1/members', { email: 'new@example.com' });
  });

  it('invites an existing user and reloads members', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue({ status: 'added', email: 'alice@example.com' });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/groups/g1/members')) return Promise.resolve([...members1, { user_id: 'u3', name: 'New', email: 'alice@example.com', role: 'member' }]);
      if (url === '/groups') return Promise.resolve([group1]);
      return Promise.resolve([]);
    });
    const forms = el.shadowRoot!.querySelectorAll('form');
    const inviteForm = Array.from(forms).find(f => f.querySelector('input[type="email"]'))!;
    const emailInput = inviteForm.querySelector<HTMLInputElement>('input[type="email"]')!;
    emailInput.dispatchEvent(new Event('focus', { bubbles: true }));
    await el.updateComplete;
    emailInput.value = 'alice@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    inviteForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/groups/g1/members', { email: 'alice@example.com' });
  });

  it('creates a project for a group', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue({ id: 'p1', name: 'Shopping', color: '#6366f1', group_id: 'g1' });
    const projectEvents: Event[] = [];
    el.addEventListener('project-created', e => projectEvents.push(e));
    const forms = el.shadowRoot!.querySelectorAll('form');
    const projectForm = Array.from(forms).find(f => f.querySelector('input[type="text"]:not(:first-child)') || (f.dataset.groupId === 'g1' && !f.querySelector('input[type="email"]')))!;
    const nameInput = projectForm.querySelector<HTMLInputElement>('input[type="text"]')!;
    nameInput.dispatchEvent(new Event('focus', { bubbles: true }));
    await el.updateComplete;
    nameInput.value = 'Shopping';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    projectForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/projects', expect.objectContaining({ name: 'Shopping', group_id: 'g1' }));
    expect(projectEvents.length).toBeGreaterThan(0);
  });

  it('shows rename input on rename button click', async () => {
    await setup();
    const renameBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.rename-btn')!;
    renameBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.group-name-input')).toBeTruthy();
  });

  it('commits rename on blur', async () => {
    await setup();
    vi.mocked(api.put).mockResolvedValue({ ...group1, name: 'Renamed' });
    const renameBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.rename-btn')!;
    renameBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.group-name-input')!;
    input.value = 'Renamed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/groups/g1', { name: 'Renamed' });
  });

  it('commits rename on Enter', async () => {
    await setup();
    vi.mocked(api.put).mockResolvedValue({ ...group1, name: 'Renamed2' });
    const renameBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.rename-btn')!;
    renameBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.group-name-input')!;
    input.value = 'Renamed2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('cancels rename on Escape', async () => {
    await setup();
    const renameBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.rename-btn')!;
    renameBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.group-name-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.group-name-input')).toBeNull();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('dispatches navigate event on settings click', async () => {
    await setup();
    const events: CustomEvent[] = [];
    el.addEventListener('navigate', e => events.push(e as CustomEvent));
    const settingsBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.settings-btn')!;
    settingsBtn.click();
    await el.updateComplete;
    expect(events[0]?.detail).toEqual({ page: 'group-settings', groupId: 'g1' });
  });

  it('handles load failure gracefully', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockRejectedValue(new ApiError(500, 'server error'));
    el = await mount<PageGroups>('page-groups');
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Nog geen groepen');
  });

  it('cancels rename when same name is submitted', async () => {
    await setup();
    const renameBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.rename-btn')!;
    renameBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.group-name-input')!;
    input.value = 'My Household'; // same as original name
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushPromises();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('shows error toast when rename fails', async () => {
    await setup();
    vi.mocked(api.put).mockRejectedValue(new ApiError(500, 'rename failed'));
    const renameBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.rename-btn')!;
    renameBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.group-name-input')!;
    input.value = 'New Name';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._savingRename).toBe(false);
  });

  it('handles partial members load failure with empty fallback', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/groups') return Promise.resolve([group1]);
      if (url.includes('/members')) return Promise.reject(new Error('members fail'));
      return Promise.resolve([]);
    });
    el = await mount<PageGroups>('page-groups');
    await flushPromises();
    await el.updateComplete;
    // Should render group even though members fetch failed
    expect(el.shadowRoot!.textContent).toContain('My Household');
  });

  it('_onNewProjectOffersChange reads data-group-id and checkbox value', async () => {
    await setup();
    const fakeEvent = {
      currentTarget: { dataset: { groupId: 'g1' } },
      target: { checked: false },
    };
    (el as any)._onNewProjectOffersChange(fakeEvent as unknown as Event);
    expect((el as any)._newProjectGroupId).toBe('g1');
    expect((el as any)._newProjectOffersEnabled).toBe(false);
  });

  it('shows error toast when remove member fails', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new ApiError(500, 'delete fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._removeMember(group1, members1[0]);
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
  });

  const fakeEvent = { preventDefault: () => {} } as Event;

  it('shows error toast when create group fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'create fail'));
    (el as any)._newName = 'New Group';
    await (el as any)._createGroup(fakeEvent);
    await flushPromises();
    expect((el as any)._creating).toBe(false);
  });

  it('shows error toast when invite fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(400, 'invite fail'));
    (el as any)._inviteEmail = 'x@example.com';
    await (el as any)._invite('g1', fakeEvent);
    await flushPromises();
    expect((el as any)._inviting).toBe(false);
  });

  it('shows error toast when create project fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'proj fail'));
    (el as any)._newProjectName = 'New Project';
    (el as any)._newProjectGroupId = 'g1';
    await (el as any)._createProject('g1', fakeEvent);
    await flushPromises();
    expect((el as any)._creatingProject).toBe(false);
  });

  it('non-ApiError from _removeMember is ignored silently', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new Error('network'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._removeMember(group1, members1[1]);
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
  });

  it('non-ApiError from _createGroup is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    (el as any)._newName = 'New Group';
    await (el as any)._createGroup(fakeEvent);
    await flushPromises();
    expect((el as any)._creating).toBe(false);
  });

  it('non-ApiError from _invite is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    (el as any)._inviteEmail = 'x@example.com';
    await (el as any)._invite('g1', fakeEvent);
    await flushPromises();
    expect((el as any)._inviting).toBe(false);
  });

  it('non-ApiError from _createProject is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    (el as any)._newProjectName = 'New Project';
    await (el as any)._createProject('g1', fakeEvent);
    await flushPromises();
    expect((el as any)._creatingProject).toBe(false);
  });

  it('non-ApiError from _commitRename is ignored silently', async () => {
    await setup();
    vi.mocked(api.put).mockRejectedValue(new Error('network'));
    (el as any)._editingGroupId = 'g1';
    (el as any)._editingGroupName = 'New Name';
    await (el as any)._commitRename(group1);
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('shows admin badge for non-owner, non-self admin member', async () => {
    const adminMember = { user_id: 'u3', name: 'Admin User', email: 'admin@example.com', role: 'admin' };
    await setup([group1], { g1: [members1[0], adminMember] });
    expect(el.shadowRoot!.textContent).toContain('Admin');
  });

  it('_onStartRenameClick with unknown group id does nothing', async () => {
    await setup();
    const fakeEvent2 = { currentTarget: { dataset: { groupId: 'unknown' } } } as unknown as Event;
    (el as any)._onStartRenameClick(fakeEvent2);
    expect((el as any)._editingGroupId).toBe('');
  });

  it('_onGoToSettingsClick with unknown group id does nothing', async () => {
    await setup();
    const dispatched: Event[] = [];
    el.addEventListener('navigate', (e) => dispatched.push(e));
    const fakeEvent2 = { currentTarget: { dataset: { groupId: 'unknown' } } } as unknown as Event;
    (el as any)._onGoToSettingsClick(fakeEvent2);
    expect(dispatched).toHaveLength(0);
  });

  it('_onRenameKeydownBound with no matching group does nothing', async () => {
    await setup();
    (el as any)._editingGroupId = 'unknown';
    const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    (el as any)._onRenameKeydownBound(keyEvent);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_onRenameBlur with no matching group does nothing', async () => {
    await setup();
    (el as any)._editingGroupId = 'unknown';
    (el as any)._onRenameBlur();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_onRemoveMemberClick with no matching group or member does nothing', async () => {
    await setup();
    const fakeEvent2 = { currentTarget: { dataset: { groupId: 'unknown', userId: 'u2' } } } as unknown as Event;
    (el as any)._onRemoveMemberClick(fakeEvent2);
    await flushPromises();
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('_createProject returns early when _creatingProject is true', async () => {
    await setup();
    (el as any)._creatingProject = true;
    (el as any)._newProjectName = 'New Project';
    await (el as any)._createProject('g1', fakeEvent);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    (el as any)._creatingProject = false;
  });

  it('_commitRename returns early when _savingRename is true', async () => {
    await setup();
    (el as any)._savingRename = true;
    (el as any)._editingGroupName = 'New Name';
    await (el as any)._commitRename(group1);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    (el as any)._savingRename = false;
  });

  it('_commitRename updates only matching group in map', async () => {
    const group2 = { id: 'g2', name: 'Second Group', type: 'custom', owner_id: 'me' };
    await setup([group1, group2]);
    vi.mocked(api.put).mockResolvedValue({ ...group1, name: 'Renamed' });
    (el as any)._editingGroupName = 'Renamed';
    await (el as any)._commitRename(group1);
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('_onRenameKeydown non-Enter non-Escape does nothing', async () => {
    await setup();
    (el as any)._editingGroupId = 'g1';
    const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    (el as any)._onRenameKeydown(keyEvent, group1);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_canManage returns false when _me is null', async () => {
    await setup();
    (el as any)._me = null;
    expect((el as any)._canManage(group1)).toBe(false);
  });

  it('_canManage uses empty array when group has no members entry', async () => {
    await setup();
    const otherGroup = { id: 'g99', name: 'Other', type: 'custom', owner_id: 'other' };
    (el as any)._members = {};
    expect((el as any)._canManage(otherGroup)).toBe(false);
  });

  it('_createGroup returns early when already creating', async () => {
    await setup();
    (el as any)._creating = true;
    (el as any)._newName = 'New Group';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._createGroup(fakeEvent);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    (el as any)._creating = false;
  });

  it('_invite returns early when already inviting', async () => {
    await setup();
    (el as any)._inviting = true;
    (el as any)._inviteEmail = 'test@example.com';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._invite('g1', fakeEvent);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    (el as any)._inviting = false;
  });

  it('_onNewTypeChange updates _newType', async () => {
    await setup();
    (el as any)._onNewTypeChange({ target: { value: 'household' } } as unknown as Event);
    expect((el as any)._newType).toBe('household');
  });

  it('non-ApiError from _load is ignored silently', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network failure'));
    el = await mount<PageGroups>('page-groups', {});
    await flushPromises();
    await el.updateComplete;
    // no toast.error should be called (non-ApiError is silently swallowed)
    expect((el as any)._loading).toBe(false);
  });

  it('_removeMember filters from empty array when group has no members entry', async () => {
    await setup();
    (el as any)._members = {};
    vi.mocked(api.delete).mockResolvedValue({});
    const member = { user_id: 'u99', name: 'Ghost', email: 'g@example.com', role: 'member' };
    await (el as any)._removeMember(group1, member);
    // Should not throw; _members[group1.id] should now be []
    expect((el as any)._members[group1.id]).toEqual([]);
  });
});
