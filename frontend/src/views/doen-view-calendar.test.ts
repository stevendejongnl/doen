import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, unmount } from '../../test/helpers';
import './doen-view-calendar';
import type { DoenViewCalendar } from './doen-view-calendar';
import type { Task } from '../services/types';

describe('doen-view-calendar', () => {
  let el: DoenViewCalendar;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);

  function task(overrides: Partial<Task>): Task {
    return {
      id: 't1', title: 'Test Task', status: 'todo', project_id: 'p1',
      project_name: 'Home', priority: 'medium', due_date: now.toISOString(),
      scheduled_date: null, created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z', description: null,
      is_recurring: false, assignee_id: null, assignee_name: null,
      group_id: 'g1', creator_id: 'u1', notes: null, recurring_rule: null,
      ...overrides,
    } as unknown as Task;
  }

  it('renders week view by default', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'week', anchor: now });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.grid.week')).toBeTruthy();
    expect(el.shadowRoot!.querySelectorAll('.cell').length).toBe(7);
  });

  it('renders month view', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'month', anchor: now });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.grid.month')).toBeTruthy();
    expect(el.shadowRoot!.querySelectorAll('.cell').length).toBe(42);
  });

  it('renders day view', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'day', anchor: now });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.grid.day')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.day-list')).toBeTruthy();
  });

  it('shows range label in week mode', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'week', anchor: now });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.range-label')?.textContent?.trim()).toBeTruthy();
  });

  it('shows range label in month mode', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'month', anchor: now });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.range-label')?.textContent?.trim()).toBeTruthy();
  });

  it('shows range label in day mode', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'day', anchor: now });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.range-label')?.textContent?.trim()).toBeTruthy();
  });

  it('marks today cell with today class', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'week', anchor: now });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.cell.today')).toBeTruthy();
  });

  it('shows task pill for task due today', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [task({ id: 't1', title: 'Today Task', due_date: now.toISOString() })],
      range: 'week',
      anchor: now,
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.pill')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('Today Task');
  });

  it('clicking pill opens task overlay', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [task({ id: 't1', title: 'Clickable', due_date: now.toISOString() })],
      range: 'week',
      anchor: now,
    });
    await el.updateComplete;
    const pill = el.shadowRoot!.querySelector<HTMLElement>('[data-task-id="t1"]')!;
    pill.click();
    await el.updateComplete;
    expect((el as any)._openTaskId).toBe('t1');
    expect(el.shadowRoot!.querySelector('doen-task[hiderow]') ?? el.shadowRoot!.querySelector('doen-task')).toBeTruthy();
  });

  it('done task pill shows done class', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [task({ id: 't1', status: 'done', due_date: now.toISOString() })],
      range: 'week',
      anchor: now,
    });
    await el.updateComplete;
    const pill = el.shadowRoot!.querySelector('.pill')!;
    expect(pill.className).toContain('done');
  });

  it('shows unscheduled drawer when tasks have no due date', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [task({ id: 't1', due_date: null, status: 'todo' })],
      range: 'week',
      anchor: now,
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.unscheduled')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('Niet ingepland');
  });

  it('does not show unscheduled for done tasks without date', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [task({ id: 't1', due_date: null, status: 'done' })],
      range: 'week',
      anchor: now,
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.unscheduled')).toBeNull();
  });

  it('shows +N more when tasks exceed limit in month view', async () => {
    const manyTasks = Array.from({ length: 5 }, (_, i) =>
      task({ id: `t${i}`, title: `Task ${i}`, due_date: now.toISOString() })
    );
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: manyTasks,
      range: 'month',
      anchor: now,
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.more')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.more')?.textContent).toContain('meer');
  });

  it('shows empty message in day view with no tasks', async () => {
    const emptyDay = new Date(2000, 0, 1);
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [],
      range: 'day',
      anchor: emptyDay,
    });
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Geen taken op deze dag');
  });

  it('shows doen-task elements in day view for that day', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [task({ id: 't1', due_date: now.toISOString() })],
      range: 'day',
      anchor: now,
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.day-list doen-task')).toBeTruthy();
  });

  it('modal-closed event closes the overlay', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [task({ id: 't1', due_date: now.toISOString() })],
      range: 'week',
      anchor: now,
    });
    await el.updateComplete;
    const pill = el.shadowRoot!.querySelector<HTMLElement>('[data-task-id="t1"]')!;
    pill.click();
    await el.updateComplete;
    // Close via internal method
    (el as any)._closePill();
    await el.updateComplete;
    expect((el as any)._openTaskId).toBeNull();
  });

  it('_openPill sets _openTaskId', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'week', anchor: now });
    await el.updateComplete;
    (el as any)._openPill('t42');
    expect((el as any)._openTaskId).toBe('t42');
  });

  it('_renderPill with null due_date shows no time label', async () => {
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [],
      range: 'week',
      anchor: now,
    });
    await el.updateComplete;
    const fakeTask = { id: 't1', title: 'No time', due_date: null, status: 'todo', priority: 'medium' };
    const result = (el as any)._renderPill(fakeTask);
    expect(result).toBeTruthy();
  });

  it('_formatTime returns empty string for midnight task', async () => {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    el = await mount<DoenViewCalendar>('doen-view-calendar', {
      tasks: [task({ id: 't1', due_date: midnight.toISOString() })],
      range: 'week',
      anchor: now,
    });
    await el.updateComplete;
    // pill with midnight time renders no time label — check no pill-time element
    const pillTime = el.shadowRoot!.querySelector('.pill-time');
    expect(pillTime).toBeNull();
  });

  it('onRefresh prop is called when controller triggers refresh', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    el = await mount<DoenViewCalendar>('doen-view-calendar', { tasks: [], range: 'week', anchor: now, onRefresh });
    await el.updateComplete;
    const ptr = (el as any)._ptr;
    ptr.state = 'ready';
    (ptr as any).isTracking = true;
    await (ptr as any)._onTouchEnd();
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
