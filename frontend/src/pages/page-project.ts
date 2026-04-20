import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Project, Task } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import '../components/doen-task';
import '../components/doen-task-form';

@customElement('page-project')
export class PageProject extends LitElement {
  @property({ type: String }) projectId!: string;
  @state() private _project: Project | null = null;
  @state() private _tasks: Task[] = [];
  @state() private _loading = true;
  @state() private _showDone = false;

  static styles = [...sharedStyles, css`
    :host { display: block; overflow-y: auto; height: 100%; }

    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
    }

    .color-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 10px currentColor;
    }

    h1 {
      font-size: 24px;
      font-weight: 800;
      color: var(--color-text);
      flex: 1;
      letter-spacing: -0.5px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .toggle-done {
      font-size: 12px;
      color: var(--color-text-muted);
      padding: 5px 12px;
      border-radius: 8px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      transition: color var(--transition-fast), background var(--transition-fast);
      white-space: nowrap;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .toggle-done:hover { color: var(--color-text); background: var(--glass-bg-raised); }

    .add-card {
      margin-bottom: 20px;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-card);
      padding: 16px 18px;
      box-shadow: var(--glass-shadow);
    }

    .task-list { display: flex; flex-direction: column; gap: 5px; }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: var(--color-text-muted);
      margin: 16px 0 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .empty-state {
      padding: 40px;
      text-align: center;
      color: var(--color-text-muted);
    }

    .empty-state i {
      font-size: 30px;
      opacity: 0.2;
      display: block;
      margin-bottom: 12px;
    }

    /* Skeleton */
    .sk-title {
      height: 24px; width: 38%;
      border-radius: 8px;
      background: var(--glass-bg);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: var(--shimmer);
      background-size: 200% 100%;
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
      h1 { font-size: 20px; }
    }
  `];

  updated(changed: Map<string, unknown>) {
    if (changed.has('projectId') && this.projectId) this._load();
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
        <div class="header"><div class="sk-title"></div></div>
        ${[1,2,3,4].map(() => html`<div class="sk-task"></div>`)}
      `;
    }

    if (!this._project) return html`<div class="empty-state">Project niet gevonden.</div>`;

    const active = this._active();
    const done = this._done();

    return html`
      <div class="header">
        <div class="color-dot" style="background:${this._project.color};color:${this._project.color}"></div>
        <h1>${this._project.name}</h1>
        ${done.length > 0 ? html`
          <button class="toggle-done" @click=${() => this._showDone = !this._showDone}>
            <i class="fa-solid fa-${this._showDone ? 'eye-slash' : 'eye'}"></i>
            ${done.length} gedaan
          </button>
        ` : ''}
      </div>

      <div class="add-card">
        <doen-task-form .project=${this._project}></doen-task-form>
      </div>

      <div class="task-list">
        ${active.length === 0 && done.length === 0 ? html`
          <div class="empty-state">
            <i class="fa-solid fa-clipboard-list"></i>
            Geen taken. Voeg er een toe hierboven.
          </div>
        ` : ''}

        ${active.map(t => html`<doen-task .task=${t}></doen-task>`)}

        ${this._showDone && done.length > 0 ? html`
          <div class="section-label">
            <i class="fa-solid fa-circle-check"></i>
            Afgerond (${done.length})
          </div>
          ${done.map(t => html`<doen-task .task=${t}></doen-task>`)}
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-project': PageProject; }
}
