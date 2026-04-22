import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  Category,
  GroupMember,
  Project,
  Task,
  TaskPriority,
  RecurringRule,
  RecurrenceUnit,
  RecurrenceParity,
  TaskOffer,
} from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from './doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import './ui/doen-confirm-dialog';
import './ui/doen-prompt-dialog';
import type { DoenConfirmDialog } from './ui/doen-confirm-dialog';
import type { DoenPromptDialog } from './ui/doen-prompt-dialog';

const DAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

function normalizeTime24(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function parseWeekdays(csv: string | null | undefined): Set<number> {
  if (!csv) return new Set();
  return new Set(csv.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n >= 0 && n <= 6));
}

function weekdaysToCsv(s: Set<number>): string | null {
  if (s.size === 0) return null;
  return [...s].sort((a, b) => a - b).join(',');
}

export function describeRule(rule: RecurringRule): string {
  const interval = Math.max(1, rule.interval ?? 1);
  let base = '';
  if (rule.unit === 'day') {
    base = interval > 1 ? `Elke ${interval} dagen` : 'Dagelijks';
  } else if (rule.unit === 'week') {
    const days = [...parseWeekdays(rule.weekdays)].sort((a, b) => a - b).map(n => DAY_LABELS[n]).join(', ');
    const prefix = interval > 1 ? `Elke ${interval} weken` : 'Wekelijks';
    base = days ? `${prefix} op ${days}` : prefix;
  } else if (rule.unit === 'month') {
    const dayBit = rule.month_day ? ` op dag ${rule.month_day}` : '';
    base = interval > 1 ? `Elke ${interval} maanden${dayBit}` : `Maandelijks${dayBit}`;
  }
  let suffix = '';
  if (rule.parity === 'odd') suffix = rule.unit === 'week' ? ' · oneven weken' : ' · oneven';
  if (rule.parity === 'even') suffix = rule.unit === 'week' ? ' · even weken' : ' · even';
  return `${base}${suffix} · ${rule.time_of_day ?? '08:00'}`;
}

@customElement('doen-task')
export class DoenTask extends LitElement {
  @property({ type: Object }) task!: Task;
  @property({ type: Boolean }) hideRow = false;
  @property({ type: Boolean }) autoOpen = false;
  @state() private _completing = false;
  @state() private _done = false;
  @state() private _modalOpen = false;
  @state() private _modalMode: 'view' | 'edit' = 'view';
  @state() private _editTitle = '';
  @state() private _editPriority: TaskPriority = 'none';
  @state() private _editDue = '';
  @state() private _editNotes = '';
  @state() private _editRecurring = false;
  @state() private _editUnit: RecurrenceUnit = 'week';
  @state() private _editInterval = 1;
  @state() private _editWeekdays: Set<number> = new Set([0]);
  @state() private _editMonthDay = 1;
  @state() private _editTimeOfDay = '08:00';
  @state() private _editParity: RecurrenceParity = 'any';
  @state() private _editAssignee = '';
  @state() private _editCategoryId = '';
  @state() private _members: GroupMember[] = [];
  @state() private _categories: Category[] = [];
  @state() private _saving = false;
  @state() private _project: Project | null = null;

