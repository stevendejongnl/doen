import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Project, Task } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import '../components/doen-task';
import '../components/doen-task-form';

@customElement('page-project')
export class PageProject extends LitElement {
  @property({ type: String }) projectId!: string;
  @state() private _project: Project | null = null;
  @state() private _tasks: Task[] = [];
  @state() private _loading = true;
  @state() private _showDone = false;

  static styles = css`
    :host { display: block; padding: 28px 32px; overflow-y: auto; height: 100%; }

    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 28px;
    }

    .color-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #e8eaf0;
      flex: 1;
    }

    .toggle-done {
      font-size: 12px;
      color: rgba(232,234,240,0.4);
      cursor: pointer;
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      transition: color 120ms, background 120ms;
    }

    .toggle-done:hover { color: #e8eaf0; background: rgba(255,255,255,0.08); }

    .task-form-wrap {
      margin-bottom: 20px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 14px;
    }

    .task-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: rgba(232,234,240,0.3);
      margin: 16px 0 6px;
    }

    .empty {
      padding: 32px;
      text-align: center;
      color: rgba(232,234,240,0.3);
      font-size: 13px;
    }

    /* Skeleton */
    .sk-title {
      height: 22px;
      width: 40%;
      border-radius: 6px;
      background: rgba(255,255,255,0.08);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
      background-size: 200% 100%;
    }

    .sk-task {
      height: 42px;
      border-radius: 10px;
      margin-bottom: 4px;
      background: rgba(255,255,255,0.05);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
      background-size: 200% 100%;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;

  updated(changed: Map<string, unknown>) {
    if (changed.has('projectId') && this.projectId) {
      this._load();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.projectId) this._load();
    this.addEventListener('task-created', this._onTaskCreated as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('task-created', this._onTaskCreated as EventListener);
  }

  private async _load() {
    this._loading = true;
    try {
      const [project, tasks] = await Promise.all([
        api.get<Project>(`/projects/${this.projectId}`),
        api.get<Task[]>(`/projects/${this.projectId}/tasks`),
      ]);
      this._project = project;
      this._tasks = tasks;
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Laden mislukt: ${e.message}`);
    } finally {
      this._loading = false;
    }
  }

  private _onTaskCreated = (e: CustomEvent<Task>) => {
    this._tasks = [e.detail, ...this._tasks];
  };

  updateTask(updated: Task) {
    this._tasks = this._tasks.map(t => t.id === updated.id ? updated : t);
  }

  removeTask(id: string) {
    this._tasks = this._tasks.filter(t => t.id !== id);
  }

  private _active() { return this._tasks.filter(t => t.status !== 'done'); }
  private _done() { return this._tasks.filter(t => t.status === 'done'); }

  render() {
    if (this._loading) {
      return html`
        <div class="header">
          <div class="sk-title"></div>
        </div>
        ${[1,2,3,4].map(() => html`<div class="sk-task"></div>`)}
      `;
    }

    if (!this._project) return html`<div class="empty">Project niet gevonden.</div>`;

    const active = this._active();
    const done = this._done();

    return html`
      <div class="header">
        <div class="color-dot" style="background:${this._project.color}"></div>
        <h1>${this._project.name}</h1>
        ${done.length > 0 ? html`
          <button class="toggle-done" @click=${() => this._showDone = !this._showDone}>
            ${this._showDone ? 'Verberg' : 'Toon'} ${done.length} gedaan
          </button>
        ` : ''}
      </div>

      <div class="task-form-wrap">
        <doen-task-form .project=${this._project}></doen-task-form>
      </div>

      <div class="task-list">
        ${active.length === 0 && done.length === 0 ? html`
          <div class="empty">Geen taken. Geniet ervan, het duurt niet lang. 🍺</div>
        ` : ''}

        ${active.map(t => html`<doen-task .task=${t}></doen-task>`)}

        ${this._showDone && done.length > 0 ? html`
          <div class="section-label">Afgerond (${done.length})</div>
          ${done.map(t => html`<doen-task .task=${t}></doen-task>`)}
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-project': PageProject;
  }
}
