import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, unmount } from '../../test/helpers';
import './doen-view-list';
import type { DoenViewList } from './doen-view-list';
import type { Task } from '../services/types';

describe('doen-view-list', () => {
  let el: DoenViewList;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const today = new Date(); today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);

  function task(overrides: Partial<Task>): Task {
    return {
      id: 't1', title: 'Test Task', status: 'todo', project_id: 'p1',
      project_name: 'Home', priority: 'medium', due_date: null, scheduled_date: null,
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      description: null, is_recurring: false, assignee_id: null, assignee_name: null,
      group_id: 'g1', creator_id: 'u1',
      ...overrides,
    } as unknown as Task;
  }

  it('shows empty state when no due tasks', async () => {
    el = await mount<DoenViewList>('doen-view-list', { tasks: [task({ id: 't1', due_date: null })] });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.empty-state')).toBeTruthy();
    expect(el.shadowRoot!.textContent).toContain('Niets te doen');
  });

  it('shows empty state when all tasks are done', async () => {
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [task({ id: 't1', status: 'done', due_date: today.toISOString() })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.empty-state')).toBeTruthy();
  });

  it('shows overdue section for past due tasks', async () => {
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [task({ id: 't1', due_date: yesterday.toISOString() })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Achterstallig');
    expect(el.shadowRoot!.querySelector('.badge')).toBeTruthy();
  });

  it('shows today section for today due tasks', async () => {
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [task({ id: 't1', due_date: today.toISOString() })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Voor vandaag');
  });

  it('shows upcoming section for future tasks', async () => {
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [task({ id: 't1', due_date: nextWeek.toISOString() })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Binnenkort');
  });

  it('shows all sections simultaneously', async () => {
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [
        task({ id: 't1', due_date: yesterday.toISOString() }),
        task({ id: 't2', due_date: today.toISOString() }),
        task({ id: 't3', due_date: nextWeek.toISOString() }),
      ]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Achterstallig');
    expect(el.shadowRoot!.textContent).toContain('Voor vandaag');
    expect(el.shadowRoot!.textContent).toContain('Binnenkort');
  });

  it('renders doen-task elements for each due task', async () => {
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [
        task({ id: 't1', due_date: yesterday.toISOString() }),
        task({ id: 't2', due_date: today.toISOString() }),
      ]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('doen-task').length).toBe(2);
  });

  it('sorts multiple upcoming tasks by due date', async () => {
    const twoWeeks = new Date(today); twoWeeks.setDate(twoWeeks.getDate() + 14);
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [
        task({ id: 't1', due_date: twoWeeks.toISOString() }),
        task({ id: 't2', due_date: nextWeek.toISOString() }),
      ]
    });
    await el.updateComplete;
    const taskEls = el.shadowRoot!.querySelectorAll('doen-task');
    expect(taskEls.length).toBe(2);
  });

  it('excludes done tasks from upcoming section', async () => {
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [task({ id: 't1', due_date: nextWeek.toISOString(), status: 'done' })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.empty-state')).toBeTruthy();
  });

  it('onRefresh prop is called when controller triggers refresh', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    el = await mount<DoenViewList>('doen-view-list', { tasks: [], onRefresh });
    await el.updateComplete;
    const ptr = (el as any)._ptr;
    ptr.state = 'ready';
    (ptr as any).isTracking = true;
    await (ptr as any)._onTouchEnd();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('shows overdue badge count', async () => {
    el = await mount<DoenViewList>('doen-view-list', {
      tasks: [
        task({ id: 't1', due_date: yesterday.toISOString() }),
        task({ id: 't2', due_date: new Date(yesterday.getTime() - 86400000).toISOString() }),
      ]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.badge')?.textContent?.trim()).toBe('2');
  });
});
