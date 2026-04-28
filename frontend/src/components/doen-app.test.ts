import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './doen-app';
import type { DoenApp } from './doen-app';
import { isLoggedIn, getMe, getAuthStatus } from '../services/auth';
import { api, sseConnect } from '../services/api';

describe('doen-app', () => {
  let el: DoenApp;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const user = { id: 'me', email: 'me@example.com', name: 'Me', is_admin: false };

  async function setupLoggedIn() {
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockResolvedValue(user);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve([]);
      if (url === '/groups') return Promise.resolve([]);
      if (url.includes('/auth/me')) return Promise.resolve({ preferences: {} });
      if (url.includes('/tasks')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el = await mount<DoenApp>('doen-app');
    await flushPromises();
    await el.updateComplete;
  }

  async function setupLoggedOut() {
    vi.mocked(isLoggedIn).mockReturnValue(false);
    vi.mocked(getAuthStatus).mockResolvedValue({ has_users: true });
    el = await mount<DoenApp>('doen-app');
    await flushPromises();
    await el.updateComplete;
  }

  it('shows boot screen while loading (logged in, slow getMe)', async () => {
    vi.mocked(isLoggedIn).mockReturnValue(true);
    // Never resolves so _booting stays true
    vi.mocked(getMe).mockReturnValue(new Promise(() => {}));
    el = document.createElement('doen-app') as DoenApp;
    document.body.appendChild(el);
    // Don't await updateComplete — check immediately after first render
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.boot-screen')).toBeTruthy();
  });

  it('shows login page when not logged in', async () => {
    await setupLoggedOut();
    expect(el.shadowRoot!.querySelector('page-login')).toBeTruthy();
  });

  it('shows main layout when logged in', async () => {
    await setupLoggedIn();
    expect(el.shadowRoot!.querySelector('.layout')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('doen-sidebar')).toBeTruthy();
  });

  it('shows todo page by default after login', async () => {
    await setupLoggedIn();
    expect(el.shadowRoot!.querySelector('page-todo')).toBeTruthy();
  });

  it('navigates to groups page', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/groups') return Promise.resolve([]);
      if (url === '/projects') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'groups' }, bubbles: true,
    }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('page-groups')).toBeTruthy();
  });

  it('navigates to admin page', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/auth/users')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'admin' }, bubbles: true,
    }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('page-admin')).toBeTruthy();
  });

  it('navigates to account page', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/auth/me')) return Promise.resolve(user);
      if (url.includes('/auth/api-keys')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'account' }, bubbles: true,
    }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('page-account')).toBeTruthy();
  });

  it('navigates to project page', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url === '/projects/p1/tasks') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('page-project')).toBeTruthy();
  });

  it('navigates to group-settings page', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/groups/g1') return Promise.resolve({ id: 'g1', name: 'G', type: 'household', owner_id: 'me' });
      if (url.includes('/groups/g1/members')) return Promise.resolve([{ user_id: 'me', name: 'Me', email: 'me@example.com', role: 'admin' }]);
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes('/households/g1')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'group-settings', groupId: 'g1' }, bubbles: true,
    }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('page-group-settings')).toBeTruthy();
  });

  it('toggles sidebar on menu button click', async () => {
    await setupLoggedIn();
    const menuBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.menu-btn')!;
    menuBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.backdrop')?.className).toContain('open');
    menuBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.backdrop')?.className).not.toContain('open');
  });

  it('closes sidebar on backdrop click', async () => {
    await setupLoggedIn();
    const menuBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.menu-btn')!;
    menuBtn.click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.backdrop') as HTMLElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.backdrop')?.className).not.toContain('open');
  });

  it('shows invite page for invite URL token', async () => {
    vi.mocked(isLoggedIn).mockReturnValue(false);
    vi.mocked(api.get).mockResolvedValue({
      group_id: 'g1', group_name: 'G', inviter_name: 'A',
      email: 'bob@example.com', existing_user: false,
    });
    // Simulate invite token being set via internal state
    el = await mount<DoenApp>('doen-app');
    (el as any)._inviteToken = 'tok123';
    (el as any)._booting = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('page-invite')).toBeTruthy();
  });

  it('shows reset page for reset URL token', async () => {
    vi.mocked(isLoggedIn).mockReturnValue(false);
    el = await mount<DoenApp>('doen-app');
    (el as any)._resetToken = 'reset456';
    (el as any)._booting = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('page-reset')).toBeTruthy();
  });

  it('shows login after reset navigate event', async () => {
    vi.mocked(isLoggedIn).mockReturnValue(false);
    el = await mount<DoenApp>('doen-app');
    (el as any)._resetToken = 'reset456';
    (el as any)._booting = false;
    await el.updateComplete;
    el.shadowRoot!.querySelector('page-reset')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'login' }, bubbles: true,
    }));
    await el.updateComplete;
    expect((el as any)._resetToken).toBeNull();
    expect(el.shadowRoot!.querySelector('page-login')).toBeTruthy();
  });

  it('shows main layout after logged-in event', async () => {
    await setupLoggedOut();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve([]);
      if (url === '/groups') return Promise.resolve([]);
      if (url.includes('/auth/me')) return Promise.resolve({ preferences: {} });
      if (url.includes('/tasks')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('page-login')!.dispatchEvent(new CustomEvent('logged-in', {
      detail: user, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.layout')).toBeTruthy();
  });

  it('shows login page after logout event', async () => {
    await setupLoggedIn();
    window.dispatchEvent(new CustomEvent('doen:logout'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('page-login')).toBeTruthy();
  });

  it('_handleSSE task_created calls addTask on page-project', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url === '/projects/p1/tasks') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;

    const project = el.shadowRoot!.querySelector('page-project') as any;
    const addTaskSpy = vi.spyOn(project, 'addTask').mockImplementation(() => {});
    const task = { id: 'tnew', title: 'New', status: 'todo', project_id: 'p1' };
    (el as any)._handleSSE('task_created', task);
    expect(addTaskSpy).toHaveBeenCalledWith(task);
  });

  it('_handleSSE task_updated calls updateTask', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url === '/projects/p1/tasks') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;

    const project = el.shadowRoot!.querySelector('page-project') as any;
    const updateTaskSpy = vi.spyOn(project, 'updateTask').mockImplementation(() => {});
    const task = { id: 't1', title: 'Updated', status: 'done', project_id: 'p1' };
    (el as any)._handleSSE('task_updated', task);
    expect(updateTaskSpy).toHaveBeenCalledWith(task);
  });

  it('_handleSSE task_deleted calls removeTask', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url === '/projects/p1/tasks') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;

    const project = el.shadowRoot!.querySelector('page-project') as any;
    const removeTaskSpy = vi.spyOn(project, 'removeTask').mockImplementation(() => {});
    (el as any)._handleSSE('task_deleted', { id: 't1' });
    expect(removeTaskSpy).toHaveBeenCalledWith('t1');
  });

  it('_handleSSE offer_created calls project reload', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url === '/projects/p1/tasks') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;

    const project = el.shadowRoot!.querySelector('page-project') as any;
    const reloadSpy = vi.spyOn(project, 'reload').mockResolvedValue(undefined);
    (el as any)._handleSSE('offer_created', {});
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('_handleSSE offers_purged calls groupSettings reload', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/groups/g1') return Promise.resolve({ id: 'g1', name: 'G', type: 'household', owner_id: 'me' });
      if (url.includes('/groups/g1/members')) return Promise.resolve([{ user_id: 'me', name: 'Me', email: 'me@example.com', role: 'admin' }]);
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes('/households/g1')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'group-settings', groupId: 'g1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const groupSettings = el.shadowRoot!.querySelector('page-group-settings') as any;
    const reloadSpy = vi.spyOn(groupSettings, 'reload').mockResolvedValue(undefined);
    (el as any)._handleSSE('offers_purged', {});
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('_handleSSE points_updated calls project and groupSettings reload', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url === '/projects/p1/tasks') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const project = el.shadowRoot!.querySelector('page-project') as any;
    const reloadSpy = vi.spyOn(project, 'reload').mockResolvedValue(undefined);
    (el as any)._handleSSE('points_updated', {});
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('_onPopState updates route from current path', async () => {
    await setupLoggedIn();
    window.history.pushState(null, '', '/groups');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await el.updateComplete;
    expect((el as any)._route.type).toBe('groups');
  });

  it('sets _user to null when getMe fails', async () => {
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(getMe).mockRejectedValue(new Error('auth fail'));
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve([]);
      if (url === '/groups') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el = await mount<DoenApp>('doen-app');
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._user).toBeNull();
  });

  it('_pathFromRoute returns "/" for todo type', async () => {
    await setupLoggedIn();
    const path = (el as any)._pathFromRoute({ type: 'todo' });
    expect(path).toBe('/');
  });

  it('_readInviteTokenFromUrl returns token when path matches', async () => {
    await setupLoggedIn();
    window.history.pushState(null, '', '/invite/tok123');
    const token = (el as any)._readInviteTokenFromUrl();
    expect(token).toBe('tok123');
    window.history.pushState(null, '', '/');
  });

  it('_readResetTokenFromUrl returns token when path matches', async () => {
    await setupLoggedIn();
    window.history.pushState(null, '', '/reset/resetabc');
    const token = (el as any)._readResetTokenFromUrl();
    expect(token).toBe('resetabc');
    window.history.pushState(null, '', '/');
  });

  it('navigate with page=todo navigates to todo', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks')) return Promise.resolve([]);
      if (url.includes('/auth/me')) return Promise.resolve({ preferences: {} });
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'todo' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._route.type).toBe('todo');
  });

  it('_onCloseSidebar closes sidebar', async () => {
    await setupLoggedIn();
    (el as any)._sidebarOpen = true;
    (el as any)._onCloseSidebar();
    expect((el as any)._sidebarOpen).toBe(false);
  });

  it('_onToggleSidebar toggles sidebar open', async () => {
    await setupLoggedIn();
    (el as any)._sidebarOpen = false;
    (el as any)._onToggleSidebar();
    expect((el as any)._sidebarOpen).toBe(true);
  });

  it('_onProjectCreated calls sidebar reload', async () => {
    await setupLoggedIn();
    const sidebar = el.shadowRoot!.querySelector('doen-sidebar') as any;
    const reloadSpy = vi.spyOn(sidebar, 'reload').mockResolvedValue(undefined);
    (el as any)._onProjectCreated();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('navigate with unknown page closes sidebar', async () => {
    await setupLoggedIn();
    (el as any)._sidebarOpen = true;
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'unknown-page' }, bubbles: true,
    }));
    await el.updateComplete;
    expect((el as any)._sidebarOpen).toBe(false);
  });

  it('SSE callback triggers _handleSSE', async () => {
    await setupLoggedIn();
    const sseCallback = vi.mocked(sseConnect).mock.calls[0]?.[0];
    expect(sseCallback).toBeDefined();
    const task = { id: 't1', title: 'Test', status: 'todo', project_id: null };
    expect(() => sseCallback('task_created', task)).not.toThrow();
  });

  it('_handleSSE unknown event does not throw', async () => {
    await setupLoggedIn();
    expect(() => (el as any)._handleSSE('unknown_event', {})).not.toThrow();
  });

  it('_handleSSE category events dispatch doen:categories-changed and reload groupSettings', async () => {
    await setupLoggedIn();
    const dispatched: string[] = [];
    window.addEventListener('doen:categories-changed', () => dispatched.push('fired'));
    for (const ev of ['category_created', 'category_updated', 'category_deleted']) {
      expect(() => (el as any)._handleSSE(ev, {})).not.toThrow();
    }
    expect(dispatched.length).toBe(3);
  });

  it('_handleSSE project_created reloads sidebar and groups', async () => {
    await setupLoggedIn();
    expect(() => (el as any)._handleSSE('project_created', { id: 'p1' })).not.toThrow();
  });

  it('_handleSSE project_updated reloads project page when id matches current route', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url.includes('/tasks')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const project = el.shadowRoot!.querySelector('page-project') as any;
    const reloadSpy = vi.spyOn(project, 'reload').mockResolvedValue(undefined);
    (el as any)._handleSSE('project_updated', { id: 'p1' });
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('_handleSSE project_deleted does not reload project page when id does not match', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url.includes('/tasks')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const project = el.shadowRoot!.querySelector('page-project') as any;
    const reloadSpy = vi.spyOn(project, 'reload').mockResolvedValue(undefined);
    (el as any)._handleSSE('project_deleted', { id: 'other' });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('_handleSSE group_created/updated/deleted reloads sidebar and groups', async () => {
    await setupLoggedIn();
    expect(() => (el as any)._handleSSE('group_created', { id: 'g1' })).not.toThrow();
    expect(() => (el as any)._handleSSE('group_updated', { id: 'g1' })).not.toThrow();
    expect(() => (el as any)._handleSSE('group_deleted', { id: 'g1' })).not.toThrow();
  });

  it('_handleSSE group_updated reloads group-settings page when id matches', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/groups/g1') return Promise.resolve({ id: 'g1', name: 'G', type: 'household' });
      if (url === '/groups/g1/members') return Promise.resolve([]);
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes('/projects')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'group-settings', groupId: 'g1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const gs = el.shadowRoot!.querySelector('page-group-settings') as any;
    const reloadSpy = vi.spyOn(gs, 'reload').mockResolvedValue(undefined);
    (el as any)._handleSSE('group_updated', { id: 'g1' });
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('_handleSSE group_deleted does not reload group-settings when id does not match', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/groups/g1') return Promise.resolve({ id: 'g1', name: 'G', type: 'household' });
      if (url === '/groups/g1/members') return Promise.resolve([]);
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes('/projects')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'group-settings', groupId: 'g1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const gs = el.shadowRoot!.querySelector('page-group-settings') as any;
    const reloadSpy = vi.spyOn(gs, 'reload').mockResolvedValue(undefined);
    (el as any)._handleSSE('group_deleted', { id: 'other' });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('_handleSSE group_member_added/removed does not throw', async () => {
    await setupLoggedIn();
    expect(() => (el as any)._handleSSE('group_member_added', { group_id: 'g1', user_id: 'u1' })).not.toThrow();
    expect(() => (el as any)._handleSSE('group_member_removed', { group_id: 'g1', user_id: 'u1' })).not.toThrow();
  });

  it('_handleSSE heartbeat does not throw', async () => {
    await setupLoggedIn();
    expect(() => (el as any)._handleSSE('heartbeat', {})).not.toThrow();
  });

  it('_onResetNavigate does not clear resetToken when page is not login', async () => {
    await setupLoggedOut();
    (el as any)._resetToken = 'token123';
    (el as any)._onResetNavigate(new CustomEvent('navigate', { detail: { page: 'groups' } }));
    expect((el as any)._resetToken).toBe('token123');
  });

  it('blocks project switch when unsaved edits and user cancels confirm', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1' || url === '/projects/p2') return Promise.resolve({ id: url.slice(-2), name: 'Test', color: '#6366f1', group_id: null });
      if (url.includes('/tasks')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const pageEl = el.shadowRoot!.querySelector('page-project') as any;
    vi.spyOn(pageEl, 'hasUnsavedProjectChanges').mockReturnValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p2' }, bubbles: true,
    }));
    await el.updateComplete;
    expect((el as any)._route.projectId).toBe('p1');
  });

  it('blocks navigation away from project via groupId when unsaved edits and user cancels', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url.includes('/tasks')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const pageEl = el.shadowRoot!.querySelector('page-project') as any;
    vi.spyOn(pageEl, 'hasUnsavedProjectChanges').mockReturnValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { groupId: 'g1' }, bubbles: true,
    }));
    await el.updateComplete;
    expect((el as any)._route.type).toBe('project');
  });

  it('blocks navigation to todo when on project with unsaved edits and user cancels', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ id: 'p1', name: 'Test', color: '#6366f1', group_id: null });
      if (url.includes('/tasks')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const pageEl = el.shadowRoot!.querySelector('page-project') as any;
    vi.spyOn(pageEl, 'hasUnsavedProjectChanges').mockReturnValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'todo' }, bubbles: true,
    }));
    await el.updateComplete;
    expect((el as any)._route.type).toBe('project');
  });

  it('allows project switch when unsaved edits and user confirms', async () => {
    await setupLoggedIn();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects/p1' || url === '/projects/p2') return Promise.resolve({ id: url.slice(-2), name: 'Test', color: '#6366f1', group_id: null });
      if (url.includes('/tasks')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p1' }, bubbles: true,
    }));
    await flushPromises();
    await el.updateComplete;
    const pageEl = el.shadowRoot!.querySelector('page-project') as any;
    vi.spyOn(pageEl, 'hasUnsavedProjectChanges').mockReturnValue(true);
    const discardSpy = vi.spyOn(pageEl, 'discardProjectEdit').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    el.shadowRoot!.querySelector('.layout')!.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId: 'p2' }, bubbles: true,
    }));
    await el.updateComplete;
    expect((el as any)._route.projectId).toBe('p2');
    expect(discardSpy).toHaveBeenCalled();
  });
});
