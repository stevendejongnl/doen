import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Task, TaskStatus } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import '../components/doen-task';

interface Column {
  id: TaskStatus;
  label: string;
  icon: string;
  accent: string;
}

const COLUMNS: Column[] = [
  { id: 'todo',        label: 'Te doen', icon: 'fa-circle',        accent: 'rgba(232,234,240,0.5)' },
  { id: 'in_progress', label: 'Bezig',   icon: 'fa-spinner',       accent: '#f59e0b' },
  { id: 'done',        label: 'Klaar',   icon: 'fa-circle-check',  accent: '#10b981' },
];

@customElement('doen-view-kanban')
export class DoenViewKanban extends LitElement {
  @property({ type: Array }) tasks: Task[] = [];
  @state() private _dragId: string | null = null;
  @state() private _dropCol: TaskStatus | null = null;
  @state() private _openTaskId: string | null = null;

  static styles = [...sharedStyles, css`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }

    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      height: 100%;
      overflow: hidden;
    }

    .col {
      display: flex;
      flex-direction: column;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: var(--radius-card);
      overflow: hidden;
      transition: border-color 140ms, background 140ms;
    }
    .col.drop-target {
      border-color: rgba(99,102,241,0.6);
      background: rgba(99,102,241,0.06);
    }

    .col-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: var(--color-text-muted);
    }
    .col-head .count {
      margin-left: auto;
      background: rgba(255,255,255,0.08);
      border-radius: 999px;
      padding: 1px 8px;
      font-size: 10px;
      font-weight: 600;
      color: var(--color-text-muted);
    }

    .col-body {
      flex: 1;
      overflow-y: auto;
      padding: 6px 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .empty {
      color: var(--color-text-muted);
      font-size: 12px;
      padding: 20px 10px;
      text-align: center;
      font-style: italic;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-left: 3px solid var(--accent, rgba(255,255,255,0.2));
      border-radius: var(--radius-btn);
      cursor: grab;
      transition: background 120ms, transform 140ms, opacity 140ms;
    }
    .card:hover { background: rgba(255,255,255,0.1); }
    .card:active { cursor: grabbing; }
    .card.dragging { opacity: 0.4; transform: scale(0.98); }
    .card.done .card-title { text-decoration: line-through; opacity: 0.55; }

    .card-title {
      font-size: 13px;
      color: var(--color-text);
      line-height: 1.35;
      word-break: break-word;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .card-meta i { font-size: 10px; }
    .card-meta .overdue { color: var(--color-danger); }

    .assignee-chip {
      width: 20px; height: 20px;
      border-radius: 50%;
      background: rgba(99,102,241,0.3);
      border: 1px solid rgba(99,102,241,0.5);
      color: var(--color-text);
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      text-transform: uppercase;
      margin-left: auto;
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      :host { overflow-y: auto; }
      .board {
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
        height: auto;
        overflow: visible;
      }
      .col { overflow: visible; }
      .col-body { overflow-y: visible; padding: 6px 10px 14px; }
    }
  `];

  private _byStatus(status: TaskStatus): Task[] {
    return this.tasks
      .filter(t => t.status === status)
      .sort((a, b) => {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      });
  }