  static styles = [...sharedStyles, css`
    :host { display: block; }

    .task-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 12px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: background var(--transition-smooth), opacity var(--transition-smooth), transform var(--transition-smooth);
    }

    .task-row:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.16); }
    .task-row.done-anim { opacity: 0; transform: translateX(16px); pointer-events: none; }

    .check-btn {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.22);
      background: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
      padding: 0;
      color: var(--color-success);
      position: relative;
    }
    .check-btn::after {
      content: ''; position: absolute;
      top: -11px; right: -11px; bottom: -11px; left: -11px;
    }

    .check-btn:hover { border-color: var(--color-success); transform: scale(1.1); }
    .check-btn.completing { border-color: var(--color-success); background: rgba(16,185,129,0.15); }
    .check-btn.done { border-color: var(--color-success); background: rgba(16,185,129,0.2); }
    .check-btn i { font-size: 10px; opacity: 0; transition: opacity var(--transition-fast); }
    .check-btn.completing i, .check-btn.done i { opacity: 1; }

    .priority-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .p-none { background: rgba(255,255,255,0.22); }
    .p-low  { background: var(--color-priority-low); }
    .p-medium { background: var(--color-priority-medium); }
    .p-high { background: var(--color-priority-high); box-shadow: 0 0 6px var(--color-priority-high); }

    .task-title {
      flex: 1; font-size: 13px; color: var(--color-text);
      line-height: 1.4; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .task-title.done-text { text-decoration: line-through; opacity: 0.38; }

    .due-date {
      font-size: 11px; color: var(--color-text-muted);
      white-space: nowrap; display: flex; align-items: center; gap: 4px; flex-shrink: 0;
    }
    .due-date.overdue { color: var(--color-danger); }
    .due-date i { font-size: 9px; }

    .task-meta {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }

    .meta-icon {
      font-size: 10px; color: var(--color-text-muted);
    }

    .assignee-chip {
      width: 20px; height: 20px;
      border-radius: 50%;
      background: rgba(99,102,241,0.3);
      border: 1px solid rgba(99,102,241,0.5);
      color: #e8eaf0;
      font-size: 10px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      text-transform: uppercase;
    }

    .category-chip {
      display: inline-flex; align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px; font-weight: 600;
      background: rgba(168,85,247,0.15);
      border: 1px solid rgba(168,85,247,0.35);
      color: #c4a1ff;
      flex-shrink: 0;
      max-width: 120px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .task-row { cursor: pointer; }

    .edit-btn {
      width: 44px; height: 44px;
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; color: var(--color-text-muted);
      transition: background var(--transition-fast), color var(--transition-fast);
      flex-shrink: 0;
    }
    @media (hover: hover) {
      .edit-btn { opacity: 0; }
      .task-row:hover .edit-btn { opacity: 1; }
    }
    .edit-btn:hover { background: rgba(255,255,255,0.1); color: var(--color-text); }

    /* Modal */
    .modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(10, 12, 20, 0.55);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      padding: 20px;
      animation: backdrop-in 160ms ease-out;
    }
    @keyframes backdrop-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .modal-panel {
      width: 100%;
      max-width: 560px;
      max-height: calc(100dvh - 40px);
      background: rgba(30, 36, 54, 0.92);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-lg);
      display: flex; flex-direction: column;
      overflow: hidden;
      animation: panel-in 200ms cubic-bezier(0.2, 0.8, 0.3, 1);
      cursor: default;
    }
    @keyframes panel-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .modal-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .modal-title {
      flex: 1; min-width: 0;
      font-size: 15px; font-weight: 600; color: var(--color-text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .modal-close {
      width: 44px; height: 44px;
      border-radius: var(--radius-sm);
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      color: var(--color-text-muted-strong);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background var(--transition-fast), color var(--transition-fast);
    }
    .modal-close:hover { background: rgba(255,255,255,0.12); color: var(--color-text); }
    .modal-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }
    .modal-footer {
      display: flex; gap: 8px; justify-content: flex-end;
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
    }

    /* Detail view */
    .detail-grid {
      display: grid; gap: 14px;
    }
    .detail-row {
      display: grid; grid-template-columns: 120px 1fr; gap: 12px;
      align-items: start;
      font-size: 13px;
    }
    .detail-label {
      color: var(--color-text-muted-strong);
      font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.04em; padding-top: 2px;
    }
    .detail-value {
      color: var(--color-text);
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      min-width: 0;
    }
    .detail-value.muted { color: var(--color-text-muted); font-style: italic; }
    .detail-notes {
      color: var(--color-text);
      font-size: 13px; line-height: 1.55;
      white-space: pre-wrap; word-break: break-word;
    }
    .detail-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      font-size: 12px;
    }
    .detail-chip.overdue { color: var(--color-danger); border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }
    .detail-chip.done { color: var(--color-success); border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.08); }
    .detail-chip.toggle { cursor: pointer; transition: background var(--transition-fast), border-color var(--transition-fast); }
    .detail-chip.toggle:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.22); }
    .detail-chip.toggle.done:hover { background: rgba(16,185,129,0.16); border-color: rgba(16,185,129,0.45); }

    .btn-edit-modal {
      background: var(--color-accent); color: white; border: none;
      border-radius: var(--radius-sm); padding: 8px 16px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background var(--transition-fast);
      display: flex; align-items: center; gap: 6px;
    }
    .btn-edit-modal:hover { background: var(--color-accent-hover); }

    /* Edit form (inside modal) */
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    @media (max-width: 640px) {
      .modal-backdrop { padding: 0; align-items: flex-end; }
      .modal-panel {
        width: 100%;
        max-width: 100%;
        max-height: 92dvh;
        border-radius: 18px 18px 0 0;
        border-bottom: none;
        animation: panel-up 220ms cubic-bezier(0.2, 0.8, 0.3, 1);
      }
      @keyframes panel-up {
        from { opacity: 0; transform: translateY(32px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .modal-header { padding: 14px 14px 12px; }
      .modal-body { padding: 14px; }
      .modal-footer {
        padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
        flex-wrap: wrap;
      }
      .detail-row {
        grid-template-columns: 1fr;
        gap: 4px;
      }
      .detail-label {
        padding-top: 0;
      }
      .edit-row { gap: 6px; }
      .edit-row select,
      .edit-row input[type="date"] {
        flex: 1 1 120px;
        min-width: 0;
      }
      .edit-title { flex: 1 1 100%; }
      .btn-delete { order: 99; width: 100%; justify-content: center; margin-right: 0; }
    }

    .edit-row { display: flex; gap: 8px; flex-wrap: wrap; }

    input, select, textarea {
      font: inherit;
      color: var(--color-text);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      transition: border-color var(--transition-fast), background var(--transition-fast);
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--color-accent);
      background: rgba(255,255,255,0.12);
    }

    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
    select option { background: var(--color-surface-solid); color: var(--color-text); }

    textarea {
      width: 100%;
      min-height: 72px;
      resize: vertical;
      box-sizing: border-box;
      font-size: 13px;
      line-height: 1.5;
    }

    .edit-title { flex: 1; min-width: 160px; font-size: 13px; }

    .edit-actions { display: flex; gap: 8px; justify-content: flex-end; }

    .btn-save {
      background: var(--color-accent); color: white; border: none;
      border-radius: var(--radius-sm); padding: 7px 16px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background var(--transition-fast);
      display: flex; align-items: center; gap: 6px;
    }
    .btn-save:hover { background: var(--color-accent-hover); }
    .btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-cancel-edit {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: var(--color-text-muted-strong);
      border-radius: var(--radius-sm); padding: 7px 12px;
      font-size: 12px; cursor: pointer;
      transition: background var(--transition-fast);
    }
    .btn-cancel-edit:hover { background: rgba(255,255,255,0.12); }

    .btn-delete {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.2);
      color: var(--color-danger);
      border-radius: var(--radius-sm); padding: 7px 12px;
      font-size: 12px; cursor: pointer;
      transition: background var(--transition-fast);
      margin-right: auto;
      display: flex; align-items: center; gap: 6px;
    }
    .btn-delete:hover { background: rgba(239,68,68,0.2); }

    /* Recurring toggle */
    .recurring-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }

    .toggle-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: var(--color-text-muted-strong);
      cursor: pointer; user-select: none;
      min-height: 44px;
    }

    .toggle {
      position: relative; width: 32px; height: 18px; flex-shrink: 0;
    }
    .toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .toggle-track {
      position: absolute; inset: 0;
      background: rgba(255,255,255,0.12);
      border-radius: 9px;
      transition: background 150ms;
      cursor: pointer;
    }
    .toggle input:checked ~ .toggle-track { background: var(--color-accent); }
    .toggle-thumb {
      position: absolute; top: 3px; left: 3px;
      width: 12px; height: 12px;
      background: white; border-radius: 50%;
      transition: transform 150ms;
      pointer-events: none;
    }
    .toggle input:checked ~ .toggle-thumb { transform: translateX(14px); }

    .freq-select { font-size: 12px; padding: 5px 10px; }

    /* Recurrence builder */
    .recurrence-builder {
      width: 100%;
      display: flex; flex-direction: column; gap: 10px;
      padding: 10px 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
    }
    .rb-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      font-size: 12px; color: var(--color-text-muted-strong);
    }
    .rb-row select, .rb-row input {
      font-size: 12px; padding: 5px 8px;
    }
    .rb-row input[type="number"] { width: 56px; }
    .rb-row input[type="time"] { width: 90px; }

    .weekday-picker {
      display: flex; gap: 4px; flex-wrap: wrap;
    }
    .weekday-chip {
      padding: 10px 12px;
      min-height: 36px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.14);
      color: var(--color-text-muted-strong);
      cursor: pointer;
      user-select: none;
      transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
    }
    .weekday-chip.active {
      background: rgba(99,102,241,0.28);
      border-color: var(--color-accent);
      color: var(--color-text);
    }
    .weekday-chip:hover { border-color: rgba(255,255,255,0.28); }

    .rb-preview {
      font-size: 11px; color: var(--color-text-muted-strong);
      font-style: italic;
    }

    @media (max-width: 768px) {
      .task-row { gap: 8px; padding: 13px 12px; }
      .detail-chip,
      .category-chip,
      .meta-icon,
      .due-date { display: none; }
    }
  `];

