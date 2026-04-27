import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './doen-sidebar';
import type { DoenSidebar } from './doen-sidebar';
import { api } from '../services/api';

describe('doen-sidebar', () => {
  let el: DoenSidebar;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const adminUser = { id: 'me', email: 'me@example.com', name: 'Alice', is_admin: true };
  const regularUser = { id: 'me', email: 'me@example.com', name: 'Bob', is_admin: false };
  const projects = [
    { id: 'p1', name: 'Personal Project', color: '#6366f1', group_id: null, archived_at: null },
    { id: 'p2', name: 'Group Project', color: '#10b981', group_id: 'g1', archived_at: null },
    { id: 'p3', name: 'Archived', color: '#ef4444', group_id: null, archived_at: '2024-01-01T00:00:00Z' },
  ];
  const groups = [
    { id: 'g1', name: 'My Group', type: 'household', owner_id: 'me' },
  ];

  async function setup(user = adminUser) {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve(projects);
      if (url === '/groups') return Promise.resolve(groups);
      return Promise.resolve([]);
    });
    el = await mount<DoenSidebar>('doen-sidebar', { user });
    await flushPromises();
    await el.updateComplete;
  }

  it('shows app name', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Doen');
  });

  it('shows user name', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Alice');
  });

  it('shows user initials', async () => {
    await setup();
    expect(el.shadowRoot!.querySelector('.avatar')?.textContent).toContain('A');
  });

  it('shows personal projects', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Personal Project');
  });

  it('does not show archived projects', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).not.toContain('Archived');
  });

  it('shows group name section', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('My Group');
  });

  it('shows group projects', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Group Project');
  });

  it('shows admin nav item for admin users', async () => {
    await setup(adminUser);
    expect(el.shadowRoot!.textContent).toContain('Gebruikers');
  });

  it('hides admin nav item for non-admin users', async () => {
    await setup(regularUser);
    expect(el.shadowRoot!.textContent).not.toContain('Gebruikers');
  });

  it('dispatches navigate event for todo', async () => {
    await setup();
    const events: CustomEvent[] = [];
    el.addEventListener('navigate', e => events.push(e as CustomEvent));
    const todoBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.nav-item')).find(b => b.textContent?.includes('Te doen'))!;
    todoBtn.click();
    expect(events[0]?.detail).toEqual({ page: 'todo' });
  });

  it('dispatches navigate event for groups', async () => {
    await setup();
    const events: CustomEvent[] = [];
    el.addEventListener('navigate', e => events.push(e as CustomEvent));
    const groupsBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.nav-item')).find(b => b.textContent?.includes('Groepen'))!;
    groupsBtn.click();
    expect(events[0]?.detail).toEqual({ page: 'groups' });
  });

  it('dispatches navigate event for admin', async () => {
    await setup(adminUser);
    const events: CustomEvent[] = [];
    el.addEventListener('navigate', e => events.push(e as CustomEvent));
    const adminBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.nav-item')).find(b => b.textContent?.includes('Gebruikers'))!;
    adminBtn.click();
    expect(events[0]?.detail).toEqual({ page: 'admin' });
  });

  it('dispatches navigate event for account', async () => {
    await setup();
    const events: CustomEvent[] = [];
    el.addEventListener('navigate', e => events.push(e as CustomEvent));
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.user-info') as HTMLButtonElement).click();
    expect(events[0]?.detail).toEqual({ page: 'account' });
  });

  it('dispatches navigate event for project', async () => {
    await setup();
    const events: CustomEvent[] = [];
    el.addEventListener('navigate', e => events.push(e as CustomEvent));
    const projectBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-project-id="p1"]')!;
    projectBtn.click();
    expect(events[0]?.detail).toEqual({ projectId: 'p1' });
  });

  it('shows create form on personal + click', async () => {
    await setup();
    const addBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[title="Nieuw project"]')!;
    addBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.new-project-form')).toBeTruthy();
  });

  it('hides create form on cancel', async () => {
    await setup();
    const addBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[title="Nieuw project"]')!;
    addBtn.click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-cancel') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.new-project-form')).toBeNull();
  });

  it('creates a personal project on form submit', async () => {
    await setup();
    const newProject = { id: 'p4', name: 'New Proj', color: '#6366f1', group_id: null, archived_at: null };
    vi.mocked(api.post).mockResolvedValue(newProject);
    const addBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[title="Nieuw project"]')!;
    addBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.new-project-form input')!;
    input.value = 'New Proj';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('.new-project-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/projects', expect.objectContaining({ name: 'New Proj' }));
    expect(el.shadowRoot!.textContent).toContain('New Proj');
  });

  it('shows group create form on group + click', async () => {
    await setup();
    const addGroupBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[title^="Nieuw project in"]')!;
    addGroupBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.new-project-form')).toBeTruthy();
  });

  it('toggles create form on second click', async () => {
    await setup();
    const addBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[title="Nieuw project"]')!;
    addBtn.click();
    await el.updateComplete;
    addBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.new-project-form')).toBeNull();
  });

  it('marks active project with active class', async () => {
    await setup();
    el.activeProjectId = 'p1';
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('[data-project-id="p1"]')!;
    expect(btn.className).toContain('active');
  });

  it('reload() re-fetches data', async () => {
    await setup();
    const newProject = { id: 'p5', name: 'Reloaded Proj', color: '#6366f1', group_id: null, archived_at: null };
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve([...projects, newProject]);
      if (url === '/groups') return Promise.resolve(groups);
      return Promise.resolve([]);
    });
    await el.reload();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Reloaded Proj');
  });

  it('creates group project with group_id body field', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue({ id: 'p9', name: 'Group Proj', color: '#6366f1', group_id: 'g1', archived_at: null });
    // Open group create form
    const addGroupBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[title^="Nieuw project in"]')!;
    addGroupBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.new-project-form input')!;
    input.value = 'Group Proj';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('.new-project-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/projects', expect.objectContaining({ group_id: 'g1' }));
  });

  it('_createProject returns early when name is empty', async () => {
    await setup();
    const addBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('button[title="Nieuw project"]')!;
    addBtn.click();
    await el.updateComplete;
    // Don't type a name, just submit
    el.shadowRoot!.querySelector('.new-project-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('group project without matching activeProjectId has no active class', async () => {
    const groupProj = { id: 'p99', name: 'Group Only', color: '#10b981', group_id: 'g1', archived_at: null };
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve([groupProj]);
      if (url === '/groups') return Promise.resolve(groups);
      return Promise.resolve([]);
    });
    el = await mount<DoenSidebar>('doen-sidebar', { user: adminUser });
    await flushPromises();
    await el.updateComplete;
    el.activeProjectId = 'p1'; // different id
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('[data-project-id="p99"]')!;
    expect(btn.className).not.toContain('active');
  });

  it('shows ? initial when user has no name', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/projects') return Promise.resolve(projects);
      if (url === '/groups') return Promise.resolve(groups);
      return Promise.resolve([]);
    });
    const namelessUser = { id: 'x', email: 'x@x.com', name: null as unknown as string, is_admin: false };
    el = await mount<DoenSidebar>('doen-sidebar', { user: namelessUser });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.avatar')?.textContent?.trim()).toBe('?');
  });

  it('group project with matching activeProjectId has active class', async () => {
    await setup();
    el.activeProjectId = 'p2';
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('[data-project-id="p2"]')!;
    expect(btn.className).toContain('active');
  });
});
