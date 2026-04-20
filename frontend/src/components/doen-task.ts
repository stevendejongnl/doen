import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Task, TaskPriority } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from './doen-toast';
import { sharedStyles } from '../styles/shared-styles';

@customElement('doen-task')
export class DoenTask extends LitElement {
  @property({ type: Object }) task!: Task;
  @state() private _completing = false;
  @state() private _done = false;
  @state() private _editing = false;
  @state() private _editTitle = '';
  @state() private _editPriority: TaskPriority = 'none';
  @state() private _editDue = '';
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

    /* Inline edit form */
    .edit-form {
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(99,102,241,0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .edit-row { display: flex; gap: 8px; flex-wrap: wrap; }

    input, select {
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

    input:focus, select:focus {
      border-color: #6366f1;
      background: rgba(255,255,255,0.12);
    }

    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
    select option { background: #1e2436; color: #e8eaf0; }

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

  private _startEdit() {
    this._editTitle = this.task.title;
    this._editPriority = this.task.priority as TaskPriority;
    this._editDue = this.task.due_date ? this.task.due_date.substring(0, 10) : '';
    this._editing = true;
  }

  private async _saveEdit(e: Event) {
    e.preventDefault();
    if (!this._editTitle.trim() || this._saving) return;
    this._saving = true;
    try {
      const updated = await api.patch<Task>(`/tasks/${this.task.id}`, {
        title: this._editTitle.trim(),
        priority: this._editPriority,
        due_date: this._editDue ? new Date(this._editDue).toISOString() : null,
      });
      this.task = updated;
      this._editing = false;
      this.dispatchEvent(new CustomEvent('task-updated', { detail: updated, bubbles: true, composed: true }));
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

  render() {
    if (this._editing) {
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
          </div>
          <div class="edit-actions">
            <button type="button" class="btn-delete" @click=${this._delete}>
              <i class="fa-solid fa-trash"></i> Verwijderen
            </button>
            <button type="button" class="btn-cancel-edit" @click=${() => this._editing = false}>
              Annuleer
            </button>
            <button type="submit" class="btn-save" ?disabled=${this._saving}>
              <i class="fa-solid fa-${this._saving ? 'spinner fa-spin' : 'floppy-disk'}"></i>
              Opslaan
            </button>
          </div>
        </form>
      `;
    }

    const isDone = this.task.status === 'done';
    const due = this._formatDue(this.task.due_date);

    return html`
      <div class="task-row ${this._done ? 'done-anim' : ''}">
        <button class="check-btn ${this._completing ? 'completing' : ''}"
          @click=${this._complete} title="Markeer als klaar">
          <i class="fa-solid fa-check"></i>
        </button>

        <span class="priority-dot p-${this.task.priority}"></span>

        <span class="task-title ${isDone ? 'done-text' : ''}">${this.task.title}</span>

        ${due ? html`
          <span class="due-date ${due.overdue ? 'overdue' : ''}">
            <i class="fa-solid fa-${due.overdue ? 'triangle-exclamation' : 'clock'}"></i>
            ${due.label}
          </span>
        ` : ''}

        <button class="edit-btn" @click=${this._startEdit} title="Bewerken">
          <i class="fa-solid fa-pen"></i>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-task': DoenTask; }
}