  private async _complete(e?: Event) {
    e?.stopPropagation();
    if (this._completing) return;
    this._completing = true;
    const isDone = this.task.status === 'done';
    const prevStatus = this.task.status;
    this.task = { ...this.task, status: isDone ? 'todo' : 'done' };
    try {
      const endpoint = isDone ? 'reopen' : 'complete';
      const updated = await api.post<Task>(`/tasks/${this.task.id}/${endpoint}`, {});
      this.task = updated;
      if (isDone) {
        this._completing = false;
        toast.success('Heropend');
      } else {
        setTimeout(() => { this._done = true; }, 280);
        toast.success('Gedaan!');
      }
      this.dispatchEvent(new CustomEvent('task-updated', { detail: this.task, bubbles: true, composed: true }));
    } catch (err) {
      this.task = { ...this.task, status: prevStatus };
      this._completing = false;
      if (err instanceof ApiError) toast.error(`Mislukt: ${err.message}`);
    }
  }

  private _resetEditState() {
    this._editTitle = this.task.title;
    this._editPriority = this.task.priority as TaskPriority;
    this._editDue = this.task.due_date ? this.task.due_date.substring(0, 10) : '';
    this._editNotes = this.task.notes ?? '';
    this._editAssignee = this.task.assignee_id ?? '';
    this._editCategoryId = this.task.category_id ?? '';

    const rr = this.task.recurring_rule;
    this._editRecurring = !!rr;
    this._editUnit = rr?.unit ?? 'week';
    this._editInterval = rr?.interval ?? 1;
    this._editWeekdays = rr ? parseWeekdays(rr.weekdays) : new Set([0]);
    this._editMonthDay = rr?.month_day ?? 1;
    this._editTimeOfDay = rr?.time_of_day ?? '08:00';
    this._editParity = rr?.parity ?? 'any';
  }

