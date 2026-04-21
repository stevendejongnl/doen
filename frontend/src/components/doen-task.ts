import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  GroupMember,
  Project,
  Task,
  TaskPriority,
  RecurringRule,
  RecurrenceUnit,
  RecurrenceParity,
} from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from './doen-toast';
import { sharedStyles } from '../styles/shared-styles';

const DAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

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
  @state() private _members: GroupMember[] = [];
  @state() private _saving = false;

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
      transition: background 220ms ease-out, opacity 220ms ease-out, transform 220ms ease-out;
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
      transition: border-color 120ms, background 120ms, transform 120ms;
      padding: 0;
      color: #10b981;
    }

    .check-btn:hover { border-color: #10b981; transform: scale(1.1); }
    .check-btn.completing { border-color: #10b981; background: rgba(16,185,129,0.15); }
    .check-btn i { font-size: 10px; opacity: 0; transition: opacity 120ms; }
    .check-btn.completing i { opacity: 1; }

    .priority-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .p-none { background: rgba(255,255,255,0.22); }
    .p-low  { background: #10b981; }
    .p-medium { background: #f59e0b; }
    .p-high { background: #ef4444; box-shadow: 0 0 6px #ef4444; }

    .task-title {
      flex: 1; font-size: 13px; color: #e8eaf0;
      line-height: 1.4; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .task-title.done-text { text-decoration: line-through; opacity: 0.38; }

    .due-date {
      font-size: 11px; color: rgba(232,234,240,0.45);
      white-space: nowrap; display: flex; align-items: center; gap: 4px; flex-shrink: 0;
    }
    .due-date.overdue { color: #ef4444; }
    .due-date i { font-size: 9px; }

    .task-meta {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }

    .meta-icon {
      font-size: 10px; color: rgba(232,234,240,0.35);
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

    .task-row { cursor: pointer; }

    .edit-btn {
      width: 28px; height: 28px;
      border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; color: rgba(232,234,240,0.4);
      transition: background 120ms, color 120ms;
      flex-shrink: 0;
      opacity: 0;
    }
    .task-row:hover .edit-btn { opacity: 1; }
    .edit-btn:hover { background: rgba(255,255,255,0.1); color: #e8eaf0; }

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
      max-height: calc(100vh - 40px);
      background: rgba(30, 36, 54, 0.92);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
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
      font-size: 15px; font-weight: 600; color: #e8eaf0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .modal-close {
      width: 30px; height: 30px;
      border-radius: 8px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(232,234,240,0.7);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 120ms, color 120ms;
    }
    .modal-close:hover { background: rgba(255,255,255,0.12); color: #e8eaf0; }
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
      color: rgba(232,234,240,0.55);
      font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.04em; padding-top: 2px;
    }
    .detail-value {
      color: #e8eaf0;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      min-width: 0;
    }
    .detail-value.muted { color: rgba(232,234,240,0.4); font-style: italic; }
    .detail-notes {
      color: #e8eaf0;
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
    .detail-chip.overdue { color: #ef4444; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }
    .detail-chip.done { color: #10b981; border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.08); }

    .btn-edit-modal {
      background: #6366f1; color: white; border: none;
      border-radius: 8px; padding: 8px 16px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background 120ms;
      display: flex; align-items: center; gap: 6px;
    }
    .btn-edit-modal:hover { background: #818cf8; }

    /* Edit form (inside modal) */
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .edit-row { display: flex; gap: 8px; flex-wrap: wrap; }

    input, select, textarea {
      font: inherit;
      color: #e8eaf0;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      padding: 8px 12px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      transition: border-color 120ms, background 120ms;
    }

    input:focus, select:focus, textarea:focus {
      border-color: #6366f1;
      background: rgba(255,255,255,0.12);
    }

    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
    select option { background: #1e2436; color: #e8eaf0; }

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
      background: #6366f1; color: white; border: none;
      border-radius: 8px; padding: 7px 16px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      transition: background 120ms;
      display: flex; align-items: center; gap: 6px;
    }
    .btn-save:hover { background: #818cf8; }
    .btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-cancel-edit {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(232,234,240,0.6);
      border-radius: 8px; padding: 7px 12px;
      font-size: 12px; cursor: pointer;
      transition: background 120ms;
    }
    .btn-cancel-edit:hover { background: rgba(255,255,255,0.12); }

    .btn-delete {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.2);
      color: #ef4444;
      border-radius: 8px; padding: 7px 12px;
      font-size: 12px; cursor: pointer;
      transition: background 120ms;
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
      font-size: 12px; color: rgba(232,234,240,0.6);
      cursor: pointer; user-select: none;
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
    .toggle input:checked ~ .toggle-track { background: #6366f1; }
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
      font-size: 12px; color: rgba(232,234,240,0.7);
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
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.14);
      color: rgba(232,234,240,0.6);
      cursor: pointer;
      user-select: none;
      transition: background 120ms, border-color 120ms, color 120ms;
    }
    .weekday-chip.active {
      background: rgba(99,102,241,0.28);
      border-color: #6366f1;
      color: #e8eaf0;
    }
    .weekday-chip:hover { border-color: rgba(255,255,255,0.28); }

    .rb-preview {
      font-size: 11px; color: rgba(232,234,240,0.55);
      font-style: italic;
    }
  `];

  private async _complete() {
    if (this._completing || this.task.status === 'done') return;
    this._completing = true;
    const prevStatus = this.task.status;
    this.task = { ...this.task, status: 'done' };
    try {
      await api.post(`/tasks/${this.task.id}/complete`, {});
      setTimeout(() => { this._done = true; }, 280);
      toast.success('Gedaan!');
    } catch (e) {
      this.task = { ...this.task, status: prevStatus };
      this._completing = false;
      if (e instanceof ApiError) toast.error(`Mislukt: ${e.message}`);
    }
  }

  private _resetEditState() {
    this._editTitle = this.task.title;
    this._editPriority = this.task.priority as TaskPriority;
    this._editDue = this.task.due_date ? this.task.due_date.substring(0, 10) : '';
    this._editNotes = this.task.notes ?? '';
    this._editAssignee = this.task.assignee_id ?? '';

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
      if (project.group_id) {
        this._members = await api.get<GroupMember[]>(`/groups/${project.group_id}/members`);
      } else {
        this._members = [];
      }
    } catch {
      this._members = [];
    }
  }

  private async _openModal(mode: 'view' | 'edit' = 'view') {
    this._resetEditState();
    this._modalMode = mode;
    this._modalOpen = true;
    await this._loadMembers();
  }

  private _closeModal = () => {
    this._modalOpen = false;
    this._modalMode = 'view';
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

  private async _delete() {
    if (!confirm(`"${this.task.title}" verwijderen?`)) return;
    try {
      await api.delete(`/tasks/${this.task.id}`);
      this._done = true;
      this._closeModal();
      this.dispatchEvent(new CustomEvent('task-deleted', { detail: this.task.id, bubbles: true, composed: true }));
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Verwijderen mislukt: ${e.message}`);
    }
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
            <select .value=${this._editAssignee}
              @change=${(e: Event) => this._editAssignee = (e.target as HTMLSelectElement).value}>
              <option value="">Niemand toegewezen</option>
              ${this._members.map(m => html`
                <option value=${m.user_id}>${m.name}</option>
              `)}
            </select>
          ` : ''}
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
              <input type="time"
                .value=${this._editTimeOfDay}
                @input=${(e: Event) => this._editTimeOfDay = (e.target as HTMLInputElement).value || '08:00'}
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
              ? html`<span class="detail-chip done"><i class="fa-solid fa-check"></i> Klaar</span>`
              : html`<span class="detail-chip"><i class="fa-regular fa-circle"></i> Open</span>`}
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
              <button type="button" class="btn-edit-modal" @click=${() => this._modalMode = 'edit'}>
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
    const isDone = this.task.status === 'done';
    const due = this._formatDue(this.task.due_date);

    return html`
      <div class="task-row ${this._done ? 'done-anim' : ''}" @click=${this._onRowClick}>
        <button class="check-btn ${this._completing ? 'completing' : ''}"
          @click=${this._complete} title="Markeer als klaar">
          <i class="fa-solid fa-check"></i>
        </button>

        <span class="priority-dot p-${this.task.priority}"></span>

        <span class="task-title ${isDone ? 'done-text' : ''}">${this.task.title}</span>

        <span class="task-meta">
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
