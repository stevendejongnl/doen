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

export interface Task {
  id: string;
  title: string;
  notes?: string;
  project_id: string;
  assignee_id?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringRule {
  id: string;
  template_task_id: string;
  schedule_cron: string;
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
