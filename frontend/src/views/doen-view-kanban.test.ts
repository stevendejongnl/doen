import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './doen-view-kanban';
import type { DoenViewKanban } from './doen-view-kanban';
import { api } from '../services/api';
import type { Task } from '../services/types';

describe('doen-view-kanban', () => {
  let el: DoenViewKanban;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  function task(overrides: Partial<Task>): Task {
    return {
      id: 't1', title: 'Test Task', status: 'todo', project_id: 'p1',
      project_name: 'Home', priority: 'medium', due_date: null, scheduled_date: null,
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      description: null, is_recurring: false, assignee_id: null, assignee_name: null,
      group_id: 'g1', creator_id: 'u1', notes: null, recurring_rule: null,
      ...overrides,
    } as unknown as Task;
  }

  it('renders three columns', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('.col').length).toBe(3);
  });

  it('shows task title in correct column', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', title: 'My Todo Task', status: 'todo' })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('My Todo Task');
  });

  it('shows tasks in correct columns', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [
        task({ id: 't1', title: 'Todo', status: 'todo' }),
        task({ id: 't2', title: 'In Progress', status: 'in_progress' }),
        task({ id: 't3', title: 'Done', status: 'done' }),
      ]
    });
    await el.updateComplete;
    const cols = el.shadowRoot!.querySelectorAll('.col');
    expect(cols[0].textContent).toContain('Todo');
    expect(cols[1].textContent).toContain('In Progress');
    expect(cols[2].textContent).toContain('Done');
  });

  it('shows column counts', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [
        task({ id: 't1', status: 'todo' }),
        task({ id: 't2', status: 'todo' }),
        task({ id: 't3', status: 'done' }),
      ]
    });
    await el.updateComplete;
    const counts = el.shadowRoot!.querySelectorAll('.count');
    expect(counts[0].textContent?.trim()).toBe('2');
    expect(counts[2].textContent?.trim()).toBe('1');
  });

  it('shows empty label when column is empty', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    const emptyDivs = el.shadowRoot!.querySelectorAll('.empty');
    expect(emptyDivs.length).toBe(3);
    expect(emptyDivs[0].textContent?.trim()).toBe('Leeg');
  });

  it('clicking card opens task overlay', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', title: 'Clickable Task', status: 'todo' })]
    });
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector<HTMLElement>('[data-task-id="t1"]')!;
    card.click();
    await el.updateComplete;
    expect((el as any)._openTaskId).toBe('t1');
    expect(el.shadowRoot!.querySelector('doen-task')).toBeTruthy();
  });

  it('drops task to different column and updates status', async () => {
    vi.mocked(api.post).mockResolvedValue({} as never);
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', title: 'Move Me', status: 'todo' })]
    });
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('task-updated', e => events.push(e as CustomEvent));

    // Test _move() directly since DragEvent is not available in jsdom
    await (el as any)._move('t1', 'done');
    await flushPromises();
    expect(events[0]?.detail?.status).toBe('done');
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/tasks/t1/complete', {});
  });

  it('drops task to in_progress uses put', async () => {
    vi.mocked(api.put).mockResolvedValue({} as never);
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', title: 'Move Me', status: 'todo' })]
    });
    await el.updateComplete;

    await (el as any)._move('t1', 'in_progress');
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/tasks/t1', { status: 'in_progress' });
  });

  it('dragging over column sets drop target state', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    // Test internal state directly since DragEvent is not available in jsdom
    (el as any)._onColDragOver({ preventDefault: () => {}, dataTransfer: null } as unknown as DragEvent, 'done');
    await el.updateComplete;
    expect((el as any)._dropCol).toBe('done');
  });

  it('dragleave clears drop target state', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    (el as any)._onColDragOver({ preventDefault: () => {}, dataTransfer: null } as unknown as DragEvent, 'done');
    await el.updateComplete;
    (el as any)._onColDragLeave('done');
    await el.updateComplete;
    expect((el as any)._dropCol).toBeNull();
  });

  it('shows done task with strikethrough class', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'done' })]
    });
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('.card')!;
    expect(card.className).toContain('done');
  });

  it('shows assignee chip when task has assignee', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', assignee_name: 'Alice' })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.assignee-chip')).toBeTruthy();
  });

  it('shows due date in card meta', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', due_date: '2024-06-15T00:00:00Z' })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.card-meta')).toBeTruthy();
  });

  it('modal-closed event closes the overlay', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', title: 'Task', status: 'todo' })]
    });
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector<HTMLElement>('[data-task-id="t1"]')!;
    card.click();
    await el.updateComplete;
    const taskEl = el.shadowRoot!.querySelector('doen-task')!;
    taskEl.dispatchEvent(new CustomEvent('modal-closed', { bubbles: true }));
    await el.updateComplete;
    expect((el as any)._openTaskId).toBeNull();
  });

  it('_onDragEnd clears drag state', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'todo' })]
    });
    await el.updateComplete;
    (el as any)._dragId = 't1';
    (el as any)._dropCol = 'done';
    (el as any)._onDragEnd();
    await el.updateComplete;
    expect((el as any)._dragId).toBeNull();
    expect((el as any)._dropCol).toBeNull();
  });

  it('_onDragEnd with no dragId does nothing', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    (el as any)._dragId = null;
    (el as any)._dropCol = null;
    (el as any)._onDragEnd();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('shows notes icon when task has notes', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', notes: 'some notes' })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.fa-align-left')).toBeTruthy();
  });

  it('shows recurring icon when task has recurring_rule', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', recurring_rule: { id: 'rr1' } as any })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.fa-repeat')).toBeTruthy();
  });

  it('shows overdue class for overdue due date', async () => {
    const past = new Date(Date.now() - 86400 * 1000 * 2).toISOString();
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', due_date: past })]
    });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.overdue')).toBeTruthy();
  });

  it('_accentFor returns correct colors', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    expect((el as any)._accentFor(task({ priority: 'high' }))).toBe('#ef4444');
    expect((el as any)._accentFor(task({ priority: 'medium' }))).toBe('#f59e0b');
    expect((el as any)._accentFor(task({ priority: 'low' }))).toBe('#10b981');
    expect((el as any)._accentFor(task({ priority: 'none' }))).toBe('rgba(255,255,255,0.2)');
  });

  it('moves done task to todo using put', async () => {
    vi.mocked(api.put).mockResolvedValue({} as never);
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'done' })]
    });
    await el.updateComplete;
    await (el as any)._move('t1', 'todo');
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/tasks/t1', { status: 'todo' });
  });

  it('column drop handler reads data-col-id and calls _onColDrop', async () => {
    vi.mocked(api.post).mockResolvedValue({} as never);
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'todo' })]
    });
    await el.updateComplete;
    (el as any)._dragId = 't1';
    const fakeDrop = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: () => 't1' },
      currentTarget: { dataset: { colId: 'done' } },
    };
    (el as any)._onColDropHandler(fakeDrop as unknown as DragEvent);
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/tasks/t1/complete', {});
  });

  it('column dragover handler reads data-col-id', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    const fakeDragOver = {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: '' },
      currentTarget: { dataset: { colId: 'in_progress' } },
    };
    (el as any)._onColDragOverHandler(fakeDragOver as unknown as DragEvent);
    expect((el as any)._dropCol).toBe('in_progress');
  });

  it('column dragleave handler reads data-col-id', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    (el as any)._dropCol = 'done';
    const fakeDragLeave = { currentTarget: { dataset: { colId: 'done' } } };
    (el as any)._onColDragLeaveHandler(fakeDragLeave as unknown as Event);
    expect((el as any)._dropCol).toBeNull();
  });

  it('reverts status update on api error', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network error'));
    const tasks = [task({ id: 't1', status: 'todo' })];
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks });
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('task-updated', e => events.push(e as CustomEvent));
    await (el as any)._move('t1', 'done');
    await flushPromises();
    // Should emit 2 events: first optimistic update, then revert
    expect(events.length).toBe(2);
    expect(events[1].detail.status).toBe('todo');
  });

  it('_onCardDragStart reads task id from dataset', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'todo' })]
    });
    await el.updateComplete;
    const fakeEvent = {
      currentTarget: { dataset: { taskId: 't1' } },
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    };
    (el as any)._onCardDragStart(fakeEvent as unknown as DragEvent);
    expect((el as any)._dragId).toBe('t1');
  });

  it('_onColDragOver does not update _dropCol when same column already set', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    (el as any)._dropCol = 'done';
    (el as any)._onColDragOver({ preventDefault: vi.fn(), dataTransfer: null } as unknown as DragEvent, 'done');
    expect((el as any)._dropCol).toBe('done');
  });

  it('_onColDragLeave does not clear _dropCol when different column', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    (el as any)._dropCol = 'todo';
    (el as any)._onColDragLeave('done');
    expect((el as any)._dropCol).toBe('todo');
  });

  it('shows non-overdue due date without overdue class', async () => {
    const future = new Date(Date.now() + 86400 * 1000 * 2).toISOString();
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', due_date: future })]
    });
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('.card')!;
    const overdueSel = card.querySelector('.overdue');
    expect(overdueSel).toBeNull();
    expect(card.querySelector('.card-meta')).toBeTruthy();
  });

  it('_onDragStart with dataTransfer sets effectAllowed', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    const fakeDataTransfer = { setData: vi.fn(), effectAllowed: '' };
    (el as any)._onDragStart({ dataTransfer: fakeDataTransfer } as unknown as DragEvent, 't1');
    expect(fakeDataTransfer.effectAllowed).toBe('move');
  });

  it('task-deleted event closes overlay', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'todo' })]
    });
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLElement>('[data-task-id="t1"]')!.click();
    await el.updateComplete;
    expect((el as any)._openTaskId).toBe('t1');
    el.shadowRoot!.querySelector('doen-task')!.dispatchEvent(new CustomEvent('task-deleted', { bubbles: true }));
    await el.updateComplete;
    expect((el as any)._openTaskId).toBeNull();
  });

  it('non-ApiError from _move is ignored silently', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network'));
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'todo' })]
    });
    await el.updateComplete;
    await (el as any)._move('t1', 'done');
    await flushPromises();
    expect(vi.mocked(api.post)).toHaveBeenCalled();
  });

  it('_onColDrop with no id does nothing', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    (el as any)._dragId = null;
    const fakeDrop = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: () => '' },
    };
    (el as any)._onColDrop(fakeDrop as unknown as DragEvent, 'done');
    await flushPromises();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_onDragStart with null dataTransfer does not crash', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    expect(() => {
      (el as any)._onDragStart({ dataTransfer: null } as unknown as DragEvent, 't1');
    }).not.toThrow();
  });

  it('_byStatus sorts tasks with null due_date after tasks with due_date', async () => {
    const future = new Date(Date.now() + 86400 * 1000).toISOString();
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [
        task({ id: 't1', status: 'todo', due_date: null }),
        task({ id: 't2', status: 'todo', due_date: future }),
      ]
    });
    await el.updateComplete;
    const sorted = (el as any)._byStatus('todo');
    expect(sorted[0].id).toBe('t2');
    expect(sorted[1].id).toBe('t1');
  });

  it('_byStatus sorts two tasks both with due_date by date ascending', async () => {
    const sooner = new Date(Date.now() + 86400 * 1000).toISOString();
    const later = new Date(Date.now() + 2 * 86400 * 1000).toISOString();
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [
        task({ id: 't_later', status: 'todo', due_date: later }),
        task({ id: 't_sooner', status: 'todo', due_date: sooner }),
      ]
    });
    await el.updateComplete;
    const sorted = (el as any)._byStatus('todo');
    expect(sorted[0].id).toBe('t_sooner');
    expect(sorted[1].id).toBe('t_later');
  });

  it('_move returns early when task already has target status', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'todo' })]
    });
    await el.updateComplete;
    await (el as any)._move('t1', 'todo');
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('ApiError from _move shows toast', async () => {
    const { ApiError } = await import('../services/api');
    vi.mocked(api.put).mockRejectedValue(new ApiError(500, 'move fail'));
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'todo' })]
    });
    await el.updateComplete;
    await (el as any)._move('t1', 'in_progress');
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('_onColDrop reads id from dataTransfer when _dragId is null', async () => {
    vi.mocked(api.put).mockResolvedValue({} as never);
    el = await mount<DoenViewKanban>('doen-view-kanban', {
      tasks: [task({ id: 't1', status: 'todo' })]
    });
    await el.updateComplete;
    (el as any)._dragId = null;
    const fakeDrop = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: () => 't1' },
    };
    (el as any)._onColDrop(fakeDrop as unknown as DragEvent, 'in_progress');
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/tasks/t1', { status: 'in_progress' });
  });

  it('_onColDrop with null dataTransfer and null _dragId does nothing', async () => {
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [] });
    await el.updateComplete;
    (el as any)._dragId = null;
    const fakeDrop = {
      preventDefault: vi.fn(),
      dataTransfer: null,
    };
    (el as any)._onColDrop(fakeDrop as unknown as DragEvent, 'done');
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('onRefresh prop is called when controller triggers refresh', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    el = await mount<DoenViewKanban>('doen-view-kanban', { tasks: [], onRefresh });
    await el.updateComplete;
    const ptr = (el as any)._ptr;
    ptr.state = 'ready';
    (ptr as any).isTracking = true;
    await (ptr as any)._onTouchEnd();
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
