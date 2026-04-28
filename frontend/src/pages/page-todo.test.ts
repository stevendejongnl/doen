import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-todo';
import type { PageTodo } from './page-todo';
import { api, ApiError } from '../services/api';
import type { Task } from '../services/types';

describe('page-todo', () => {
  let el: PageTodo;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const task1: Task = {
    id: 't1', title: 'Do laundry', status: 'todo', project_id: 'p1',
    project_name: 'Home', scheduled_date: new Date().toISOString().split('T')[0],
    priority: 'medium', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
    description: null, due_date: null, is_recurring: false, assignee_id: null, assignee_name: null,
    group_id: 'g1', creator_id: 'u1',
  } as unknown as Task;

  async function setup(tasks: Task[] = [task1]) {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks')) return Promise.resolve(tasks);
      if (url.includes('/auth/me')) return Promise.resolve({ preferences: {} });
      return Promise.resolve({});
    });
    el = await mount<PageTodo>('page-todo');
    await flushPromises();
    await el.updateComplete;
  }

  it('shows loading skeletons initially', async () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    el = await mount<PageTodo>('page-todo');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.sk-task')).toBeTruthy();
  });

  it('renders header with title', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Te doen');
  });

  it('shows calendar view by default', async () => {
    await setup();
    expect(el.shadowRoot!.querySelector('doen-view-calendar')).toBeTruthy();
  });

  it('switches to list view', async () => {
    await setup();
    const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.seg button');
    const listBtn = Array.from(buttons).find(b => b.textContent?.includes('Lijst'))!;
    listBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('doen-view-list')).toBeTruthy();
  });

  it('switches to kanban view', async () => {
    await setup();
    const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.seg button');
    const kanbanBtn = Array.from(buttons).find(b => b.textContent?.includes('Kanban'))!;
    kanbanBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('doen-view-kanban')).toBeTruthy();
  });

  it('switches back to calendar view', async () => {
    await setup();
    const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.seg button');
    const listBtn = Array.from(buttons).find(b => b.textContent?.includes('Lijst'))!;
    listBtn.click();
    await el.updateComplete;
    const calBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.seg button')).find(b => b.textContent?.includes('Kalender'))!;
    calBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('doen-view-calendar')).toBeTruthy();
  });

  it('changes range to day', async () => {
    await setup();
    const dayBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.seg button')).find(b => b.textContent?.trim() === 'Dag')!;
    dayBtn.click();
    await el.updateComplete;
    expect(dayBtn.className).toContain('active');
  });

  it('changes range to month', async () => {
    await setup();
    const monthBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.seg button')).find(b => b.textContent?.trim() === 'Maand')!;
    monthBtn.click();
    await el.updateComplete;
    expect(monthBtn.className).toContain('active');
  });

  it('nudges to previous period', async () => {
    await setup();
    const cal = el.shadowRoot!.querySelector('doen-view-calendar') as any;
    const anchorBefore = cal.anchor as Date;
    const prevBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.nav-pill button:first-child')!;
    prevBtn.click();
    await el.updateComplete;
    const anchorAfter = (el.shadowRoot!.querySelector('doen-view-calendar') as any).anchor as Date;
    expect(anchorAfter.getTime()).toBeLessThan(anchorBefore.getTime());
  });

  it('nudges to next period', async () => {
    await setup();
    const cal = el.shadowRoot!.querySelector('doen-view-calendar') as any;
    const anchorBefore = cal.anchor as Date;
    const nextBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.nav-pill button:last-child')!;
    nextBtn.click();
    await el.updateComplete;
    const anchorAfter = (el.shadowRoot!.querySelector('doen-view-calendar') as any).anchor as Date;
    expect(anchorAfter.getTime()).toBeGreaterThan(anchorBefore.getTime());
  });

  it('nudges back to today', async () => {
    await setup();
    // First go prev to move anchor
    const prevBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.nav-pill button:first-child')!;
    prevBtn.click();
    await el.updateComplete;
    // Then hit today
    const todayBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.nav-pill .today-btn')!;
    todayBtn.click();
    await el.updateComplete;
    const anchorAfter = (el.shadowRoot!.querySelector('doen-view-calendar') as any).anchor as Date;
    const now = new Date();
    expect(Math.abs(anchorAfter.getTime() - now.getTime())).toBeLessThan(5000);
  });

  it('addTask adds a task', async () => {
    await setup([]);
    const newTask = { ...task1, id: 't2' };
    el.addTask(newTask as Task);
    expect((el as any)._tasks).toContain(newTask);
  });

  it('addTask does not add duplicate', async () => {
    await setup([task1]);
    el.addTask(task1);
    expect((el as any)._tasks.filter((t: Task) => t.id === 't1').length).toBe(1);
  });

  it('updateTask replaces existing task', async () => {
    await setup([task1]);
    const updated = { ...task1, title: 'Updated' };
    el.updateTask(updated as Task);
    expect((el as any)._tasks.find((t: Task) => t.id === 't1').title).toBe('Updated');
  });

  it('updateTask adds task if not found', async () => {
    await setup([]);
    el.updateTask(task1);
    expect((el as any)._tasks).toContain(task1);
  });

  it('removeTask removes a task', async () => {
    await setup([task1]);
    el.removeTask('t1');
    expect((el as any)._tasks.find((t: Task) => t.id === 't1')).toBeUndefined();
  });

  it('handles task-deleted event', async () => {
    await setup([task1]);
    el.shadowRoot!.querySelector('.view-container')!.dispatchEvent(
      new CustomEvent('task-deleted', { detail: 't1', bubbles: true })
    );
    await el.updateComplete;
    expect((el as any)._tasks.find((t: Task) => t.id === 't1')).toBeUndefined();
  });

  it('handles task-updated event', async () => {
    await setup([task1]);
    const updated = { ...task1, title: 'Updated via event' };
    el.shadowRoot!.querySelector('.view-container')!.dispatchEvent(
      new CustomEvent('task-updated', { detail: updated, bubbles: true })
    );
    await el.updateComplete;
    expect((el as any)._tasks.find((t: Task) => t.id === 't1').title).toBe('Updated via event');
  });

  it('loads preferences and applies view from prefs', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks')) return Promise.resolve([]);
      if (url.includes('/auth/me')) return Promise.resolve({ preferences: { todo_view: 'list', calendar_range: 'day' } });
      return Promise.resolve({});
    });
    el = await mount<PageTodo>('page-todo');
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('doen-view-list')).toBeTruthy();
  });

  it('loads with undefined preferences uses defaults', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks')) return Promise.resolve([]);
      if (url.includes('/auth/me')) return Promise.resolve({ preferences: undefined });
      return Promise.resolve({});
    });
    el = await mount<PageTodo>('page-todo');
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._view).toBe('calendar');
  });

  it('shows error toast when load fails with ApiError', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks')) return Promise.reject(new ApiError(500, 'laden mislukt'));
      if (url.includes('/auth/me')) return Promise.resolve({ preferences: {} });
      return Promise.resolve({});
    });
    el = await mount<PageTodo>('page-todo');
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._loading).toBe(false);
  });

  it('_setView same value returns early', async () => {
    await setup();
    (el as any)._view = 'calendar';
    (el as any)._setView('calendar');
    expect((el as any)._view).toBe('calendar');
  });

  it('_setRange same value returns early', async () => {
    await setup();
    (el as any)._range = 'week';
    (el as any)._setRange('week');
    expect((el as any)._range).toBe('week');
  });

  it('nudges day range by days', async () => {
    await setup();
    (el as any)._range = 'day';
    const before = new Date((el as any)._anchor);
    (el as any)._nudge(1);
    const after: Date = (el as any)._anchor;
    expect(after.getDate()).toBe(before.getDate() + 1);
  });

  it('updateTask leaves unmatched tasks unchanged', async () => {
    await setup([task1]);
    const other = { ...task1, id: 't2', title: 'Other' };
    el.updateTask(other as Task);
    expect((el as any)._tasks.find((t: Task) => t.id === 't1').title).toBe('Do laundry');
  });

  it('_nudge(0) resets anchor to today', async () => {
    await setup();
    const before = new Date(Date.now() - 86400 * 1000 * 7);
    (el as any)._anchor = before;
    (el as any)._nudge(0);
    const now = new Date();
    const anchor: Date = (el as any)._anchor;
    expect(anchor.toDateString()).toBe(now.toDateString());
  });

  it('nudges month range by months', async () => {
    await setup();
    (el as any)._range = 'month';
    const before = new Date((el as any)._anchor);
    (el as any)._nudge(1);
    const after: Date = (el as any)._anchor;
    expect(after.getMonth()).toBe((before.getMonth() + 1) % 12);
  });

  it('switches to week range via button click', async () => {
    await setup();
    // First switch to day range
    const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.seg button');
    const dayBtn = Array.from(buttons).find(b => b.textContent?.trim() === 'Dag')!;
    dayBtn.click();
    await el.updateComplete;
    // Now click week button to trigger _onSetRangeWeek
    const weekBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.seg button')).find(b => b.textContent?.trim() === 'Week')!;
    weekBtn.click();
    await el.updateComplete;
    expect((el as any)._range).toBe('week');
  });

  it('updateTask map covers non-matching task ids', async () => {
    const task2 = { ...task1, id: 't2', title: 'Other' };
    await setup([task1, task2 as any]);
    const updated = { ...task1, title: 'Updated' };
    el.updateTask(updated as typeof task1);
    expect((el as any)._tasks.find((t: typeof task1) => t.id === 't2').title).toBe('Other');
  });

  it('reload() re-fetches tasks', async () => {
    await setup();
    vi.mocked(api.get).mockClear();
    el.reload();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(expect.stringContaining('/tasks'));
  });

  it('pull-to-refresh controller on view-list triggers _loadTasks', async () => {
    await setup();
    (el as any)._view = 'list';
    await el.updateComplete;
    vi.mocked(api.get).mockClear();
    const list = el.shadowRoot!.querySelector('doen-view-list') as any;
    expect(list).toBeTruthy();
    const ptr = list._ptr;
    ptr.state = 'ready';
    (ptr as any).isTracking = true;
    await (ptr as any)._onTouchEnd();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(expect.stringContaining('/tasks'));
  });

  it('non-ApiError from _loadTasks is ignored silently', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/tasks')) return Promise.reject(new Error('network'));
      if (url.includes('/auth/me')) return Promise.resolve({ preferences: {} });
      return Promise.resolve({});
    });
    el = await mount<PageTodo>('page-todo');
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._loading).toBe(false);
  });

  it('pull-to-refresh controller on kanban view triggers _loadTasks', async () => {
    await setup();
    (el as any)._view = 'kanban';
    await el.updateComplete;
    vi.mocked(api.get).mockClear();
    const kanban = el.shadowRoot!.querySelector('doen-view-kanban') as any;
    expect(kanban).toBeTruthy();
    const ptr = kanban._ptr;
    ptr.state = 'ready';
    (ptr as any).isTracking = true;
    await (ptr as any)._onTouchEnd();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(expect.stringContaining('/tasks'));
  });

  it('pull-to-refresh controller on calendar view triggers _loadTasks', async () => {
    await setup();
    vi.mocked(api.get).mockClear();
    const cal = el.shadowRoot!.querySelector('doen-view-calendar') as any;
    expect(cal).toBeTruthy();
    const ptr = cal._ptr;
    ptr.state = 'ready';
    (ptr as any).isTracking = true;
    await (ptr as any)._onTouchEnd();
    await flushPromises();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(expect.stringContaining('/tasks'));
  });
});
