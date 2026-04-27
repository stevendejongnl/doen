import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './doen-task-form';
import type { DoenTaskForm } from './doen-task-form';
import { api } from '../services/api';
import type { Task } from '../services/types';

describe('doen-task-form', () => {
  let el: DoenTaskForm;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const project = { id: 'p1', name: 'Test Project', color: '#6366f1', group_id: null, offers_enabled: false };
  const groupProject = { id: 'p2', name: 'Group Project', color: '#10b981', group_id: 'g1', offers_enabled: true };

  async function setup(proj = project) {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes('/members')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el = await mount<DoenTaskForm>('doen-task-form', { project: proj });
    await flushPromises();
    await el.updateComplete;
  }

  function getInput(): HTMLElement | null {
    return el.shadowRoot!.querySelector('doen-input[aria-label="Nieuwe taak toevoegen"]');
  }

  it('renders form with task input', async () => {
    await setup();
    expect(el.shadowRoot!.querySelector('form')).toBeTruthy();
    expect(getInput()).toBeTruthy();
  });

  it('submit button disabled when title is empty', async () => {
    await setup();
    const btn = el.shadowRoot!.querySelector('doen-button') as any;
    expect(btn?.disabled).toBe(true);
  });

  it('creates a task on form submit', async () => {
    await setup();
    const newTask = { id: 't1', title: 'My Task', status: 'todo', project_id: 'p1' } as unknown as Task;
    vi.mocked(api.post).mockResolvedValue(newTask);

    const events: CustomEvent[] = [];
    el.addEventListener('task-created', e => events.push(e as CustomEvent));

    // Set title via internal state (since doen-input is a shadow DOM component)
    (el as any)._title = 'My Task';
    await el.updateComplete;

    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;

    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/projects/p1/tasks', expect.objectContaining({ title: 'My Task' }));
    expect(events[0]?.detail).toEqual(newTask);
  });

  it('clears form after successful submit', async () => {
    await setup();
    vi.mocked(api.post).mockResolvedValue({ id: 't1', title: 'Done', status: 'todo' } as unknown as Task);
    (el as any)._title = 'My Task';
    (el as any)._priority = 'high';
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._title).toBe('');
    expect((el as any)._priority).toBe('none');
  });

  it('shows notes textarea when notes toggle clicked', async () => {
    await setup();
    const notesBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-notes-toggle')!;
    notesBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('doen-textarea')).toBeTruthy();
  });

  it('hides notes textarea after second toggle click', async () => {
    await setup();
    const notesBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-notes-toggle')!;
    notesBtn.click();
    await el.updateComplete;
    notesBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('doen-textarea')).toBeNull();
  });

  it('shows recurring checkbox', async () => {
    await setup();
    expect(el.shadowRoot!.querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  it('shows recurring builder when checkbox checked', async () => {
    await setup();
    (el as any)._recurring = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.recurrence-builder')).toBeTruthy();
  });

  it('shows weekday chips in week mode', async () => {
    await setup();
    (el as any)._recurring = true;
    (el as any)._unit = 'week';
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelectorAll('[data-weekday]');
    expect(chips.length).toBe(7);
  });

  it('toggles weekday chip', async () => {
    await setup();
    (el as any)._recurring = true;
    (el as any)._unit = 'week';
    await el.updateComplete;
    const mondayChip = el.shadowRoot!.querySelector<HTMLElement>('[data-weekday="0"]')!;
    mondayChip.click();
    await el.updateComplete;
    // Monday was in the set (default), clicking removes it
    expect((el as any)._weekdays.has(0)).toBe(false);
  });

  it('shows month day input in month mode', async () => {
    await setup();
    (el as any)._recurring = true;
    (el as any)._unit = 'month';
    await el.updateComplete;
    const monthDayInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="number"]');
    expect(monthDayInput).toBeTruthy();
  });

  it('creates recurring rule after task creation', async () => {
    await setup();
    const newTask = { id: 't1', title: 'Recurring', status: 'todo', project_id: 'p1' } as unknown as Task;
    vi.mocked(api.post).mockResolvedValueOnce(newTask).mockResolvedValueOnce({});
    vi.mocked(api.get).mockResolvedValue(newTask);
    (el as any)._title = 'Recurring';
    (el as any)._recurring = true;
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenNthCalledWith(2, '/tasks/t1/recurring', expect.objectContaining({ unit: 'week' }));
  });

  it('does not submit with empty title', async () => {
    await setup();
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('loads categories on connect', async () => {
    const cats = [{ id: 'c1', name: 'Work', color: '#6366f1', group_id: null, project_id: null }];
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve(cats);
      if (url.includes('/members')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el = await mount<DoenTaskForm>('doen-task-form', { project });
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._categories).toContain(cats[0]);
  });

  it('loads members for group projects', async () => {
    const members = [{ user_id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'member' }];
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes('/members')) return Promise.resolve(members);
      return Promise.resolve([]);
    });
    el = await mount<DoenTaskForm>('doen-task-form', { project: groupProject });
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._members.length).toBeGreaterThan(0);
  });

  it('shows time of day input in recurring mode', async () => {
    await setup();
    (el as any)._recurring = true;
    await el.updateComplete;
    const timeInput = el.shadowRoot!.querySelector<HTMLInputElement>('input[aria-label="Tijd in 24-uurs notatie"]');
    expect(timeInput).toBeTruthy();
  });

  it('shows assignee select when multiple members', async () => {
    const members = [
      { user_id: 'u1', name: 'Alice', email: 'a@example.com', role: 'member' },
      { user_id: 'u2', name: 'Bob', email: 'b@example.com', role: 'member' },
    ];
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes('/members')) return Promise.resolve(members);
      return Promise.resolve([]);
    });
    el = await mount<DoenTaskForm>('doen-task-form', { project: groupProject });
    await flushPromises();
    await el.updateComplete;
    // doen-select is rendered when >1 members; its options live inside its shadow DOM
    const assigneeSelect = el.shadowRoot!.querySelector('doen-select[aria-label="Toegewezen aan"]');
    expect(assigneeSelect).toBeTruthy();
  });

  it('sets category on category change', async () => {
    await setup();
    (el as any)._onCategoryChange_impl('cat1');
    expect((el as any)._categoryId).toBe('cat1');
  });

  it('_onCategoryChange_impl creates new category via dialog', async () => {
    await setup();
    const newCat = { id: 'cat2', name: 'New Cat', color: '#a855f7', group_id: null, project_id: null };
    vi.mocked(api.post).mockResolvedValue(newCat);
    (el as any)._onCategoryChange_impl('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog');
    expect(dialog).toBeTruthy();
    dialog!.dispatchEvent(new CustomEvent('doen-submit', { detail: 'New Cat', bubbles: false }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/categories', expect.objectContaining({ name: 'New Cat' }));
    expect((el as any)._categoryId).toBe('cat2');
    document.body.querySelector('doen-prompt-dialog')?.remove();
  });

  it('_onCategoryChange_impl cancel resets categoryId', async () => {
    await setup();
    (el as any)._categoryId = 'old';
    (el as any)._onCategoryChange_impl('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog');
    dialog!.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: false }));
    await el.updateComplete;
    expect((el as any)._categoryId).toBe('');
    document.body.querySelector('doen-prompt-dialog')?.remove();
  });

  it('_onTimeInput normalizes time and updates value', async () => {
    await setup();
    const fakeInput = { value: '0830' };
    const fakeEvent = { target: fakeInput } as unknown as Event;
    (el as any)._onTimeInput(fakeEvent);
    expect(fakeInput.value).toBe('08:30');
    expect((el as any)._timeOfDay).toBe('08:30');
  });

  it('_onTimeBlur resets to 08:00 if invalid time', async () => {
    await setup();
    const fakeInput = { value: 'bad' };
    const fakeEvent = { target: fakeInput } as unknown as Event;
    (el as any)._onTimeBlur(fakeEvent);
    expect((el as any)._timeOfDay).toBe('08:00');
  });

  it('_onTimeBlur keeps valid time unchanged', async () => {
    await setup();
    (el as any)._timeOfDay = '14:30';
    const fakeInput = { value: '14:30' };
    const fakeEvent = { target: fakeInput } as unknown as Event;
    (el as any)._onTimeBlur(fakeEvent);
    expect((el as any)._timeOfDay).toBe('14:30');
  });

  it('_onCategoryChange calls _onCategoryChange_impl with detail value', async () => {
    await setup();
    const spy = vi.spyOn(el as any, '_onCategoryChange_impl');
    const fakeEvent = new CustomEvent('doen-input', { detail: { value: 'cat1' } });
    (el as any)._onCategoryChange(fakeEvent);
    expect(spy).toHaveBeenCalledWith('cat1');
  });

  it('submit error shows toast and does not crash', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new (await import('../services/api')).ApiError(500, 'fail'));
    (el as any)._title = 'Error Task';
    await el.updateComplete;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect((el as any)._submitting).toBe(false);
  });

  it('_onPriorityChange sets _priority', async () => {
    await setup();
    const e = new CustomEvent('doen-input', { detail: { value: 'high' } });
    (el as any)._onPriorityChange(e);
    expect((el as any)._priority).toBe('high');
  });

  it('_onDueDateChange sets _dueDate', async () => {
    await setup();
    const e = new CustomEvent('doen-input', { detail: { value: '2024-06-15' } });
    (el as any)._onDueDateChange(e);
    expect((el as any)._dueDate).toBe('2024-06-15');
  });

  it('_onAssigneeChange sets _assigneeId', async () => {
    await setup();
    const e = new CustomEvent('doen-input', { detail: { value: 'u1' } });
    (el as any)._onAssigneeChange(e);
    expect((el as any)._assigneeId).toBe('u1');
  });

  it('_onNotesInput sets _notes', async () => {
    await setup();
    const e = new CustomEvent('doen-input', { detail: { value: 'some notes' } });
    (el as any)._onNotesInput(e);
    expect((el as any)._notes).toBe('some notes');
  });

  it('_onRecurringChange toggles _recurring', async () => {
    await setup();
    const fakeInput = { checked: true };
    const e = { target: fakeInput } as unknown as Event;
    (el as any)._onRecurringChange(e);
    expect((el as any)._recurring).toBe(true);
  });

  it('_onIntervalInput sets _interval with clamping', async () => {
    await setup();
    const fakeInput = { value: '5' };
    const e = { target: fakeInput } as unknown as Event;
    (el as any)._onIntervalInput(e);
    expect((el as any)._interval).toBe(5);
  });

  it('_onUnitChange sets _unit', async () => {
    await setup();
    const fakeSelect = { value: 'week' };
    const e = { target: fakeSelect } as unknown as Event;
    (el as any)._onUnitChange(e);
    expect((el as any)._unit).toBe('week');
  });

  it('_onMonthDayInput sets _monthDay with clamping', async () => {
    await setup();
    const fakeInput = { value: '15' };
    const e = { target: fakeInput } as unknown as Event;
    (el as any)._onMonthDayInput(e);
    expect((el as any)._monthDay).toBe(15);
  });

  it('_onParityChange sets _parity', async () => {
    await setup();
    const fakeSelect = { value: 'odd' };
    const e = { target: fakeSelect } as unknown as Event;
    (el as any)._onParityChange(e);
    expect((el as any)._parity).toBe('odd');
  });

  it('_onToggleNotes toggles _showNotes', async () => {
    await setup();
    const before = (el as any)._showNotes;
    (el as any)._onToggleNotes();
    expect((el as any)._showNotes).toBe(!before);
  });

  it('_onWeekdayChipClick toggles weekday from dataset', async () => {
    await setup();
    (el as any)._recurring = true;
    await el.updateComplete;
    const fakeEl = { dataset: { weekday: '2' } };
    const e = { currentTarget: fakeEl } as unknown as Event;
    (el as any)._onWeekdayChipClick(e);
    expect((el as any)._weekdays.has(2)).toBe(true);
  });

  it('_onTitleInput sets _title', async () => {
    await setup();
    const e = new CustomEvent('doen-input', { detail: { value: 'New Title' } });
    (el as any)._onTitleInput(e);
    expect((el as any)._title).toBe('New Title');
  });

  it('_onCategoryChange_impl shows error toast when create category fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new (await import('../services/api')).ApiError(400, 'bad'));
    (el as any)._onCategoryChange_impl('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog');
    dialog!.dispatchEvent(new CustomEvent('doen-submit', { detail: 'BadCat', bubbles: false }));
    await flushPromises();
    expect((el as any)._categoryId).toBe('');
    document.body.querySelector('doen-prompt-dialog')?.remove();
  });

  it('_maybeLoadCategories error sets categories to empty array', async () => {
    await setup();
    vi.mocked(api.get).mockRejectedValue(new Error('fail'));
    (el as any)._loadedCategoriesFor = null; // reset so it will try to load
    await (el as any)._maybeLoadCategories();
    expect((el as any)._categories).toEqual([]);
  });

  it('_maybeLoadMembers error sets members to empty array', async () => {
    await setup(groupProject);
    vi.mocked(api.get).mockRejectedValue(new Error('members fail'));
    (el as any)._loadedForGroup = null;
    await (el as any)._maybeLoadMembers();
    await flushPromises();
    expect((el as any)._members).toEqual([]);
  });

  it('_maybeLoadMembers returns early when already loaded for same group', async () => {
    await setup(groupProject);
    vi.mocked(api.get).mockResolvedValue([]);
    (el as any)._loadedForGroup = 'g1';
    const callsBefore = vi.mocked(api.get).mock.calls.length;
    await (el as any)._maybeLoadMembers();
    expect(vi.mocked(api.get).mock.calls.length).toBe(callsBefore);
  });

  it('renders "dagen" label when unit is day', async () => {
    await setup();
    (el as any)._recurring = true;
    (el as any)._unit = 'day';
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('dagen');
  });

  it('weekdays is null and month_day is null when unit is day during submit', async () => {
    await setup();
    const newTask = { id: 't1', title: 'Recurring', status: 'todo', project_id: 'p1' } as unknown as Task;
    vi.mocked(api.post).mockResolvedValueOnce(newTask).mockResolvedValueOnce({} as never);
    vi.mocked(api.get).mockResolvedValue(newTask as any);
    (el as any)._title = 'Recurring';
    (el as any)._recurring = true;
    (el as any)._unit = 'day';
    (el as any)._interval = 1;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(
      expect.stringContaining('/recurring'),
      expect.objectContaining({ weekdays: null, month_day: null })
    );
  });

  it('month_day is set when unit is month during submit', async () => {
    await setup();
    const newTask = { id: 't1', title: 'Monthly', status: 'todo', project_id: 'p1' } as unknown as Task;
    vi.mocked(api.post).mockResolvedValueOnce(newTask).mockResolvedValueOnce({} as never);
    vi.mocked(api.get).mockResolvedValue(newTask as any);
    (el as any)._title = 'Monthly';
    (el as any)._recurring = true;
    (el as any)._unit = 'month';
    (el as any)._monthDay = 15;
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith(
      expect.stringContaining('/recurring'),
      expect.objectContaining({ weekdays: null, month_day: 15 })
    );
  });

  it('_onCategoryChange_impl creates new category with group_id for group project', async () => {
    await setup(groupProject);
    const newCat = { id: 'cat3', name: 'Group Cat', color: '#a855f7', group_id: 'g1', project_id: null };
    vi.mocked(api.post).mockResolvedValue(newCat);
    (el as any)._onCategoryChange_impl('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog');
    expect(dialog).toBeTruthy();
    dialog!.dispatchEvent(new CustomEvent('doen-submit', { detail: 'Group Cat', bubbles: false }));
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/categories', expect.objectContaining({ group_id: 'g1' }));
    expect((el as any)._categoryId).toBe('cat3');
    document.body.querySelector('doen-prompt-dialog')?.remove();
  });

  it('_maybeLoadCategories includes unscoped categories (both project_id and group_id null)', async () => {
    await setup(groupProject);
    const unscoped = { id: 'cu1', name: 'Global Cat', color: '#fff', project_id: null, group_id: null };
    const groupScoped = { id: 'cg1', name: 'Group Cat', color: '#aaa', project_id: null, group_id: 'g1' };
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/categories') return Promise.resolve([unscoped, groupScoped]);
      return Promise.resolve([]);
    });
    (el as any)._loadedCategoriesFor = null;
    await (el as any)._maybeLoadCategories();
    await flushPromises();
    expect((el as any)._categories.map((c: any) => c.id)).toContain('cu1');
    expect((el as any)._categories.map((c: any) => c.id)).toContain('cg1');
  });

  it('non-ApiError from _onCategoryChange_impl __new__ submit is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    (el as any)._onCategoryChange_impl('__new__');
    await el.updateComplete;
    const dialog = document.body.querySelector('doen-prompt-dialog');
    expect(dialog).toBeTruthy();
    dialog!.dispatchEvent(new CustomEvent('doen-submit', { detail: 'Cat', bubbles: false }));
    await flushPromises();
    document.body.querySelector('doen-prompt-dialog')?.remove();
    expect((el as any)._categoryId).toBe('');
  });

  it('non-ApiError from _submitForm is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    (el as any)._title = 'Test';
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect((el as any)._submitting).toBe(false);
  });
});
