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
    :host {
      display: block;
    }

    .task-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      transition: background 220ms ease-out, transform 220ms ease-out, opacity 220ms ease-out;
      cursor: default;
    }

    .task-row:hover {
      background: rgba(255,255,255,0.07);
    }

    .task-row.done {
      opacity: 0;
      transform: translateX(20px);
      pointer-events: none;
    }

    .check-btn {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.25);
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: border-color 120ms ease-out, background 120ms ease-out;
      padding: 0;
    }

    .check-btn:hover {
      border-color: #10b981;
    }

    .check-btn.completing {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.15);
      animation: pulse 600ms ease-in-out;
    }

    .checkmark {
      stroke-dasharray: 20;
      stroke-dashoffset: 20;
      transition: stroke-dashoffset 300ms ease-out;
    }

    .check-btn.completing .checkmark {
      stroke-dashoffset: 0;
    }

    .task-title {
      flex: 1;
      font-size: 13px;
      color: #e8eaf0;
      line-height: 1.4;
    }

    .task-title.done-text {
      text-decoration: line-through;
      opacity: 0.4;
    }

    .priority-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .priority-none { background: rgba(255,255,255,0.2); }
    .priority-low  { background: #10b981; }
    .priority-medium { background: #f59e0b; }
    .priority-high { background: #ef4444; }

    .due-date {
      font-size: 11px;
      color: rgba(232, 234, 240, 0.45);
      white-space: nowrap;
    }

    .due-date.overdue {
      color: #ef4444;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }
  `;

  private async _complete() {
    if (this._completing || this.task.status === 'done') return;
    this._completing = true;

    // Optimistic
    const prevStatus = this.task.status;
    this.task = { ...this.task, status: 'done' };

    try {
      await api.post(`/tasks/${this.task.id}/complete`, {});
      setTimeout(() => { this._done = true; }, 300);
      toast.success('Gedaan! Henk zou trots zijn. 🧹');
    } catch (e) {
      this.task = { ...this.task, status: prevStatus };
      this._completing = false;
      if (e instanceof ApiError) toast.error(`Mislukt: ${e.message}`);
    }
  }

  private _formatDue(due?: string): { label: string; overdue: boolean } | null {
    if (!due) return null;
    const d = new Date(due);
    const now = new Date();
    const overdue = d < now && this.task.status !== 'done';
    const label = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    return { label, overdue };
  }

  render() {
    const isDone = this.task.status === 'done';
    const due = this._formatDue(this.task.due_date);

    return html`
      <div class="task-row ${this._done ? 'done' : ''}">
        <button
          class="check-btn ${this._completing ? 'completing' : ''}"
          @click=${this._complete}
          title="Markeer als klaar"
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <polyline
              class="checkmark"
              points="1,4 4,7 9,1"
              stroke="#10b981"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <span class="priority-dot priority-${this.task.priority}"></span>

        <span class="task-title ${isDone ? 'done-text' : ''}">${this.task.title}</span>

        ${due ? html`
          <span class="due-date ${due.overdue ? 'overdue' : ''}">${due.label}</span>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'doen-task': DoenTask;
  }
}
