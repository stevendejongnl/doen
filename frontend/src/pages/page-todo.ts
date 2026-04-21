import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Task } from '../services/types';
import type { UserPreferences } from '../services/auth';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import '../components/doen-task';
import '../views/doen-view-list';
import '../views/doen-view-kanban';
import '../views/doen-view-calendar';

type ViewMode = 'list' | 'kanban' | 'calendar';
type CalendarRange = 'day' | 'week' | 'month';

@customElement('page-todo')
export class PageTodo extends LitElement {
  @state() private _tasks: Task[] = [];
  @state() private _loading = true;
  @state() private _view: ViewMode = 'calendar';
  @state() private _range: CalendarRange = 'week';
  @state() private _anchor = new Date();

  static styles = [...sharedStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .title-block h1 {
      font-size: 24px;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 4px;
      letter-spacing: -0.5px;
    }
    .title-block .subtitle {
      font-size: 13px;
      color: var(--color-text-muted);
    }

    .switchers {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .seg {
      display: flex;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 3px;
      gap: 2px;
    }

    .seg button {
      background: transparent;
      border: none;
      color: rgba(232,234,240,0.55);
      font-size: 12px;
      font-weight: 500;
      padding: 6px 11px;
      border-radius: 7px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 120ms, color 120ms;
    }
    .seg button:hover { color: var(--color-text); }
    .seg button.active {
      background: rgba(99,102,241,0.28);
      color: var(--color-text);
    }
    .seg button i { font-size: 11px; }

    .nav-pill {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 3px;
    }
    .nav-pill button {
      background: transparent;
      border: none;
      color: rgba(232,234,240,0.6);
      width: 28px;
      height: 28px;
      border-radius: 7px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .nav-pill button:hover { background: rgba(255,255,255,0.08); color: var(--color-text); }
    .nav-pill .today-btn {
      padding: 0 10px;
      width: auto;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .view-container {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .sk-task {
      height: 44px;
      border-radius: 12px;
      margin-bottom: 5px;
      background: var(--glass-bg);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: var(--shimmer);
      background-size: 200% 100%;
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @media (max-width: 768px) {
      .title-block h1 { font-size: 20px; }
      .header { margin-bottom: 12px; }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._loadPreferences();
    this._loadTasks();
  }

  private async _loadPreferences() {
    try {
      const me = await api.get<{ preferences?: UserPreferences }>('/auth/me');
      const prefs = me.preferences ?? {};
      if (prefs.todo_view) this._view = prefs.todo_view;
      if (prefs.calendar_range) this._range = prefs.calendar_range;
    } catch { /* ignore — use defaults */ }
  }

  private async _savePreferences(patch: UserPreferences) {
    try {
      await api.put('/auth/me/preferences', { preferences: patch });
    } catch { /* silent — local state already updated */ }
  }

  private async _loadTasks() {
    this._loading = true;
    try {
      // Wide window: overdue anchor back 60d, forward 120d. Covers month/kanban/list.
      const from = new Date(); from.setDate(from.getDate() - 60); from.setHours(0, 0, 0, 0);
      const to = new Date(); to.setDate(to.getDate() + 120); to.setHours(0, 0, 0, 0);
      const qs = `date_from=${encodeURIComponent(from.toISOString())}&date_to=${encodeURIComponent(to.toISOString())}&include_unscheduled=true`;
      this._tasks = await api.get<Task[]>(`/tasks?${qs}`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Laden mislukt: ${e.message}`);
    } finally {
      this._loading = false;
    }
  }

  // SSE helpers — called from doen-app
  addTask(task: Task) {
    if (!this._tasks.find(t => t.id === task.id)) {
      this._tasks = [...this._tasks, task];
    }
  }
  updateTask(task: Task) {
    if (this._tasks.find(t => t.id === task.id)) {
      this._tasks = this._tasks.map(t => t.id === task.id ? task : t);
    } else {
      this.addTask(task);
    }
  }
  removeTask(id: string) {
    this._tasks = this._tasks.filter(t => t.id !== id);
  }

  private _setView(v: ViewMode) {
    if (this._view === v) return;
    this._view = v;
    this._savePreferences({ todo_view: v });
  }

  private _setRange(r: CalendarRange) {
    if (this._range === r) return;
    this._range = r;
    this._savePreferences({ calendar_range: r });
  }

  private _nudge(dir: -1 | 0 | 1) {
    if (dir === 0) { this._anchor = new Date(); return; }
    const d = new Date(this._anchor);
    if (this._range === 'day') d.setDate(d.getDate() + dir);
    else if (this._range === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    this._anchor = d;
  }

  private _renderHeader() {
    const label = new Date().toLocaleDateString('nl-NL', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    return html`
      <div class="header">
        <div class="title-block">
          <h1>Te doen</h1>
          <div class="subtitle">${label}</div>
        </div>
        <div class="switchers">
          ${this._view === 'calendar' ? html`
            <div class="nav-pill">
              <button title="Vorige" @click=${() => this._nudge(-1)}>
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              <button class="today-btn" @click=${() => this._nudge(0)}>Nu</button>
              <button title="Volgende" @click=${() => this._nudge(1)}>
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
            <div class="seg">
              <button class=${this._range === 'day' ? 'active' : ''} @click=${() => this._setRange('day')}>Dag</button>
              <button class=${this._range === 'week' ? 'active' : ''} @click=${() => this._setRange('week')}>Week</button>
              <button class=${this._range === 'month' ? 'active' : ''} @click=${() => this._setRange('month')}>Maand</button>
            </div>
          ` : ''}
          <div class="seg">
            <button class=${this._view === 'list' ? 'active' : ''} @click=${() => this._setView('list')}>
              <i class="fa-solid fa-list"></i> Lijst
            </button>
            <button class=${this._view === 'kanban' ? 'active' : ''} @click=${() => this._setView('kanban')}>
              <i class="fa-solid fa-columns"></i> Kanban
            </button>
            <button class=${this._view === 'calendar' ? 'active' : ''} @click=${() => this._setView('calendar')}>
              <i class="fa-solid fa-calendar"></i> Kalender
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderView() {
    if (this._loading) {
      return html`${[1, 2, 3, 4].map(() => html`<div class="sk-task"></div>`)}`;
    }
    if (this._view === 'list') {
      return html`<doen-view-list .tasks=${this._tasks}></doen-view-list>`;
    }
    if (this._view === 'kanban') {
      return html`<doen-view-kanban .tasks=${this._tasks}></doen-view-kanban>`;
    }
    return html`
      <doen-view-calendar
        .tasks=${this._tasks}
        .range=${this._range}
        .anchor=${this._anchor}
      ></doen-view-calendar>
    `;
  }

  render() {
    return html`
      ${this._renderHeader()}
      <div class="view-container"
        @task-deleted=${(e: CustomEvent<string>) => this.removeTask(e.detail)}
        @task-updated=${(e: CustomEvent<Task>) => this.updateTask(e.detail)}
      >
        ${this._renderView()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-todo': PageTodo; }
}
