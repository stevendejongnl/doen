import { describe, it, expect } from 'vitest';
import { isActive, isDone, sortByDue, byStatus, priorityAccent } from './tasks';
import type { Task } from '../services/types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '1',
    title: 'Test',
    status: 'todo',
    priority: 'none',
    point_value: 1,
    project_id: 'p1',
    created_at: '2024-01-01T00:00:00',
    updated_at: '2024-01-01T00:00:00',
    ...overrides,
  };
}

describe('isActive', () => {
  it('returns true for todo', () => expect(isActive(makeTask({ status: 'todo' }))).toBe(true));
  it('returns true for in_progress', () => expect(isActive(makeTask({ status: 'in_progress' }))).toBe(true));
  it('returns false for done', () => expect(isActive(makeTask({ status: 'done' }))).toBe(false));
});

describe('isDone', () => {
  it('returns false for todo', () => expect(isDone(makeTask({ status: 'todo' }))).toBe(false));
  it('returns true for done', () => expect(isDone(makeTask({ status: 'done' }))).toBe(true));
});

describe('sortByDue', () => {
  it('sorts earlier due dates first', () => {
    const a = makeTask({ due_date: '2024-06-15' });
    const b = makeTask({ due_date: '2024-06-10' });
    expect(sortByDue(a, b)).toBeGreaterThan(0);
    expect(sortByDue(b, a)).toBeLessThan(0);
  });

  it('places tasks without due date last', () => {
    const a = makeTask({ due_date: undefined });
    const b = makeTask({ due_date: '2024-06-10' });
    expect(sortByDue(a, b)).toBeGreaterThan(0);
  });

  it('returns 0 for equal due dates', () => {
    const a = makeTask({ due_date: '2024-06-15' });
    const b = makeTask({ due_date: '2024-06-15' });
    expect(sortByDue(a, b)).toBe(0);
  });

  it('returns NaN (or 0) when both tasks have no due date', () => {
    const a = makeTask({ due_date: undefined });
    const b = makeTask({ due_date: undefined });
    // Infinity - Infinity = NaN; sort considers NaN as equal
    expect(isNaN(sortByDue(a, b)) || sortByDue(a, b) === 0).toBe(true);
  });
});

describe('byStatus', () => {
  const tasks = [
    makeTask({ id: '1', status: 'todo', due_date: '2024-06-15' }),
    makeTask({ id: '2', status: 'done', due_date: '2024-06-10' }),
    makeTask({ id: '3', status: 'todo', due_date: '2024-06-12' }),
  ] satisfies Task[];

  it('filters by status', () => {
    const result = byStatus(tasks, 'todo');
    expect(result.every(t => t.status === 'todo')).toBe(true);
    expect(result.length).toBe(2);
  });

  it('sorts by due date ascending', () => {
    const result = byStatus(tasks, 'todo');
    expect(result[0].id).toBe('3'); // earlier due
    expect(result[1].id).toBe('1');
  });
});

describe('priorityAccent', () => {
  it.each([
    ['high', '#ef4444'],
    ['medium', '#f59e0b'],
    ['low', '#10b981'],
    ['none', 'rgba(255,255,255,0.2)'],
    ['unknown', 'rgba(255,255,255,0.2)'],
  ])('priorityAccent(%s) → %s', (priority, expected) => {
    expect(priorityAccent(priority)).toBe(expected);
  });
});