  private async _loadMembers() {
    try {
      const project = await api.get<Project>(`/projects/${this.task.project_id}`);
      this._project = project;
      if (project.group_id) {
        this._members = await api.get<GroupMember[]>(`/groups/${project.group_id}/members`);
      } else {
        this._members = [];
      }
      await this._loadCategories(project);
    } catch {
      this._project = null;
      this._members = [];
    }
  }

  private _offerTask() {
    if (!this._project?.group_id) {
      toast.error('Alleen taken in een huishouden kunnen worden aangeboden.');
      return;
    }
    const dialog = document.createElement('doen-prompt-dialog') as DoenPromptDialog;
    dialog.message = 'Wat krijg je terug?';
    dialog.placeholder = 'Bijv. pizza of bier (optioneel)';
    dialog.submitLabel = 'Aanbieden';
    dialog.addEventListener('doen-submit', async (e: Event) => {
      const reward = (e as CustomEvent<string>).detail;
      dialog.remove();
      try {
        await api.post<TaskOffer>(`/tasks/${this.task.id}/offer`, {
          reward_note: reward || null,
        });
        toast.success('Aanbod geplaatst');
        this.dispatchEvent(new CustomEvent('offer-created', { bubbles: true, composed: true }));
      } catch (err) {
        if (err instanceof ApiError) toast.error(`Aanbieden mislukt: ${err.message}`);
      }
    }, { once: true });
    dialog.addEventListener('doen-cancel', async () => {
      // No reward provided — offer with null reward
      dialog.remove();
      try {
        await api.post<TaskOffer>(`/tasks/${this.task.id}/offer`, { reward_note: null });
        toast.success('Aanbod geplaatst');
        this.dispatchEvent(new CustomEvent('offer-created', { bubbles: true, composed: true }));
      } catch (err) {
        if (err instanceof ApiError) toast.error(`Aanbieden mislukt: ${err.message}`);
      }
    }, { once: true });
    document.body.appendChild(dialog);
  }

  private async _loadCategories(project: Project) {
    try {
      const all = await api.get<Category[]>('/categories');
      const gid = project.group_id ?? null;
      this._categories = all.filter(c =>
        (c.project_id === project.id) ||
        (c.project_id == null && c.group_id === gid) ||
        (c.project_id == null && c.group_id == null)
      );
    } catch {
      this._categories = [];
    }
  }

