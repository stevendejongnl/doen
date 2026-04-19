import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Task } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from './doen-toast';

@customElement('doen-task')
export class DoenTask extends LitElement {
  @property({ type: Object }) task!: Task;
  @state() private _completing = false;
  @state() private _done = false;

  static styles = css`
    :host { display: block; }

    .task-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 12px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: background var(--transition-smooth), transform var(--transition-smooth), opacity var(--transition-smooth), border-color var(--transition-fast);
    }

    .task-row:hover {
      background: var(--glass-bg-raised);
      border-color: rgba(255,255,255,0.18);
    }

    .task-row.done-anim {
      opacity: 0;
      transform: translateX(16px);
      pointer-events: none;
    }

    .check-btn {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.22);
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
      padding: 0;
    }

    .check-btn:hover { border-color: var(--color-success); transform: scale(1.1); }

    .check-btn.completing {
      border-color: var(--color-success);
      background: rgba(16,185,129,0.15);
    }

    .check-btn i {
      font-size: 10px;
      color: var(--color-success);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .check-btn.completing i { opacity: 1; }

    .priority-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .p-none { background: var(--color-priority-none); }
    .p-low  { background: var(--color-priority-low); }
    .p-medium { background: var(--color-priority-medium); }
    .p-high { background: var(--color-priority-high); box-shadow: 0 0 6px var(--color-priority-high); }

    .task-title {
      flex: 1;
      font-size: 13px;
      color: var(--color-text);
      line-height: 1.4;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-title.done-text {
      text-decoration: line-through;
      opacity: 0.38;
    }

    .due-date {
      font-size: 11px;
      color: var(--color-text-muted);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .due-date.overdue {
      color: var(--color-danger);
    }

    .due-date i { font-size: 9px; }
  `;

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

  private _formatDue(due?: string | null): { label: string; overdue: boolean } | null {
    if (!due) return null;
    const d = new Date(due);
    const overdue = d < new Date() && this.task.status !== 'done';
    return { label: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }), overdue };
  }

  render() {
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
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-task': DoenTask; }
}
