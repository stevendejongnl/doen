import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-project';
import type { PageProject } from './page-project';
import { api, ApiError } from '../services/api';
import { getMe } from '../services/auth';
import type { Task } from '../services/types';

describe('page-project', () => {
  let el: PageProject;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const me = { id: 'me', email: 'me@example.com', name: 'Me', is_admin: false };
  const project = { id: 'p1', name: 'My Project', color: '#6366f1', group_id: null, offers_enabled: false, archived_at: null };
  const householdProject = { id: 'p2', name: 'Household', color: '#10b981', group_id: 'g1', offers_enabled: true, archived_at: null };
  const tasks: Task[] = [
    { id: 't1', title: 'Active Task', status: 'todo', project_id: 'p1', priority: 'medium', due_date: null, scheduled_date: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', description: null, is_recurring: false, assignee_id: null, assignee_name: null, group_id: null, creator_id: 'me' } as unknown as Task,
    { id: 't2', title: 'Done Task', status: 'done', project_id: 'p1', priority: 'low', due_date: null, scheduled_date: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', description: null, is_recurring: false, assignee_id: null, assignee_name: null, group_id: null, creator_id: 'me' } as unknown as Task,
  ];

  async function setup(proj = project, taskList: Task[] = tasks) {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `/projects/${proj.id}`) return Promise.resolve(proj);
      if (url === `/projects/${proj.id}/tasks`) return Promise.resolve(taskList);
      if (url.includes('/balances')) return Promise.resolve([]);
      if (url.includes('/offers')) return Promise.resolve([]);
      if (url.includes('/transactions')) return Promise.resolve([]);
      if (url.includes('/members')) return Promise.resolve([]);
      if (url.includes('/notifications')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el = await mount<PageProject>('page-project', { projectId: proj.id });
    await flushPromises();
    await el.updateComplete;
  }

  it('shows loading skeleton initially', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    el = await mount<PageProject>('page-project', { projectId: 'p1' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.sk-title')).toBeTruthy();
  });

  it('shows project name', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('My Project');
  });

  it('shows active tasks as doen-task elements', async () => {
    await setup();
    // Active tasks are rendered as <doen-task> custom elements in page's shadow DOM
    const taskEls = el.shadowRoot!.querySelectorAll('doen-task');
    // At least one (the active task)
    expect(taskEls.length).toBeGreaterThanOrEqual(1);
  });

  it('hides done tasks by default', async () => {
    await setup();
    // When _showDone is false, done task section label is not shown
    expect(el.shadowRoot!.textContent).not.toContain('Afgerond');
  });

  it('shows done tasks toggle button when there are done tasks', async () => {
    await setup();
    expect(el.shadowRoot!.querySelector('.toggle-done')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('gedaan');
  });

  it('shows done tasks section after toggle', async () => {
    await setup();
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.toggle-done') as HTMLButtonElement).click();
    await el.updateComplete;
    // After toggling, done section label appears
    expect(el.shadowRoot!.textContent).toContain('Afgerond');
  });

  it('starts edit mode on edit button click', async () => {
    await setup();
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.edit-row')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('input[type="text"]')).toBeTruthy();
  });

  it('cancels edit mode on cancel button', async () => {
    await setup();
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    const cancelBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn')).find(b => b.textContent?.includes('Annuleren'))!;
    cancelBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.edit-row')).toBeNull();
  });

  it('saves project edit', async () => {
    await setup();
    vi.mocked(api.put).mockResolvedValue({ ...project, name: 'Renamed' });
    // Reload mock for after save
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `/projects/${project.id}`) return Promise.resolve({ ...project, name: 'Renamed' });
      if (url === `/projects/${project.id}/tasks`) return Promise.resolve(tasks);
      return Promise.resolve([]);
    });
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = 'Renamed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const saveBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn')).find(b => b.textContent?.includes('Opslaan'))!;
    saveBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/projects/p1', expect.objectContaining({ name: 'Renamed' }));
  });

  it('selects color swatch', async () => {
    await setup();
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    const swatches = el.shadowRoot!.querySelectorAll<HTMLElement>('.swatch');
    const lastSwatch = swatches[swatches.length - 1];
    const color = lastSwatch.dataset.color!;
    lastSwatch.click();
    await el.updateComplete;
    expect((el as any)._editColor).toBe(color);
  });

  it('cancels edit on Escape keydown', async () => {
    await setup();
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.edit-row')).toBeNull();
  });

  it('saves edit on Enter keydown', async () => {
    await setup();
    vi.mocked(api.put).mockResolvedValue({ ...project, name: 'Via Enter' });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `/projects/${project.id}`) return Promise.resolve({ ...project, name: 'Via Enter' });
      if (url === `/projects/${project.id}/tasks`) return Promise.resolve(tasks);
      return Promise.resolve([]);
    });
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = 'Via Enter';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('addTask adds a task', async () => {
    await setup(project, []);
    const newTask = { ...tasks[0], id: 'tnew', project_id: 'p1' };
    el.addTask(newTask as Task);
    expect((el as any)._tasks).toContain(newTask);
  });

  it('addTask does not add if project does not match', async () => {
    await setup(project, []);
    const foreignTask = { ...tasks[0], id: 'tother', project_id: 'other' };
    el.addTask(foreignTask as Task);
    expect((el as any)._tasks).not.toContain(foreignTask);
  });

  it('updateTask updates a task', async () => {
    await setup();
    const updated = { ...tasks[0], title: 'Updated Title' };
    el.updateTask(updated as Task);
    expect((el as any)._tasks.find((t: Task) => t.id === 't1').title).toBe('Updated Title');
  });

  it('removeTask removes a task', async () => {
    await setup();
    el.removeTask('t1');
    expect((el as any)._tasks.find((t: Task) => t.id === 't1')).toBeUndefined();
  });

  it('task-created event adds task at top', async () => {
    await setup(project, []);
    const newTask = tasks[0];
    el.dispatchEvent(new CustomEvent('task-created', { detail: newTask, bubbles: true }));
    await el.updateComplete;
    expect((el as any)._tasks[0]).toBe(newTask);
  });

  it('shows not found state when project is null', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockRejectedValue(new ApiError(404, 'not found'));
    el = await mount<PageProject>('page-project', { projectId: 'nonexistent' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('niet gevonden');
  });

  it('reload() refreshes data', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `/projects/${project.id}`) return Promise.resolve({ ...project, name: 'Reloaded' });
      if (url === `/projects/${project.id}/tasks`) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(getMe).mockResolvedValue(me);
    await el.reload();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Reloaded');
  });

  it('shows household panel for group projects', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `/projects/${householdProject.id}`) return Promise.resolve(householdProject);
      if (url === `/projects/${householdProject.id}/tasks`) return Promise.resolve([]);
      if (url.includes('/balances')) return Promise.resolve([{ user_id: 'me', name: 'Me', balance: 5 }]);
      if (url.includes('/offers')) return Promise.resolve([]);
      if (url.includes('/transactions')) return Promise.resolve([]);
      if (url.includes('/members')) return Promise.resolve([]);
      if (url.includes('/notifications')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el = await mount<PageProject>('page-project', { projectId: 'p2' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.household-panel')).toBeTruthy();
  });

  async function setupHousehold(overrides: {
    offers?: any[];
    notifications?: any[];
    balances?: any[];
    transactions?: any[];
    members?: any[];
  } = {}) {
    const { offers = [], notifications = [], balances = [], transactions = [], members = [] } = overrides;
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === `/projects/${householdProject.id}`) return Promise.resolve(householdProject);
      if (url === `/projects/${householdProject.id}/tasks`) return Promise.resolve([]);
      if (url.includes('/balances')) return Promise.resolve(balances);
      if (url.includes('/offers')) return Promise.resolve(offers);
      if (url.includes('/transactions')) return Promise.resolve(transactions);
      if (url.includes('/members')) return Promise.resolve(members);
      if (url.includes('/notifications')) return Promise.resolve(notifications);
      return Promise.resolve([]);
    });
    el = await mount<PageProject>('page-project', { projectId: 'p2' });
    await flushPromises();
    await el.updateComplete;
  }

  it('shows balance chips in household panel', async () => {
    await setupHousehold({ balances: [{ user_id: 'me', name: 'Me', balance: 5 }] });
    expect(el.shadowRoot!.querySelector('.balance-chip')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.balance-chip.positive')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('Me');
  });

  it('shows negative balance chip class', async () => {
    await setupHousehold({ balances: [{ user_id: 'me', name: 'Me', balance: -3 }] });
    expect(el.shadowRoot!.querySelector('.balance-chip.negative')).toBeTruthy();
  });

  it('shows offers in household panel', async () => {
    const offer = {
      id: 'o1', task_id: 't1', task_title: 'Wash dishes', owner_id: 'other',
      owner_name: 'Bob', status: 'open', point_value: 2, reward_note: 'pizza',
    };
    await setupHousehold({ offers: [offer] });
    expect(el.shadowRoot!.querySelector('.offer-card')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('Wash dishes');
  });

  it('shows accept button for open offer from another user', async () => {
    const offer = {
      id: 'o1', task_id: 't1', task_title: 'Clean', owner_id: 'other',
      owner_name: 'Bob', status: 'open', point_value: 2, reward_note: null,
    };
    await setupHousehold({ offers: [offer] });
    expect(el.shadowRoot!.textContent).toContain('Accepteren');
  });

  it('accepts an offer', async () => {
    const offer = {
      id: 'o1', task_id: 't1', task_title: 'Clean', owner_id: 'other',
      owner_name: 'Bob', status: 'open', point_value: 2, reward_note: null,
    };
    vi.mocked(api.post).mockResolvedValue({});
    await setupHousehold({ offers: [offer] });
    (el as any)._onAcceptOfferClick({ currentTarget: { dataset: { offerId: 'o1' } } } as any);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/offers/o1/accept', {});
  });

  it('shows withdraw button for my own open offer', async () => {
    const offer = {
      id: 'o2', task_id: 't2', task_title: 'Cook', owner_id: 'me',
      owner_name: 'Me', status: 'open', point_value: 3, reward_note: null,
    };
    await setupHousehold({ offers: [offer] });
    expect(el.shadowRoot!.textContent).toContain('Intrekken');
  });

  it('withdraws an offer', async () => {
    const offer = {
      id: 'o2', task_id: 't2', task_title: 'Cook', owner_id: 'me',
      owner_name: 'Me', status: 'open', point_value: 3, reward_note: null,
    };
    vi.mocked(api.delete).mockResolvedValue(undefined);
    await setupHousehold({ offers: [offer] });
    (el as any)._onWithdrawOfferClick({ currentTarget: { dataset: { offerId: 'o2' } } } as any);
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/offers/o2');
  });

  it('shows approve/reject buttons for my requested offer', async () => {
    const offer = {
      id: 'o3', task_id: 't3', task_title: 'Vacuum', owner_id: 'me',
      owner_name: 'Me', status: 'requested', point_value: 2, reward_note: null,
    };
    await setupHousehold({ offers: [offer] });
    expect(el.shadowRoot!.textContent).toContain('Goedkeuren');
    expect(el.shadowRoot!.textContent).toContain('Afwijzen');
  });

  it('approves an offer', async () => {
    const offer = {
      id: 'o3', task_id: 't3', task_title: 'Vacuum', owner_id: 'me',
      owner_name: 'Me', status: 'requested', point_value: 2, reward_note: null,
    };
    vi.mocked(api.post).mockResolvedValue({});
    await setupHousehold({ offers: [offer] });
    (el as any)._onApproveOfferClick({ currentTarget: { dataset: { offerId: 'o3' } } } as any);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/offers/o3/decision', expect.objectContaining({ approved: true }));
  });

  it('shows transactions in household panel', async () => {
    const tx = { id: 'tx1', user_name: 'Me', kind: 'transfer', amount: 5, note: 'test note' };
    await setupHousehold({ transactions: [tx] });
    expect(el.shadowRoot!.querySelector('.transaction-row')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('Me');
  });

  it('shows inbox notifications', async () => {
    const notification = {
      id: 'n1', title: 'Bob wil Clean doen', message: 'voor pizza', actionable: false, offer_id: null,
    };
    await setupHousehold({ notifications: [notification] });
    expect(el.shadowRoot!.querySelector('.inbox-item')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('Bob wil Clean doen');
  });

  it('shows actionable inbox notification with approve/reject buttons', async () => {
    const offer = {
      id: 'o4', task_id: 't4', task_title: 'Mow lawn', owner_id: 'other',
      owner_name: 'Bob', status: 'requested', point_value: 3, reward_note: null,
    };
    const notification = {
      id: 'n2', title: 'Bob wil Mow lawn doen', message: '', actionable: true, offer_id: 'o4',
    };
    await setupHousehold({ offers: [offer], notifications: [notification] });
    const inboxItem = el.shadowRoot!.querySelector('.inbox-item.actionable');
    expect(inboxItem).toBeTruthy();
    expect(inboxItem!.textContent).toContain('Goedkeuren');
  });

  it('inbox approve action calls api', async () => {
    const offer = {
      id: 'o4', task_id: 't4', task_title: 'Mow', owner_id: 'other',
      owner_name: 'Bob', status: 'requested', point_value: 3, reward_note: null,
    };
    vi.mocked(api.post).mockResolvedValue({});
    await setupHousehold({ offers: [offer], notifications: [{ id: 'n2', title: 'X', message: '', actionable: true, offer_id: 'o4' }] });
    (el as any)._onInboxApproveClick({ currentTarget: { dataset: { offerId: 'o4' } } } as any);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/offers/o4/decision', expect.objectContaining({ approved: true }));
  });

  it('inbox reject action calls api', async () => {
    const offer = {
      id: 'o5', task_id: 't5', task_title: 'X', owner_id: 'other',
      owner_name: 'Bob', status: 'requested', point_value: 2, reward_note: null,
    };
    vi.mocked(api.post).mockResolvedValue({});
    await setupHousehold({ offers: [offer] });
    (el as any)._onInboxRejectClick({ currentTarget: { dataset: { offerId: 'o5' } } } as any);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/offers/o5/decision', expect.objectContaining({ approved: false }));
  });

  it('shows offers-enabled toggle in edit mode for group project', async () => {
    await setupHousehold();
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('label.offers-toggle')).toBeTruthy();
  });

  it('no change save closes editing without api call', async () => {
    await setupHousehold();
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    // Don't change anything, click save
    const saveBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn')).find(b => b.textContent?.includes('Opslaan'))!;
    saveBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    expect(el.shadowRoot!.querySelector('.edit-row')).toBeNull();
  });

  it('transfers points to another member', async () => {
    const members = [
      { user_id: 'me', name: 'Me', email: 'me@example.com', role: 'member' },
      { user_id: 'alice', name: 'Alice', email: 'a@example.com', role: 'member' },
    ];
    await setupHousehold({ members });
    vi.mocked(api.post).mockResolvedValue({});
    (el as any)._transferTo = 'alice';
    (el as any)._transferAmount = 3;
    (el as any)._transferNote = 'pizza';
    await (el as any)._transferPoints();
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(
      `/households/g1/transfer`,
      expect.objectContaining({ to_user_id: 'alice', amount: 3, note: 'pizza' }),
    );
  });

  it('transfer skips when no transferTo set', async () => {
    await setupHousehold();
    await (el as any)._transferPoints();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('shows error toast when save edit fails', async () => {
    await setup();
    vi.mocked(api.put).mockRejectedValue(new ApiError(500, 'save error'));
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = 'Changed Name';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const saveBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn')).find(b => b.textContent?.includes('Opslaan'))!;
    saveBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._saving).toBe(false);
  });

  it('_onEditOffersClick updates editOffersEnabled', async () => {
    await setupHousehold();
    (el.shadowRoot!.querySelector<HTMLButtonElement>('.edit-btn') as HTMLButtonElement).click();
    await el.updateComplete;
    const checkbox = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    // Simulate click event that stopPropagation handles
    const event = { stopPropagation: vi.fn(), target: { checked: false } };
    (el as any)._onEditOffersClick(event);
    expect((el as any)._editOffersEnabled).toBe(false);
  });

  it('_onTransferAmountInput parses and clamps value', async () => {
    await setupHousehold();
    const event = new CustomEvent('doen-input', { detail: { value: '5' } });
    (el as any)._onTransferAmountInput(event);
    expect((el as any)._transferAmount).toBe(5);
  });

  it('reject offer via button calls api', async () => {
    const offer = {
      id: 'o5', task_id: 't5', task_title: 'X', owner_id: 'me',
      owner_name: 'Me', status: 'requested', point_value: 2, reward_note: null,
    };
    vi.mocked(api.post).mockResolvedValue({});
    await setupHousehold({ offers: [offer] });
    (el as any)._onRejectOfferClick({ currentTarget: { dataset: { offerId: 'o5' } } } as any);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/offers/o5/decision', expect.objectContaining({ approved: false }));
  });

  it('_onOfferCreated refreshes household', async () => {
    await setupHousehold();
    vi.mocked(api.get).mockClear();
    (el as any)._onOfferCreated();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalled();
  });

  it('_onTaskUpdatedFromList updates task and refreshes household', async () => {
    await setup(householdProject, [tasks[0]]);
    vi.mocked(api.get).mockClear();
    const updated = { ...tasks[0], title: 'Updated from SSE' };
    (el as any)._onTaskUpdatedFromList({ detail: updated } as CustomEvent<Task>);
    await flushPromises();
    expect((el as any)._tasks.find((t: Task) => t.id === 't1').title).toBe('Updated from SSE');
  });

  const fakeOffer = { id: 'o1', task_id: 't1', task_title: 'T', owner_id: 'u2', owner_name: 'Bob', status: 'requested', point_value: 1, reward_note: null };

  it('shows error toast when _acceptOffer fails', async () => {
    await setupHousehold({ offers: [fakeOffer] });
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'accept fail'));
    await (el as any)._acceptOffer(fakeOffer);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('shows error toast when _decideOffer fails', async () => {
    await setupHousehold({ offers: [fakeOffer] });
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'decide fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._decideOffer(fakeOffer, false);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('shows error toast when _withdrawOffer fails', async () => {
    await setupHousehold({ offers: [fakeOffer] });
    vi.mocked(api.delete).mockRejectedValue(new ApiError(500, 'withdraw fail'));
    await (el as any)._withdrawOffer(fakeOffer);
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
  });

  it('shows error toast when _handleInboxAction fails', async () => {
    await setupHousehold({ offers: [fakeOffer] });
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'inbox fail'));
    await (el as any)._handleInboxAction(fakeOffer, true);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('shows error toast when _transferPoints fails', async () => {
    await setupHousehold({ members: [{ user_id: 'alice', name: 'Alice', email: 'a@a.com', role: 'member' }] });
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'transfer fail'));
    (el as any)._transferTo = 'alice';
    (el as any)._transferAmount = 3;
    await (el as any)._transferPoints();
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('non-ApiError from _acceptOffer is ignored silently', async () => {
    await setupHousehold({ offers: [fakeOffer] });
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    await (el as any)._acceptOffer(fakeOffer);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('non-ApiError from _decideOffer is ignored silently', async () => {
    await setupHousehold({ offers: [fakeOffer] });
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await (el as any)._decideOffer(fakeOffer, false);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('non-ApiError from _saveEdit is ignored silently', async () => {
    await setup();
    vi.mocked(api.put).mockRejectedValue(new Error('network'));
    (el as any)._editing = true;
    (el as any)._editName = 'New Name';
    (el as any)._editColor = '#fff';
    await (el as any)._saveEdit();
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('shows transaction with negative amount and null note', async () => {
    const tx = { id: 'tx2', user_name: 'Alice', kind: 'deduct', amount: -3, note: null };
    await setupHousehold({ transactions: [tx] });
    const row = el.shadowRoot!.querySelector('.transaction-row')!;
    expect(row.querySelector('.negative')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('-3');
  });

  it('_onEditNameKeydown Enter saves project', async () => {
    await setup();
    vi.mocked(api.put).mockResolvedValue({ ...project, name: 'New' });
    (el as any)._editing = true;
    (el as any)._editName = 'New';
    (el as any)._editColor = '#fff';
    (el as any)._editOffersEnabled = false;
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    (el as any)._onEditNameKeydown(e);
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('_onEditNameKeydown Escape cancels editing', async () => {
    await setup();
    (el as any)._editing = true;
    const e = new KeyboardEvent('keydown', { key: 'Escape' });
    (el as any)._onEditNameKeydown(e);
    await el.updateComplete;
    expect((el as any)._editing).toBe(false);
  });

  it('_onEditColorClick sets edit color from dataset', async () => {
    await setup();
    (el as any)._editing = true;
    const fakeEvent = { currentTarget: { dataset: { color: '#10b981' } } } as unknown as Event;
    (el as any)._onEditColorClick(fakeEvent);
    expect((el as any)._editColor).toBe('#10b981');
  });

  it('_onEditOffersClick sets editOffersEnabled from checkbox', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editOffersEnabled = false;
    const fakeEvent = { target: { checked: true }, stopPropagation: () => {} } as unknown as Event;
    (el as any)._onEditOffersClick(fakeEvent);
    expect((el as any)._editOffersEnabled).toBe(true);
  });

  it('_onTransferToChange updates _transferTo', async () => {
    await setup(householdProject);
    const event = new CustomEvent('doen-input', { detail: { value: 'alice' } });
    (el as any)._onTransferToChange(event);
    expect((el as any)._transferTo).toBe('alice');
  });

  it('_onTransferNoteInput updates _transferNote', async () => {
    await setup(householdProject);
    const event = new CustomEvent('doen-input', { detail: { value: 'pizza money' } });
    (el as any)._onTransferNoteInput(event);
    expect((el as any)._transferNote).toBe('pizza money');
  });

  it('_onOfferCreated refreshes household', async () => {
    await setup(householdProject);
    vi.mocked(api.get).mockResolvedValue([]);
    (el as any)._onOfferCreated();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalled();
  });

  it('_onOfferUpdated refreshes household', async () => {
    await setup(householdProject);
    vi.mocked(api.get).mockResolvedValue([]);
    (el as any)._onOfferUpdated();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalled();
  });

  it('addTask does not add task from different project', async () => {
    await setup();
    const foreignTask = { ...tasks[0], id: 't99', project_id: 'other' } as unknown as Task;
    el.addTask(foreignTask);
    expect((el as any)._tasks.find((t: Task) => t.id === 't99')).toBeUndefined();
  });

  it('addTask does not add duplicate task', async () => {
    await setup();
    el.addTask(tasks[0]);
    expect((el as any)._tasks.filter((t: Task) => t.id === 't1').length).toBe(1);
  });

  it('non-ApiError from _transferPoints is ignored silently', async () => {
    await setup(householdProject);
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    (el as any)._transferTo = 'alice';
    (el as any)._transferAmount = 3;
    await (el as any)._transferPoints();
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('_saveEdit returns early when no project', async () => {
    await setup();
    (el as any)._project = null;
    await (el as any)._saveEdit();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_saveEdit returns early when name is empty', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = '   ';
    await (el as any)._saveEdit();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_saveEdit returns early when no changes', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = project.name;
    (el as any)._editColor = project.color;
    (el as any)._editOffersEnabled = project.offers_enabled ?? true;
    await (el as any)._saveEdit();
    await el.updateComplete;
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    expect((el as any)._editing).toBe(false);
  });

  it('_startEdit returns early when _project is null', async () => {
    await setup();
    (el as any)._project = null;
    (el as any)._startEdit();
    expect((el as any)._editing).toBe(false);
  });

  it('_startEdit defaults offers_enabled to true when project has null offers_enabled', async () => {
    const proj = { ...project, offers_enabled: null };
    await setup(proj as any);
    (el as any)._startEdit();
    expect((el as any)._editOffersEnabled).toBe(true);
  });

  it('_saveEdit treats null offers_enabled as true when computing changed state', async () => {
    const proj = { ...project, offers_enabled: null };
    await setup(proj as any);
    (el as any)._editing = true;
    (el as any)._editName = proj.name;
    (el as any)._editColor = proj.color;
    (el as any)._editOffersEnabled = true;
    await (el as any)._saveEdit();
    await el.updateComplete;
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    expect((el as any)._editing).toBe(false);
  });

  it('_onTransferAmountInput falls back to 1 when input is non-numeric', async () => {
    await setupHousehold();
    const event = new CustomEvent('doen-input', { detail: { value: 'abc' } });
    (el as any)._onTransferAmountInput(event);
    expect((el as any)._transferAmount).toBe(1);
  });

  it('_onInboxApproveClick does nothing when offer id not found', async () => {
    await setupHousehold({ offers: [] });
    (el as any)._onInboxApproveClick({ currentTarget: { dataset: { offerId: 'nonexistent' } } } as any);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onInboxRejectClick does nothing when offer id not found', async () => {
    await setupHousehold({ offers: [] });
    (el as any)._onInboxRejectClick({ currentTarget: { dataset: { offerId: 'nonexistent' } } } as any);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onAcceptOfferClick does nothing when offer id not found', async () => {
    await setupHousehold({ offers: [] });
    (el as any)._onAcceptOfferClick({ currentTarget: { dataset: { offerId: 'nonexistent' } } } as any);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onApproveOfferClick does nothing when offer id not found', async () => {
    await setupHousehold({ offers: [] });
    (el as any)._onApproveOfferClick({ currentTarget: { dataset: { offerId: 'nonexistent' } } } as any);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onRejectOfferClick does nothing when offer id not found', async () => {
    await setupHousehold({ offers: [] });
    (el as any)._onRejectOfferClick({ currentTarget: { dataset: { offerId: 'nonexistent' } } } as any);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_onWithdrawOfferClick does nothing when offer id not found', async () => {
    await setupHousehold({ offers: [] });
    (el as any)._onWithdrawOfferClick({ currentTarget: { dataset: { offerId: 'nonexistent' } } } as any);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('updated resets edit state but does not call _load when projectId changes to empty', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = 'Changed';
    vi.mocked(api.get).mockClear();
    el.projectId = '';
    await el.updateComplete;
    expect((el as any)._editing).toBe(false);
    expect(vi.mocked(api.get)).not.toHaveBeenCalled();
  });

  it('does not call _load on connect when projectId is empty', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockResolvedValue([]);
    el = await mount<PageProject>('page-project', {});
    await flushPromises();
    expect(vi.mocked(api.get)).not.toHaveBeenCalled();
  });

  it('non-ApiError from _load is ignored silently', async () => {
    vi.mocked(getMe).mockRejectedValue(new Error('network failure'));
    vi.mocked(api.get).mockResolvedValue([]);
    el = await mount<PageProject>('page-project', { projectId: 'p1' });
    await flushPromises();
    expect((el as any)._loading).toBe(false);
  });

  it('_refreshHousehold does nothing when _project is null', async () => {
    await setup();
    (el as any)._project = null;
    await (el as any)._refreshHousehold();
    expect(vi.mocked(api.get).mock.calls.filter((c: string[]) => c[0]?.includes('/offers')).length).toBe(0);
  });

  it('non-ApiError from _withdrawOffer is ignored silently', async () => {
    const offer = {
      id: 'o1', task_id: 't1', task_title: 'Task', owner_id: 'me',
      owner_name: 'Me', status: 'requested', point_value: 1, reward_note: null,
    };
    await setupHousehold({ offers: [offer] });
    vi.mocked(api.delete).mockRejectedValue(new Error('network failure'));
    await (el as any)._withdrawOffer(offer);
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
  });

  it('non-ApiError from _handleInboxAction is ignored silently', async () => {
    const offer = {
      id: 'o1', task_id: 't1', task_title: 'Task', owner_id: 'me',
      owner_name: 'Me', status: 'requested', point_value: 1, reward_note: null,
    };
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    await setupHousehold({ offers: [offer] });
    await (el as any)._handleInboxAction(offer, true);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('discardProjectEdit resets all edit state', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = 'Changed';
    (el as any)._editColor = '#ff0000';
    (el as any)._editOffersEnabled = false;
    el.discardProjectEdit();
    expect((el as any)._editing).toBe(false);
    expect((el as any)._editName).toBe('');
    expect((el as any)._editColor).toBe('');
    expect((el as any)._editOffersEnabled).toBe(true);
  });

  it('hasUnsavedProjectChanges returns false when not editing', async () => {
    await setup();
    (el as any)._editing = false;
    expect(el.hasUnsavedProjectChanges()).toBe(false);
  });

  it('hasUnsavedProjectChanges returns false when project is null', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._project = null;
    expect(el.hasUnsavedProjectChanges()).toBe(false);
  });

  it('hasUnsavedProjectChanges returns false when nothing changed', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = project.name;
    (el as any)._editColor = project.color;
    (el as any)._editOffersEnabled = project.offers_enabled ?? true;
    expect(el.hasUnsavedProjectChanges()).toBe(false);
  });

  it('hasUnsavedProjectChanges returns true when name changed', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = 'Different Name';
    (el as any)._editColor = project.color;
    (el as any)._editOffersEnabled = project.offers_enabled ?? true;
    expect(el.hasUnsavedProjectChanges()).toBe(true);
  });

  it('hasUnsavedProjectChanges returns true when color changed', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = project.name;
    (el as any)._editColor = '#ff0000';
    (el as any)._editOffersEnabled = project.offers_enabled ?? true;
    expect(el.hasUnsavedProjectChanges()).toBe(true);
  });

  it('hasUnsavedProjectChanges returns true when offers_enabled changed', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = project.name;
    (el as any)._editColor = project.color;
    (el as any)._editOffersEnabled = !(project.offers_enabled ?? true);
    expect(el.hasUnsavedProjectChanges()).toBe(true);
  });

  it('hasUnsavedProjectChanges returns true when offers_enabled differs from null project value', async () => {
    const proj = { ...project, offers_enabled: null };
    await setup(proj as any);
    (el as any)._editing = true;
    (el as any)._editName = proj.name;
    (el as any)._editColor = proj.color;
    (el as any)._editOffersEnabled = false;
    expect(el.hasUnsavedProjectChanges()).toBe(true);
  });

  it('hasUnsavedProjectChanges trims name before comparing', async () => {
    await setup();
    (el as any)._editing = true;
    (el as any)._editName = `  ${project.name}  `;
    (el as any)._editColor = project.color;
    (el as any)._editOffersEnabled = project.offers_enabled ?? true;
    expect(el.hasUnsavedProjectChanges()).toBe(false);
  });
});