  private _onEditCategoryChange(value: string) {
    if (value === '__new__') {
      const dialog = document.createElement('doen-prompt-dialog') as DoenPromptDialog;
      dialog.message = 'Naam van de categorie?';
      dialog.addEventListener('doen-submit', async (e: Event) => {
        const name = (e as CustomEvent<string>).detail;
        dialog.remove();
        try {
          const created = await api.post<Category>('/categories', {
            name: name,
            color: '#a855f7',
            ...(this._project?.group_id ? { group_id: this._project.group_id } : {}),
          });
          this._categories = [...this._categories, created];
          this._editCategoryId = created.id;
        } catch (err) {
          if (err instanceof ApiError) toast.error(`Aanmaken mislukt: ${err.message}`);
          this._editCategoryId = this.task.category_id ?? '';
        }
      }, { once: true });
      dialog.addEventListener('doen-cancel', () => {
        dialog.remove();
        this._editCategoryId = this.task.category_id ?? '';
      }, { once: true });
      document.body.appendChild(dialog);
    } else {
      this._editCategoryId = value;
    }
  }

  private async _openModal(mode: 'view' | 'edit' = 'view') {
    this._modalOpen = true;
    this._modalMode = 'view';
    try {
      this.task = await api.get<Task>(`/tasks/${this.task.id}`);
    } catch {
      // fall through with whatever this.task already is
    }
    await this._loadMembers();
    if (mode === 'edit') {
      this._resetEditState();
      this._modalMode = 'edit';
    }
  }

  private _closeModal = () => {
    this._modalOpen = false;
    this._modalMode = 'view';
    this.dispatchEvent(new CustomEvent('modal-closed', { bubbles: true, composed: true }));
  };

