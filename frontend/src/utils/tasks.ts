import type { Task, TaskStatus } from '../services/types';

export function isActive(t: Task): boolean {
  return t.status !== 'done';
}

export function isDone(t: Task): boolean {
  return t.status === 'done';
}

export function sortByDue(a: Task, b: Task): number {
  const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
  const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
  return ad - bd;
}

export function byStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks.filter(t => t.status === status).sort(sortByDue);
}

export function priorityAccent(priority: string): string {
  switch (priority) {
    case 'high':   return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low':    return '#10b981';
    default:       return 'rgba(255,255,255,0.2)';
  }
}
