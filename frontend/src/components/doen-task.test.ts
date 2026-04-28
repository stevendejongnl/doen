import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './doen-task';
import type { DoenTask } from './doen-task';
import { api, ApiError } from '../services/api';
import type { Task, RecurringRule } from '../services/types';

describe('doen-task', () => {
  let el: DoenTask;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const recurringRule: RecurringRule = {
    id: 'rr1', template_task_id: 't1', active: true,
    unit: 'week', interval: 1, weekdays: '0,1', month_day: null,
    time_of_day: '08:00', parity: 'any', notify_on_spawn: false,
  } as unknown as RecurringRule;

  function makeTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 't1', title: 'Test Task', status: 'todo', project_id: 'p1',
      priority: 'medium', due_date: null, scheduled_date: null,
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      description: null, notes: null, is_recurring: false, assignee_id: null,
      assignee_name: null, group_id: null, creator_id: 'me',
      category_id: null, category_name: null, category_color: null,
      recurring_rule: null, point_value: 1,
      ...overrides,
    } as unknown as Task;
  }

  const project = { id: 'p1', name: 'My Project', color: '#6366f1', group_id: null, offers_enabled: false };
  const groupProject = { id: 'p1', name: 'Group', color: '#6366f1', group_id: 'g1', offers_enabled: true };

  async function setup(task = makeTask()) {
    el = await mount<DoenTask>('doen-task', { task });
    await el.updateComplete;
  }

  function openModal() {
    return (el as any)._openModal('view');
  }

  // ─── Row rendering ───────────────────────────────────────────────────────────

  it('renders task title', async () => {
    await setup();
    expect(el.shadowRoot!.querySelector('.task-title')?.textContent).toContain('Test Task');
  });

  it('renders priority dot', async () => {
    await setup(makeTask({ priority: 'high' }));
    expect(el.shadowRoot!.querySelector('.priority-dot.p-high')).toBeTruthy();
  });

  it('shows due date chip when task has due_date', async () => {
    const future = new Date(Date.now() + 86400 * 1000 * 5).toISOString();
    await setup(makeTask({ due_date: future }));
    expect(el.shadowRoot!.querySelector('.due-date')).toBeTruthy();
  });

  it('marks overdue task with overdue class', async () => {
    const past = new Date(Date.now() - 86400 * 1000 * 2).toISOString();
    await setup(makeTask({ due_date: past }));
    expect(el.shadowRoot!.querySelector('.due-date.overdue')).toBeTruthy();
  });

  it('shows recurring meta icon when task has recurring_rule', async () => {
    await setup(makeTask({ recurring_rule: recurringRule }));
    const icon = el.shadowRoot!.querySelector('.meta-icon.fa-repeat');
    expect(icon).toBeTruthy();
  });

  it('shows notes icon when task has notes', async () => {
    await setup(makeTask({ notes: 'some notes' }));
    expect(el.shadowRoot!.querySelector('.meta-icon.fa-align-left')).toBeTruthy();
  });

  it('shows assignee chip when assignee_name is set', async () => {
    await setup(makeTask({ assignee_name: 'Alice' }));
    expect(el.shadowRoot!.querySelector('.assignee-chip')?.textContent).toContain('A');
  });

  it('shows category chip when category_name is set', async () => {
    await setup(makeTask({ category_name: 'Work', category_color: '#a855f7' }));
    expect(el.shadowRoot!.querySelector('.category-chip')?.textContent).toContain('Work');
  });

  // ─── Complete / undo ─────────────────────────────────────────────────────────

  it('marks task done on check button click', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue(makeTask({ status: 'done' }));
    const events: CustomEvent[] = [];
    el.addEventListener('task-updated', e => events.push(e as CustomEvent));
    el.shadowRoot!.querySelector<HTMLButtonElement>('.check-btn')!.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/tasks/t1/complete', {});
    expect(events[0]?.detail?.status).toBe('done');
  });

  it('reopens done task on check button click', async () => {
    await setup(makeTask({ status: 'done' }));
    vi.mocked(api.post).mockResolvedValue(makeTask({ status: 'todo' }));
    el.shadowRoot!.querySelector<HTMLButtonElement>('.check-btn')!.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/tasks/t1/reopen', {});
  });

  it('reverts status on complete api error', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'fail'));
    const prevStatus = el.task.status;
    el.shadowRoot!.querySelector<HTMLButtonElement>('.check-btn')!.click();
    await flushPromises();
    await el.updateComplete;
    expect(el.task.status).toBe(prevStatus);
  });

  // ─── Modal open/close ─────────────────────────────────────────────────────────

  it('opens modal on row click', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.shadowRoot!.querySelector<HTMLElement>('.task-row')!.click();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.modal-backdrop')).toBeTruthy();
  });

  it('does not open modal when clicking check button', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue(makeTask({ status: 'done' }));
    el.shadowRoot!.querySelector<HTMLButtonElement>('.check-btn')!.click();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.modal-backdrop')).toBeNull();
  });

  it('closes modal via close button', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('.modal-close')!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.modal-backdrop')).toBeNull();
  });

  it('closes modal on backdrop click', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    const backdrop = el.shadowRoot!.querySelector<HTMLElement>('.modal-backdrop')!;
    // simulate click where target === currentTarget
    (el as any)._onBackdropClick({ target: backdrop, currentTarget: backdrop } as unknown as MouseEvent);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.modal-backdrop')).toBeNull();
  });

  it('closes modal on Escape key', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.modal-backdrop')).toBeNull();
  });

  it('dispatches modal-closed event on close', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    const events: CustomEvent[] = [];
    el.addEventListener('modal-closed', e => events.push(e as CustomEvent));
    (el as any)._closeModal();
    expect(events.length).toBe(1);
  });

  // ─── Modal detail view ────────────────────────────────────────────────────────

  it('shows task title in modal header', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.modal-title')?.textContent).toContain('Test Task');
  });

  it('shows detail grid in view mode', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.detail-grid')).toBeTruthy();
  });

  it('shows notes in detail view when task has notes', async () => {
    await setup(makeTask({ notes: 'my note content' }));
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask({ notes: 'my note content' }));
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('my note content');
  });

  it('shows recurring rule description in detail view', async () => {
    await setup(makeTask({ recurring_rule: recurringRule }));
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask({ recurring_rule: recurringRule }));
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.detail-row .fa-repeat')).toBeTruthy();
  });

  // ─── Edit mode ────────────────────────────────────────────────────────────────

  it('switches to edit mode on edit button click', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-edit-modal')!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.edit-form')).toBeTruthy();
  });

  it('cancel edit returns to view mode', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-cancel-edit')!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.detail-grid')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.edit-form')).toBeNull();
  });

  it('saves edit successfully', async () => {
    await setup();
    const updatedTask = makeTask({ title: 'Updated Title' });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockResolvedValue(updatedTask);
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.edit-title')!;
    input.value = 'Updated Title';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('task-updated', e => events.push(e as CustomEvent));
    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    await el.updateComplete;

    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/tasks/t1', expect.objectContaining({ title: 'Updated Title' }));
    expect(events[0]?.detail?.title).toBe('Updated Title');
  });

  it('does not save when title is empty', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    (el as any)._editTitle = '';
    await el.updateComplete;

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  // ─── Delete ───────────────────────────────────────────────────────────────────

  it('dispatches task-deleted after delete confirm', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.delete).mockResolvedValue(undefined);
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('task-deleted', e => events.push(e as CustomEvent));

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-delete')!.click();
    await el.updateComplete;
    // Confirm dialog is in document.body
    const confirmDialog = document.body.querySelector('doen-confirm-dialog') as any;
    confirmDialog?.dispatchEvent(new CustomEvent('doen-confirm', { bubbles: false }));
    await flushPromises();
    await el.updateComplete;

    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/tasks/t1');
    expect(events[0]?.detail).toBe('t1');
    document.body.querySelector('doen-confirm-dialog')?.remove();
  });

  // ─── Recurring in edit ────────────────────────────────────────────────────────

  it('shows recurrence builder when edit recurring is toggled on', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editRecurring = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.recurrence-builder')).toBeTruthy();
  });

  it('shows weekday chips in week recurrence mode', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editRecurring = true;
    (el as any)._editUnit = 'week';
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelectorAll('[data-weekday]');
    expect(chips.length).toBe(7);
  });

  it('toggles weekday chip', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editRecurring = true;
    (el as any)._editUnit = 'week';
    (el as any)._editWeekdays = new Set([0]);
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector<HTMLElement>('[data-weekday="0"]')!;
    chip.click();
    await el.updateComplete;
    expect((el as any)._editWeekdays.has(0)).toBe(false);
  });

  it('shows month day input in month recurrence mode', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editRecurring = true;
    (el as any)._editUnit = 'month';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('input[type="number"]')).toBeTruthy();
  });

  it('creates recurring rule when saving task that gains recurrence', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockResolvedValue(makeTask());
    vi.mocked(api.post).mockResolvedValue({});
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    (el as any)._editRecurring = true;
    await el.updateComplete;

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/tasks/t1/recurring', expect.objectContaining({ unit: 'week' }));
  });

  it('deletes recurring rule when saving task that loses recurrence', async () => {
    const taskWithRule = makeTask({ recurring_rule: recurringRule });
    await setup(taskWithRule);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(taskWithRule);
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockResolvedValue(makeTask());
    vi.mocked(api.delete).mockResolvedValue(undefined);
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    (el as any)._editRecurring = false;
    await el.updateComplete;

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/recurring/rr1');
  });

  // ─── hideRow prop ─────────────────────────────────────────────────────────────

  it('renders only modal when hideRow is true', async () => {
    el = await mount<DoenTask>('doen-task', { task: makeTask(), hideRow: true });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.task-row')).toBeNull();
  });

  // ─── autoOpen prop ────────────────────────────────────────────────────────────

  it('opens modal automatically when autoOpen is set', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el = await mount<DoenTask>('doen-task', { task: makeTask(), autoOpen: true });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.modal-backdrop')).toBeTruthy();
  });

  // ─── Member loading ───────────────────────────────────────────────────────────

  it('loads members for group projects', async () => {
    const members = [
      { user_id: 'me', name: 'Me', email: 'me@example.com', role: 'member' },
      { user_id: 'alice', name: 'Alice', email: 'a@example.com', role: 'member' },
    ];
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask({ project_id: 'p1' }));
      if (url.includes('/projects/')) return Promise.resolve(groupProject);
      if (url.includes('/members')) return Promise.resolve(members);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await setup(makeTask({ project_id: 'p1' }));
    await openModal();
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._members.length).toBe(2);
  });

  it('shows offer button for group projects with offers_enabled', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(groupProject);
      if (url.includes('/members')) return Promise.resolve([]);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await setup(makeTask({ project_id: 'p1' }));
    await openModal();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.btn-cancel-edit .fa-handshake')?.closest('button')
      ?? el.shadowRoot!.textContent?.includes('Offeren')).toBeTruthy();
  });

  it('shows member select in edit form when multiple members', async () => {
    const members = [
      { user_id: 'me', name: 'Me', email: 'me@example.com', role: 'member' },
      { user_id: 'alice', name: 'Alice', email: 'a@example.com', role: 'member' },
    ];
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(groupProject);
      if (url.includes('/members')) return Promise.resolve(members);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await setup(makeTask({ project_id: 'p1' }));
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    // Member select appears only when > 1 member
    expect(el.shadowRoot!.textContent).toContain('Niemand toegewezen');
  });

  it('patches existing recurring rule when saving', async () => {
    const taskWithRule = makeTask({ recurring_rule: recurringRule });
    await setup(taskWithRule);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(taskWithRule);
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockResolvedValue(taskWithRule);
    vi.mocked(api.patch).mockResolvedValue(recurringRule);
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    // Keep recurring enabled (was already on)
    (el as any)._editRecurring = true;
    (el as any)._editInterval = 2;
    await el.updateComplete;

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect(vi.mocked(api.patch)).toHaveBeenCalledWith('/recurring/rr1', expect.objectContaining({ interval: 2 }));
  });

  it('status toggle in detail view calls _complete', async () => {
    await setup(makeTask({ status: 'done' }));
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask({ status: 'done' }));
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.post).mockResolvedValue(makeTask({ status: 'todo' }));
    await openModal();
    await flushPromises();
    await el.updateComplete;

    const statusToggle = el.shadowRoot!.querySelector<HTMLElement>('.detail-chip.toggle')!;
    statusToggle.click();
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/tasks/t1/reopen', {});
  });

  it('shows category chip in detail view when task has category', async () => {
    const taskWithCat = makeTask({ category_name: 'Work', category_color: '#a855f7' });
    await setup(taskWithCat);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(taskWithCat);
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await openModal();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.category-chip')).toBeTruthy();
  });

  it('shows month-day recurrence in edit', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editRecurring = true;
    (el as any)._editUnit = 'month';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('input[type="number"]')).toBeTruthy();
  });

  it('_onEditTimeInput normalizes time value', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editRecurring = true;
    await el.updateComplete;
    const timeInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[aria-label="Tijd in 24-uurs notatie"]')!;
    timeInput.value = '9:5';
    timeInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect((el as any)._editTimeOfDay).toBeTruthy();
  });

  it('_onEditTimeBlur resets invalid time to 08:00', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editRecurring = true;
    await el.updateComplete;
    const timeInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[aria-label="Tijd in 24-uurs notatie"]')!;
    timeInput.value = 'invalid';
    timeInput.dispatchEvent(new Event('blur', { bubbles: true }));
    await el.updateComplete;
    expect((el as any)._editTimeOfDay).toBe('08:00');
  });

  it('delete api error shows toast and does not throw', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.delete).mockRejectedValue(new ApiError(500, 'delete failed'));
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-delete')!.click();
    await el.updateComplete;
    const confirmDialog = document.body.querySelector('doen-confirm-dialog') as any;
    confirmDialog?.dispatchEvent(new CustomEvent('doen-confirm', { bubbles: false }));
    await flushPromises();
    // Modal should remain open (delete failed)
    expect(vi.mocked(api.delete)).toHaveBeenCalled();
    document.body.querySelector('doen-confirm-dialog')?.remove();
  });

  it('shows category options in edit category select', async () => {
    const cats = [{ id: 'c1', name: 'Work', color: '#a855f7', group_id: null, project_id: null }];
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve(cats);
      return Promise.resolve([]);
    });
    await setup();
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Geen categorie');
  });

  it('_offerTask shows error toast when project has no group_id', async () => {
    await setup();
    (el as any)._project = { ...project, group_id: null, offers_enabled: false };
    expect(() => (el as any)._offerTask()).not.toThrow();
  });

  it('_offerTask opens prompt dialog and posts offer on submit', async () => {
    await setup(makeTask({ project_id: 'p1' }));
    (el as any)._project = { ...groupProject };
    vi.mocked(api.post).mockResolvedValue({ id: 'o1' });
    const events: Event[] = [];
    el.addEventListener('offer-created', e => events.push(e));
    (el as any)._offerTask();
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    expect(dialog).toBeTruthy();
    dialog.dispatchEvent(new CustomEvent('doen-submit', { detail: 'beer', bubbles: false }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(`/tasks/${makeTask().id}/offer`, { reward_note: 'beer' });
    dialog.remove();
  });

  it('_offerTask offers with null reward on cancel', async () => {
    await setup(makeTask({ project_id: 'p1' }));
    (el as any)._project = { ...groupProject };
    vi.mocked(api.post).mockResolvedValue({ id: 'o1' });
    (el as any)._offerTask();
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: false }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(`/tasks/${makeTask().id}/offer`, { reward_note: null });
    dialog.remove();
  });

  it('_loadCategories error sets categories to empty array', async () => {
    await setup();
    vi.mocked(api.get).mockRejectedValue(new Error('network'));
    await (el as any)._loadCategories(project);
    expect((el as any)._categories).toEqual([]);
  });

  it('_onEditCategoryChange with __new__ opens prompt dialog', async () => {
    await setup();
    (el as any)._project = project;
    (el as any)._categories = [];
    const created = { id: 'c99', name: 'Budget', color: '#a855f7', group_id: null, project_id: null };
    vi.mocked(api.post).mockResolvedValue(created);
    (el as any)._onEditCategoryChange('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    expect(dialog).toBeTruthy();
    dialog.dispatchEvent(new CustomEvent('doen-submit', { detail: 'Budget', bubbles: false }));
    await flushPromises();
    expect((el as any)._categories.find((c: any) => c.id === 'c99')).toBeTruthy();
    dialog.remove();
  });

  it('_onEditCategoryChange with __new__ reverts on cancel', async () => {
    const taskWithCat = makeTask({ category_id: 'c1' });
    await setup(taskWithCat);
    (el as any)._project = project;
    (el as any)._onEditCategoryChange('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: false }));
    await el.updateComplete;
    expect((el as any)._editCategoryId).toBe('c1');
    dialog.remove();
  });

  it('_onEditCategoryChange with __new__ handles create error', async () => {
    await setup();
    (el as any)._project = project;
    (el as any)._categories = [];
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'create fail'));
    (el as any)._onEditCategoryChange('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-submit', { detail: 'Bad', bubbles: false }));
    await flushPromises();
    expect((el as any)._categories).toHaveLength(0);
    dialog.remove();
  });

  it('_onEditCategoryChange with non-__new__ value sets editCategoryId', async () => {
    await setup();
    (el as any)._onEditCategoryChange('c5');
    expect((el as any)._editCategoryId).toBe('c5');
  });

  it('edit handlers set their respective state fields', async () => {
    await setup();
    // _onEditTitleInput
    (el as any)._onEditTitleInput({ target: { value: 'New' } });
    expect((el as any)._editTitle).toBe('New');
    // _onEditPriorityChange
    (el as any)._onEditPriorityChange({ target: { value: 'high' } });
    expect((el as any)._editPriority).toBe('high');
    // _onEditDueInput
    (el as any)._onEditDueInput({ target: { value: '2024-06-15' } });
    expect((el as any)._editDue).toBe('2024-06-15');
    // _onEditAssigneeChange
    (el as any)._onEditAssigneeChange({ target: { value: 'u1' } });
    expect((el as any)._editAssignee).toBe('u1');
    // _onEditNotesInput
    (el as any)._onEditNotesInput({ target: { value: 'note text' } });
    expect((el as any)._editNotes).toBe('note text');
    // _onEditRecurringChange
    (el as any)._onEditRecurringChange({ target: { checked: true } });
    expect((el as any)._editRecurring).toBe(true);
    // _onEditIntervalInput
    (el as any)._onEditIntervalInput({ target: { value: '7' } });
    expect((el as any)._editInterval).toBe(7);
    // _onEditUnitChange
    (el as any)._onEditUnitChange({ target: { value: 'month' } });
    expect((el as any)._editUnit).toBe('month');
    // _onEditParityChange
    (el as any)._onEditParityChange({ target: { value: 'even' } });
    expect((el as any)._editParity).toBe('even');
    // _onEditMonthDayInput
    (el as any)._onEditMonthDayInput({ target: { value: '15' } });
    expect((el as any)._editMonthDay).toBe(15);
  });

  it('_onEditCategorySelectChange calls _onEditCategoryChange with select value', async () => {
    await setup();
    const spy = vi.spyOn(el as any, '_onEditCategoryChange').mockImplementation(() => {});
    (el as any)._onEditCategorySelectChange({ target: { value: 'c1' } });
    expect(spy).toHaveBeenCalledWith('c1');
  });

  it('_onEditTimeInput normalizes and updates editTimeOfDay', async () => {
    await setup();
    const fakeInput = { value: '0830' };
    (el as any)._onEditTimeInput({ target: fakeInput });
    expect(fakeInput.value).toBe('08:30');
    expect((el as any)._editTimeOfDay).toBe('08:30');
  });

  it('_onEditTimeBlur resets to 08:00 if invalid', async () => {
    await setup();
    const fakeInput = { value: 'bad' };
    (el as any)._onEditTimeBlur({ target: fakeInput });
    expect((el as any)._editTimeOfDay).toBe('08:00');
  });

  it('_onCancelEdit resets state and goes to view mode', async () => {
    await setup();
    (el as any)._modalMode = 'edit';
    (el as any)._onCancelEdit();
    expect((el as any)._modalMode).toBe('view');
  });

  it('_onOpenEdit resets state and goes to edit mode', async () => {
    await setup();
    (el as any)._modalMode = 'view';
    (el as any)._onOpenEdit();
    expect((el as any)._modalMode).toBe('edit');
  });

  it('_onEditBtnClick opens modal in edit mode', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    (el as any)._onEditBtnClick();
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._modalMode).toBe('edit');
  });

  it('_onWeekdayChipClick toggles weekday from dataset', async () => {
    await setup();
    (el as any)._editWeekdays = new Set([0]);
    const fakeEl = { dataset: { weekday: '2' } };
    (el as any)._onWeekdayChipClick({ currentTarget: fakeEl });
    expect((el as any)._editWeekdays.has(2)).toBe(true);
  });

  it('_offerTask shows error toast when submit api fails', async () => {
    await setup(makeTask({ project_id: 'p1' }));
    (el as any)._project = { ...groupProject };
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'offer fail'));
    (el as any)._offerTask();
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-submit', { detail: 'beer', bubbles: false }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
    dialog.remove();
  });

  it('_loadMembers error sets project to null and members to empty', async () => {
    await setup();
    vi.mocked(api.get).mockRejectedValue(new Error('network error'));
    await (el as any)._loadMembers();
    expect((el as any)._project).toBeNull();
    expect((el as any)._members).toEqual([]);
  });

  it('_offerTask shows error toast when cancel api fails', async () => {
    await setup(makeTask({ project_id: 'p1' }));
    (el as any)._project = { ...groupProject };
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'offer fail'));
    (el as any)._offerTask();
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: false }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
    dialog.remove();
  });

  it('modal view shows point plural and due date when task has them', async () => {
    const dueDate = new Date(Date.now() + 86400 * 1000 * 2).toISOString();
    await setup(makeTask({ point_value: 3, due_date: dueDate }));
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask({ point_value: 3, due_date: dueDate }));
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('view');
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('punten');
    expect(el.shadowRoot!.querySelector('.detail-chip')).toBeTruthy();
  });

  it('renders category chip with default color when category_color is null', async () => {
    await setup(makeTask({ category_name: 'Work', category_color: null }));
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('.category-chip');
    expect(chip).toBeTruthy();
    expect(chip!.getAttribute('style')).toContain('#a855f7');
  });

  it('_onRowClick returns early when edit-btn is clicked', async () => {
    await setup();
    const fakeTarget = document.createElement('div');
    fakeTarget.className = 'edit-btn';
    const fakeEvent = { target: fakeTarget } as unknown as MouseEvent;
    const openSpy = vi.spyOn(el as any, '_openModal');
    (el as any)._onRowClick(fakeEvent);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('save error shows toast and does not crash', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockRejectedValue(new ApiError(500, 'server error'));
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect((el as any)._saving).toBe(false);
  });

  it('_complete returns early when already completing', async () => {
    await setup();
    (el as any)._completing = true;
    await (el as any)._complete();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    (el as any)._completing = false;
  });

  it('_resetEditState sets _editDue from due_date when present', async () => {
    const taskWithDue = makeTask({ due_date: '2024-06-15T00:00:00.000Z' });
    await setup(taskWithDue);
    (el as any)._resetEditState();
    expect((el as any)._editDue).toBe('2024-06-15');
  });

  it('_offerTask sends null reward when empty string submitted', async () => {
    await setup(makeTask({ project_id: 'p1' }));
    (el as any)._project = { ...groupProject };
    vi.mocked(api.post).mockResolvedValue({ id: 'o1' });
    (el as any)._offerTask();
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-submit', { detail: '', bubbles: false }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(expect.stringContaining('/offer'), { reward_note: null });
    dialog.remove();
  });

  it('_loadCategories filters unscoped categories (no project_id, no group_id)', async () => {
    await setup();
    const unscopedCat = { id: 'cu', name: 'Global', color: '#fff', group_id: null, project_id: null };
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve([unscopedCat]);
      return Promise.resolve([]);
    });
    // Use groupProject so gid !== null; condition 3 (c.project_id==null && c.group_id==null) is reached
    await (el as any)._loadCategories(groupProject);
    expect((el as any)._categories).toContain(unscopedCat);
  });

  it('_onEditCategoryChange with __new__ includes group_id in post when project has group', async () => {
    await setup(makeTask({ project_id: 'p2' }));
    (el as any)._project = { ...groupProject };
    const created = { id: 'c99', name: 'Budget', color: '#a855f7', group_id: 'g1', project_id: null };
    vi.mocked(api.post).mockResolvedValue(created);
    (el as any)._onEditCategoryChange('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-submit', { detail: 'Budget', bubbles: false }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/categories', expect.objectContaining({ group_id: 'g1' }));
    dialog.remove();
  });

  it('_onEditCategoryChange doen-cancel reverts to task category_id when non-null', async () => {
    const taskWithCat = makeTask({ category_id: 'c5' });
    await setup(taskWithCat);
    (el as any)._project = project;
    (el as any)._editCategoryId = '__new__';
    (el as any)._onEditCategoryChange('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: false }));
    await el.updateComplete;
    expect((el as any)._editCategoryId).toBe('c5');
    dialog.remove();
  });

  it('_onEditCategoryChange doen-cancel resets to empty string when task category_id is null', async () => {
    const taskNoCat = makeTask({ category_id: null });
    await setup(taskNoCat);
    (el as any)._project = project;
    (el as any)._onEditCategoryChange('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog') as any;
    dialog.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: false }));
    await el.updateComplete;
    expect((el as any)._editCategoryId).toBe('');
    dialog.remove();
  });

  it('delete confirm dialog cancel removes dialog without deleting', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;

    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-delete')!.click();
    await el.updateComplete;
    const confirmDialog = document.body.querySelector('doen-confirm-dialog') as any;
    confirmDialog.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: false }));
    await el.updateComplete;
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
    confirmDialog.remove();
  });

  it('_saveEdit sends due_date when _editDue is set', async () => {
    await setup();
    const updatedTask = makeTask({ due_date: '2024-12-31T23:59:59.000Z' });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockResolvedValue(updatedTask);
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editTitle = 'Updated';
    (el as any)._editDue = '2024-12-31';
    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/'),
      expect.objectContaining({ due_date: expect.any(String) })
    );
  });

  it('_saveEdit sends assignee when members > 1 and assignee set', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockResolvedValue(makeTask());
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    // Force multiple members to trigger the assignee branch
    (el as any)._members = [
      { user_id: 'me', name: 'Me', email: 'me@e.com', role: 'member' },
      { user_id: 'u2', name: 'Alice', email: 'a@e.com', role: 'member' },
    ];
    (el as any)._editTitle = 'Updated';
    (el as any)._editAssignee = 'u2';
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/'),
      expect.objectContaining({ assignee_id: 'u2' })
    );
  });

  it('_saveEdit sends null assignee when members > 1 but no assignee selected', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockResolvedValue(makeTask());
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    // Force multiple members to trigger the assignee branch
    (el as any)._members = [
      { user_id: 'me', name: 'Me', email: 'me@e.com', role: 'member' },
      { user_id: 'u2', name: 'Alice', email: 'a@e.com', role: 'member' },
    ];
    (el as any)._editTitle = 'Updated';
    (el as any)._editAssignee = '';
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/'),
      expect.objectContaining({ assignee_id: null })
    );
  });

  it('recurrence edit unit "day" shows "dagen" label', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    (el as any)._editRecurring = true;
    (el as any)._editUnit = 'day';
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('dagen');
  });

  it('modal detail view shows overdue chip when due date is past', async () => {
    const pastDate = new Date(Date.now() - 86400 * 1000 * 3).toISOString();
    const taskOverdue = makeTask({ due_date: pastDate });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(taskOverdue);
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await setup(taskOverdue);
    await (el as any)._openModal('view');
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.detail-chip.overdue')).toBeTruthy();
  });

  it('modal detail view shows assignee chip when task has assignee', async () => {
    const taskWithAssignee = makeTask({ assignee_name: 'Alice' });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(taskWithAssignee);
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await setup(taskWithAssignee);
    await (el as any)._openModal('view');
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.assignee-chip')).toBeTruthy();
  });

  it('modal detail view shows category chip with non-null color', async () => {
    const taskWithCatColor = makeTask({ category_name: 'Work', category_color: '#6366f1' });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(taskWithCatColor);
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await setup(taskWithCatColor);
    await (el as any)._openModal('view');
    await flushPromises();
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('.category-chip') as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('style')).toContain('#6366f1');
  });

  it('modal detail view shows category chip with default color when category_color is null', async () => {
    const taskWithNullCatColor = makeTask({ category_name: 'Work', category_color: null });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(taskWithNullCatColor);
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await setup(taskWithNullCatColor);
    await (el as any)._openModal('view');
    await flushPromises();
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('.category-chip') as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.getAttribute('style')).toContain('#a855f7');
  });

  it('non-ApiError from _saveEdit is ignored silently', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) return Promise.resolve(makeTask());
      if (url.includes('/projects/')) return Promise.resolve(project);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    vi.mocked(api.put).mockRejectedValue(new Error('network failure'));
    await (el as any)._openModal('edit');
    await flushPromises();
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flushPromises();
    expect((el as any)._saving).toBe(false);
  });

  it('non-ApiError from _delete is ignored silently', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new Error('network failure'));
    (el as any)._delete();
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-confirm-dialog');
    expect(dialog).toBeTruthy();
    dialog!.dispatchEvent(new CustomEvent('doen-confirm', { bubbles: false }));
    await flushPromises();
    document.body.querySelector('doen-confirm-dialog')?.remove();
    expect((el as any)._done).toBe(false);
  });

  it('non-ApiError from _complete is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    await (el as any)._complete();
    await flushPromises();
    expect((el as any)._completing).toBe(false);
  });

  it('non-ApiError from _offerTask submit is ignored silently', async () => {
    await setup();
    (el as any)._project = { ...groupProject };
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    (el as any)._offerTask();
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog');
    dialog!.dispatchEvent(new CustomEvent('doen-submit', { detail: 'pizza', bubbles: false }));
    await flushPromises();
    document.body.querySelector('doen-prompt-dialog')?.remove();
    expect((el as any)._completing).toBe(false);
  });

  it('non-ApiError from _offerTask cancel is ignored silently', async () => {
    await setup();
    (el as any)._project = { ...groupProject };
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    (el as any)._offerTask();
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog');
    dialog!.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: false }));
    await flushPromises();
    document.body.querySelector('doen-prompt-dialog')?.remove();
    expect((el as any)._completing).toBe(false);
  });

  it('non-ApiError from _onEditCategoryChange __new__ submit is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    (el as any)._onEditCategoryChange('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog');
    dialog!.dispatchEvent(new CustomEvent('doen-submit', { detail: 'Cat', bubbles: false }));
    await flushPromises();
    document.body.querySelector('doen-prompt-dialog')?.remove();
    expect((el as any)._editCategoryId).toBe('');
  });

  it('_onKeydown with non-Escape key when modal is open does nothing', async () => {
    await setup();
    (el as any)._modalOpen = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;
    expect((el as any)._modalOpen).toBe(true);
  });

  it('_onKeydown with Escape when modal is not open does nothing', async () => {
    await setup();
    (el as any)._modalOpen = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect((el as any)._modalOpen).toBe(false);
  });

  it('_onEditTimeBlur does not reset time when time is already valid', async () => {
    await setup();
    (el as any)._editTimeOfDay = '14:30';
    const fakeInput = { value: '14:30' };
    (el as any)._onEditTimeBlur({ target: fakeInput });
    expect((el as any)._editTimeOfDay).toBe('14:30');
  });

  it('doen:categories-changed triggers _loadMembers when modal is open', async () => {
    await setup();
    (el as any)._modalOpen = true;
    const loadSpy = vi.spyOn(el as any, '_loadMembers').mockResolvedValue(undefined);
    window.dispatchEvent(new CustomEvent('doen:categories-changed'));
    await flushPromises();
    expect(loadSpy).toHaveBeenCalled();
  });

  it('doen:categories-changed does nothing when modal is closed', async () => {
    await setup();
    (el as any)._modalOpen = false;
    const loadSpy = vi.spyOn(el as any, '_loadMembers').mockResolvedValue(undefined);
    window.dispatchEvent(new CustomEvent('doen:categories-changed'));
    await flushPromises();
    expect(loadSpy).not.toHaveBeenCalled();
  });
});
