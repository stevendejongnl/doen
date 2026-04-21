export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  type: 'personal' | 'household' | 'custom';
  owner_id: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  group_id?: string;
  owner_id: string;
  archived_at?: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

export interface GroupMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  project_id: string;
  category_id?: string | null;
  category_name?: string | null;
  category_color?: string | null;
  assignee_id?: string;
  assignee_name?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  recurring_rule?: RecurringRule;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  group_id?: string | null;
  project_id?: string | null;
  owner_id: string;
  created_at: string;
}

export type RecurrenceUnit = 'day' | 'week' | 'month';
export type RecurrenceParity = 'any' | 'odd' | 'even';

export interface RecurringRule {
  id: string;
  template_task_id: string;
  unit: RecurrenceUnit;
  interval: number;
  weekdays?: string | null;   // CSV of 0..6 (Mon..Sun)
  month_day?: number | null;  // 1..31
  time_of_day: string;        // "HH:MM"
  parity: RecurrenceParity;
  last_spawned_at?: string;
  notify_on_spawn: boolean;
  active: boolean;
}

export interface TaskFilters {
  due_today?: boolean;
  overdue?: boolean;
  assignee_id?: string;
  group_id?: string;
  status?: TaskStatus;
}