  private async _move(taskId: string, target: TaskStatus) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || task.status === target) return;

    // Optimistic local update via parent's updateTask() event
    const updated: Task = { ...task, status: target };
    this.dispatchEvent(new CustomEvent('task-updated', {
      detail: updated, bubbles: true, composed: true,
    }));

    try {
      if (target === 'done') {
        await api.post(`/tasks/${taskId}/complete`, {});
      } else {
        await api.put(`/tasks/${taskId}`, { status: target });
      }
    } catch (e) {
      // Revert on failure
      this.dispatchEvent(new CustomEvent('task-updated', {
        detail: task, bubbles: true, composed: true,
      }));
      if (e instanceof ApiError) toast.error(`Verplaatsen mislukt: ${e.message}`);
    }
  }

  private _onDragStart(e: DragEvent, id: string) {
    this._dragId = id;
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  private _onDragEnd() {
    this._dragId = null;
    this._dropCol = null;
  }

  private _onColDragOver(e: DragEvent, col: TaskStatus) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (this._dropCol !== col) this._dropCol = col;
  }

  private _onColDragLeave(col: TaskStatus) {
    if (this._dropCol === col) this._dropCol = null;
  }

  private _onColDrop(e: DragEvent, col: TaskStatus) {
    e.preventDefault();
    const id = this._dragId ?? e.dataTransfer?.getData('text/plain') ?? null;
    this._dropCol = null;
    this._dragId = null;
    if (id) this._move(id, col);
  }

  private _openCard(id: string) {
    this._openTaskId = id;
  }

  private _closeCard = () => {
    this._openTaskId = null;
  };

  private _formatDue(due: string): { label: string; overdue: boolean } {
    const d = new Date(due);
    const now = new Date();
    return {
      label: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      overdue: d < now,
    };
  }

  private _renderCardBody(task: Task) {
    const due = task.due_date ? this._formatDue(task.due_date) : null;
    return html`
      <div class="card-title">${task.title}</div>
      <div class="card-meta">
        ${due ? html`
          <span class=${due.overdue ? 'overdue' : ''}>
            <i class="fa-solid fa-clock"></i> ${due.label}
          </span>
        ` : ''}
        ${task.notes ? html`<i class="fa-solid fa-align-left" title="Heeft notities"></i>` : ''}
        ${task.recurring_rule ? html`<i class="fa-solid fa-repeat" title="Herhaalt"></i>` : ''}
        ${task.assignee_name ? html`
          <span class="assignee-chip" title=${task.assignee_name}>
            ${task.assignee_name.slice(0, 1)}
          </span>
        ` : ''}
      </div>
    `;
  }

  private _accentFor(t: Task): string {
    switch (t.priority) {
      case 'high':   return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low':    return '#10b981';
      default:       return 'rgba(255,255,255,0.2)';
    }
  }

  private _renderCard(t: Task) {
    return html`
      <div class="card ${this._dragId === t.id ? 'dragging' : ''} ${t.status === 'done' ? 'done' : ''}"
        style=${`--accent:${this._accentFor(t)}`}
        draggable="true"
        @dragstart=${(e: DragEvent) => this._onDragStart(e, t.id)}
        @dragend=${this._onDragEnd}
        @click=${() => this._openCard(t.id)}
      >
        ${this._renderCardBody(t)}
      </div>
    `;
  }

  render() {
    const openTask = this._openTaskId
      ? this.tasks.find(t => t.id === this._openTaskId)
      : null;

    return html`
      <div class="board">
        ${COLUMNS.map(col => {
          const tasks = this._byStatus(col.id);
          return html`
            <div class="col ${this._dropCol === col.id ? 'drop-target' : ''}"
              @dragover=${(e: DragEvent) => this._onColDragOver(e, col.id)}
              @dragleave=${() => this._onColDragLeave(col.id)}
              @drop=${(e: DragEvent) => this._onColDrop(e, col.id)}
            >
              <div class="col-head" style=${`color:${col.accent}`}>
                <i class="fa-solid ${col.icon}"></i>
                ${col.label}
                <span class="count">${tasks.length}</span>
              </div>
              <div class="col-body">
                ${tasks.length === 0
                  ? html`<div class="empty">Leeg</div>`
                  : tasks.map(t => this._renderCard(t))}
              </div>
            </div>
          `;
        })}
      </div>
      ${openTask ? html`
        <doen-task
          .task=${openTask}
          .hideRow=${true}
          .autoOpen=${true}
          @modal-closed=${this._closeCard}
          @task-deleted=${this._closeCard}
        ></doen-task>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-view-kanban': DoenViewKanban; }
}