  private _onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) this._closeModal();
  }

  private _onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._modalOpen) this._closeModal();
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeydown);
  }

  firstUpdated() {
    if (this.autoOpen && !this._modalOpen && this.task) {
      this._openModal('view');
    }
  }

  private _toggleWeekday(n: number) {
    const next = new Set(this._editWeekdays);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    this._editWeekdays = next;
  }

  private _recurrencePayload() {
    return {
      unit: this._editUnit,
      interval: Math.max(1, this._editInterval),
      weekdays: this._editUnit === 'week' ? weekdaysToCsv(this._editWeekdays) : null,
      month_day: this._editUnit === 'month' ? this._editMonthDay : null,
      time_of_day: this._editTimeOfDay,
      parity: this._editParity,
      notify_on_spawn: false,
    };
  }

  private _previewDescription(): string {
    const rr: RecurringRule = {
      id: '', template_task_id: '', active: true,
      ...this._recurrencePayload(),
      weekdays: this._editUnit === 'week' ? weekdaysToCsv(this._editWeekdays) : null,
      month_day: this._editUnit === 'month' ? this._editMonthDay : null,
    };
    return describeRule(rr);
  }

  private async _saveEdit(e: Event) {
    e.preventDefault();
    if (!this._editTitle.trim() || this._saving) return;
    this._saving = true;
    try {
      const updated = await api.put<Task>(`/tasks/${this.task.id}`, {
        title: this._editTitle.trim(),
        notes: this._editNotes.trim() || null,
        priority: this._editPriority,
        due_date: this._editDue ? new Date(this._editDue).toISOString() : null,
        assignee_id: this._members.length > 1 ? (this._editAssignee || null) : undefined,
        category_id: this._editCategoryId || null,
      });

      const hadRule = !!this.task.recurring_rule;
      const wantsRule = this._editRecurring;

      if (wantsRule && !hadRule) {
        await api.post<RecurringRule>(`/tasks/${this.task.id}/recurring`, this._recurrencePayload());
        const fresh = await api.get<Task>(`/tasks/${this.task.id}`);
        this.task = fresh;
      } else if (wantsRule && hadRule && this.task.recurring_rule) {
        await api.patch<RecurringRule>(
          `/recurring/${this.task.recurring_rule.id}`,
          this._recurrencePayload(),
        );
        const fresh = await api.get<Task>(`/tasks/${this.task.id}`);
        this.task = fresh;
      } else if (!wantsRule && hadRule && this.task.recurring_rule) {
        await api.delete(`/recurring/${this.task.recurring_rule.id}`);
        this.task = { ...updated, recurring_rule: undefined };
      } else {
        this.task = updated;
      }

      this._modalMode = 'view';
      this.dispatchEvent(new CustomEvent('task-updated', { detail: this.task, bubbles: true, composed: true }));
      toast.success('Opgeslagen!');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Opslaan mislukt: ${e.message}`);
    } finally {
      this._saving = false;
    }
  }

  private _delete() {
    const dialog = document.createElement('doen-confirm-dialog') as DoenConfirmDialog;
    dialog.message = `"${this.task.title}" verwijderen?`;
    dialog.confirmLabel = 'Verwijderen';
    dialog.confirmVariant = 'danger';
    dialog.addEventListener('doen-confirm', async () => {
      dialog.remove();
      try {
        await api.delete(`/tasks/${this.task.id}`);
        this._done = true;
        this._closeModal();
        this.dispatchEvent(new CustomEvent('task-deleted', { detail: this.task.id, bubbles: true, composed: true }));
      } catch (e) {
        if (e instanceof ApiError) toast.error(`Verwijderen mislukt: ${e.message}`);
      }
    }, { once: true });
    dialog.addEventListener('doen-cancel', () => dialog.remove(), { once: true });
    document.body.appendChild(dialog);
  }

  private _formatDue(due?: string | null): { label: string; overdue: boolean } | null {
    if (!due) return null;
    const d = new Date(due);
    const overdue = d < new Date() && this.task.status !== 'done';
    return { label: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }), overdue };
  }

  private _renderEditForm() {
    return html`
      <form class="edit-form" @submit=${this._saveEdit}>
        <div class="edit-row">
          <input class="edit-title" type="text"
            .value=${this._editTitle}
            @input=${(e: Event) => this._editTitle = (e.target as HTMLInputElement).value}
            ?disabled=${this._saving}
          />
        </div>
        <div class="edit-row">
          <select .value=${this._editPriority}
            @change=${(e: Event) => this._editPriority = (e.target as HTMLSelectElement).value as TaskPriority}>
            <option value="none">Geen prioriteit</option>
            <option value="low">Laag</option>
            <option value="medium">Middel</option>
            <option value="high">Hoog</option>
          </select>
          <input type="date"
            .value=${this._editDue}
            @input=${(e: Event) => this._editDue = (e.target as HTMLInputElement).value}
          />
          ${this._members.length > 1 ? html`
            <select
              @change=${(e: Event) => this._editAssignee = (e.target as HTMLSelectElement).value}>
              <option value="" .selected=${this._editAssignee === ''}>Niemand toegewezen</option>
              ${this._members.map(member => html`
                <option value=${member.user_id} .selected=${this._editAssignee === member.user_id}>${member.name}</option>
              `)}
            </select>
          ` : ''}
          <select
            @change=${(e: Event) => this._onEditCategoryChange((e.target as HTMLSelectElement).value)}>
            <option value="" .selected=${this._editCategoryId === ''}>Geen categorie</option>
            ${this._categories.map(category => html`
              <option value=${category.id} .selected=${this._editCategoryId === category.id}>${category.name}</option>
            `)}
            <option value="__new__" .selected=${false}>+ Nieuwe categorie…</option>
          </select>
        </div>
        <textarea
          placeholder="Notities, context, links..."
          .value=${this._editNotes}
          @input=${(e: Event) => this._editNotes = (e.target as HTMLTextAreaElement).value}
          ?disabled=${this._saving}
        ></textarea>
        <div class="recurring-row">
          <label class="toggle-label">
            <span class="toggle">
              <input type="checkbox"
                .checked=${this._editRecurring}
                @change=${(e: Event) => this._editRecurring = (e.target as HTMLInputElement).checked}
              />
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </span>
            <i class="fa-solid fa-repeat" style="font-size:11px;opacity:0.6"></i>
            Herhalen
          </label>
        </div>
        ${this._editRecurring ? html`
          <div class="recurrence-builder">
            <div class="rb-row">
              <span>Elke</span>
              <input type="number" min="1" max="365"
                .value=${String(this._editInterval)}
                @input=${(e: Event) => this._editInterval = Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 1)}
              />
              <select .value=${this._editUnit}
                @change=${(e: Event) => this._editUnit = (e.target as HTMLSelectElement).value as RecurrenceUnit}>
                <option value="day">dag(en)</option>
                <option value="week">we(e)k(en)</option>
                <option value="month">maand(en)</option>
              </select>
            </div>
            ${this._editUnit === 'week' ? html`
              <div class="rb-row">
                <span>Op:</span>
                <div class="weekday-picker">
                  ${DAY_LABELS.map((label, i) => html`
                    <span class="weekday-chip ${this._editWeekdays.has(i) ? 'active' : ''}"
                      @click=${() => this._toggleWeekday(i)}>${label}</span>
                  `)}
                </div>
              </div>
            ` : ''}
            ${this._editUnit === 'month' ? html`
              <div class="rb-row">
                <span>Dag van de maand:</span>
                <input type="number" min="1" max="31"
                  .value=${String(this._editMonthDay)}
                  @input=${(e: Event) => this._editMonthDay = Math.max(1, Math.min(31, parseInt((e.target as HTMLInputElement).value, 10) || 1))}
                />
              </div>
            ` : ''}
            <div class="rb-row">
              <span>Om:</span>
              <input type="text"
                inputmode="numeric"
                pattern="[0-2][0-9]:[0-5][0-9]"
                maxlength="5"
                placeholder="08:00"
                aria-label="Tijd in 24-uurs notatie"
                .value=${this._editTimeOfDay}
                @input=${(e: Event) => {
                  const t = e.target as HTMLInputElement;
                  const next = normalizeTime24(t.value);
                  this._editTimeOfDay = next;
                  t.value = next;
                }}
                @blur=${(e: Event) => {
                  const t = e.target as HTMLInputElement;
                  if (!/^[0-2][0-9]:[0-5][0-9]$/.test(t.value)) this._editTimeOfDay = '08:00';
                }}
              />
              <span style="margin-left:8px">Alleen</span>
              <select .value=${this._editParity}
                @change=${(e: Event) => this._editParity = (e.target as HTMLSelectElement).value as RecurrenceParity}>
                <option value="any">alle</option>
                <option value="odd">oneven</option>
                <option value="even">even</option>
              </select>
              <span>${this._editUnit === 'week' ? 'weken' : this._editUnit === 'month' ? 'maanden' : 'dagen'}</span>
            </div>
            <div class="rb-preview">${this._previewDescription()}</div>
          </div>
        ` : ''}
      </form>
    `;
  }

  private _renderDetailView() {
    const due = this._formatDue(this.task.due_date);
    const priorityLabel = {
      none: 'Geen', low: 'Laag', medium: 'Middel', high: 'Hoog',
    }[this.task.priority as TaskPriority];
    const isDone = this.task.status === 'done';

    return html`
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">
            ${isDone
              ? html`<span class="detail-chip toggle done" @click=${this._complete} title="Markeer als te doen">
                  <i class="fa-solid fa-check"></i> Klaar
                </span>`
              : html`<span class="detail-chip toggle" @click=${this._complete} title="Markeer als klaar">
                  <i class="fa-regular fa-circle"></i> Open
                </span>`}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Prioriteit</span>
          <span class="detail-value">
            <span class="priority-dot p-${this.task.priority}"></span>
            ${priorityLabel}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Punten</span>
          <span class="detail-value">
            <span class="detail-chip">${this.task.point_value} punt${this.task.point_value === 1 ? '' : 'en'}</span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Deadline</span>
          ${due
            ? html`<span class="detail-value">
                <span class="detail-chip ${due.overdue ? 'overdue' : ''}">
                  <i class="fa-solid fa-${due.overdue ? 'triangle-exclamation' : 'clock'}"></i>
                  ${due.label}
                </span>
              </span>`
            : html`<span class="detail-value muted">Geen deadline</span>`}
        </div>
        ${this.task.assignee_name ? html`
          <div class="detail-row">
            <span class="detail-label">Toegewezen</span>
            <span class="detail-value">
              <span class="assignee-chip">${this.task.assignee_name.slice(0, 1)}</span>
              ${this.task.assignee_name}
            </span>
          </div>
        ` : ''}
        ${this.task.category_name ? html`
          <div class="detail-row">
            <span class="detail-label">Categorie</span>
            <span class="detail-value">
              <span class="category-chip"
                style=${`background:${this.task.category_color ?? '#a855f7'}22;border-color:${this.task.category_color ?? '#a855f7'};color:${this.task.category_color ?? '#c4a1ff'}`}>
                ${this.task.category_name}
              </span>
            </span>
          </div>
        ` : ''}
        ${this.task.recurring_rule ? html`
          <div class="detail-row">
            <span class="detail-label">Herhaling</span>
            <span class="detail-value">
              <i class="fa-solid fa-repeat" style="opacity:0.6"></i>
              ${describeRule(this.task.recurring_rule)}
            </span>
          </div>
        ` : ''}
        <div class="detail-row">
          <span class="detail-label">Notities</span>
          ${this.task.notes
            ? html`<div class="detail-notes">${this.task.notes}</div>`
            : html`<span class="detail-value muted">Geen notities</span>`}
        </div>
      </div>
    `;
  }

  private _renderModal() {
    if (!this._modalOpen) return '';
    const inEdit = this._modalMode === 'edit';
    return html`
      <div class="modal-backdrop" @click=${this._onBackdropClick}>
        <div class="modal-panel">
          <div class="modal-header">
            <span class="priority-dot p-${this.task.priority}"></span>
            <span class="modal-title">${this.task.title}</span>
            <button class="modal-close" @click=${this._closeModal} title="Sluiten">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            ${inEdit ? this._renderEditForm() : this._renderDetailView()}
          </div>
          <div class="modal-footer">
            ${inEdit ? html`
              <button type="button" class="btn-delete" @click=${this._delete}>
                <i class="fa-solid fa-trash"></i> Verwijderen
              </button>
              <button type="button" class="btn-cancel-edit" @click=${() => { this._resetEditState(); this._modalMode = 'view'; }}>
                Annuleer
              </button>
              <button type="button" class="btn-save" ?disabled=${this._saving} @click=${(e: Event) => this._saveEdit(e)}>
                <i class="fa-solid fa-${this._saving ? 'spinner fa-spin' : 'floppy-disk'}"></i>
                Opslaan
              </button>
            ` : html`
              <button type="button" class="btn-cancel-edit" @click=${this._closeModal}>
                Sluiten
              </button>
              ${this._project?.group_id ? html`
                <button type="button" class="btn-cancel-edit" @click=${this._offerTask}>
                  <i class="fa-solid fa-handshake"></i> Offeren
                </button>
              ` : ''}
              <button type="button" class="btn-edit-modal" @click=${() => { this._resetEditState(); this._modalMode = 'edit'; }}>
                <i class="fa-solid fa-pen"></i> Bewerken
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  private _onRowClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.check-btn') || target.closest('.edit-btn')) return;
    this._openModal('view');
  }

  render() {
    if (this.hideRow) return this._renderModal();

    const isDone = this.task.status === 'done';
    const due = this._formatDue(this.task.due_date);

    return html`
      <div class="task-row ${this._done ? 'done-anim' : ''}" @click=${this._onRowClick}>
        <button class="check-btn ${this._completing ? 'completing' : ''} ${isDone ? 'done' : ''}"
          @click=${this._complete}
          title=${isDone ? 'Markeer als te doen' : 'Markeer als klaar'}>
          <i class="fa-solid fa-check"></i>
        </button>

        <span class="priority-dot p-${this.task.priority}"></span>

        <span class="task-title ${isDone ? 'done-text' : ''}">${this.task.title}</span>
        <span class="detail-chip" style="font-size:10px">${this.task.point_value} pt</span>

        <span class="task-meta">
          ${this.task.category_name ? html`
            <span class="category-chip"
              style=${`background:${this.task.category_color ?? '#a855f7'}22;border-color:${this.task.category_color ?? '#a855f7'};color:${this.task.category_color ?? '#c4a1ff'}`}
              title=${this.task.category_name}>
              ${this.task.category_name}
            </span>
          ` : ''}
          ${this.task.assignee_name ? html`
            <span class="assignee-chip" title=${`Toegewezen aan ${this.task.assignee_name}`}>
              ${this.task.assignee_name.slice(0, 1)}
            </span>
          ` : ''}
          ${this.task.notes ? html`<i class="fa-solid fa-align-left meta-icon" title="Heeft notities"></i>` : ''}
          ${this.task.recurring_rule ? html`<i class="fa-solid fa-repeat meta-icon" title=${describeRule(this.task.recurring_rule)}></i>` : ''}
          ${due ? html`
            <span class="due-date ${due.overdue ? 'overdue' : ''}">
              <i class="fa-solid fa-${due.overdue ? 'triangle-exclamation' : 'clock'}"></i>
              ${due.label}
            </span>
          ` : ''}
        </span>

        <button class="edit-btn" @click=${() => this._openModal('edit')} title="Bewerken">
          <i class="fa-solid fa-pen"></i>
        </button>
      </div>
      ${this._renderModal()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-task': DoenTask; }
}
