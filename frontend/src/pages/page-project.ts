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
  @state() private _editing = false;
  @state() private _editName = '';
  @state() private _editColor = '';
  @state() private _saving = false;

  private static readonly COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
  ];

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

    .edit-btn {
      font-size: 13px;
      color: var(--color-text-muted);
      padding: 6px 10px;
      border-radius: 8px;
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
      flex-shrink: 0;
    }
    .edit-btn:hover { color: var(--color-text); background: var(--glass-bg); border-color: var(--glass-border); }

    .edit-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }

    .edit-row input[type="text"] {
      font: inherit;
      font-size: 20px;
      font-weight: 700;
      color: var(--color-text);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 10px;
      padding: 8px 12px;
      outline: none;
      width: 100%;
    }
    .edit-row input[type="text"]:focus { border-color: #6366f1; }

    .edit-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

    .swatches { display: flex; gap: 6px; flex-wrap: wrap; }
    .swatch {
      width: 22px; height: 22px; border-radius: 50%;
      cursor: pointer; border: 2px solid transparent;
      transition: transform 120ms, border-color 120ms;
    }
    .swatch:hover { transform: scale(1.1); }
    .swatch.active { border-color: #fff; }

    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 8px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      border: none;
    }
    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #818cf8; }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-ghost {
      background: transparent; color: var(--color-text-muted);
      border: 1px solid var(--glass-border);
    }
    .btn-ghost:hover { color: var(--color-text); background: var(--glass-bg); }

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

  addTask(task: Task) {
    if (task.project_id === this.projectId && !this._tasks.find(t => t.id === task.id)) {
      this._tasks = [task, ...this._tasks];
    }
  }

  updateTask(updated: Task) {
    this._tasks = this._tasks.map(t => t.id === updated.id ? updated : t);
  }

  removeTask(id: string) {
    this._tasks = this._tasks.filter(t => t.id !== id);
  }

  private _active() { return this._tasks.filter(t => t.status !== 'done'); }
  private _done() { return this._tasks.filter(t => t.status === 'done'); }

  private _startEdit() {
    if (!this._project) return;
    this._editName = this._project.name;
    this._editColor = this._project.color;
    this._editing = true;
  }

  private _cancelEdit() {
    this._editing = false;
  }

  private async _saveEdit() {
    if (!this._project) return;
    const name = this._editName.trim();
    if (!name || this._saving) return;

    const nameChanged = name !== this._project.name;
    const colorChanged = this._editColor !== this._project.color;
    if (!nameChanged && !colorChanged) {
      this._editing = false;
      return;
    }

    this._saving = true;
    try {
      const updated = await api.put<Project>(`/projects/${this._project.id}`, {
        name,
        color: this._editColor,
      });
      this._project = updated;
      this._editing = false;
      this.dispatchEvent(new CustomEvent('project-created', { bubbles: true, composed: true }));
      toast.success('Project bijgewerkt');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Opslaan mislukt: ${e.message}`);
    } finally {
      this._saving = false;
    }
  }

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
        ${this._editing ? html`
          <div class="color-dot" style="background:${this._editColor};color:${this._editColor}"></div>
          <div class="edit-row">
            <input type="text" .value=${this._editName}
              @input=${(e: Event) => this._editName = (e.target as HTMLInputElement).value}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') this._saveEdit();
                if (e.key === 'Escape') this._cancelEdit();
              }}
              placeholder="Projectnaam"
            />
            <div class="edit-actions">
              <div class="swatches">
                ${PageProject.COLORS.map(c => html`
                  <div class="swatch ${c === this._editColor ? 'active' : ''}"
                    style="background:${c}"
                    @click=${() => this._editColor = c}
                  ></div>
                `)}
              </div>
              <button class="btn btn-primary"
                ?disabled=${this._saving || !this._editName.trim()}
                @click=${this._saveEdit}>
                <i class="fa-solid fa-${this._saving ? 'spinner fa-spin' : 'check'}"></i>
                Opslaan
              </button>
              <button class="btn btn-ghost" @click=${this._cancelEdit}>
                Annuleren
              </button>
            </div>
          </div>
        ` : html`
          <div class="color-dot" style="background:${this._project.color};color:${this._project.color}"></div>
          <h1>${this._project.name}</h1>
          <button class="edit-btn" title="Project bewerken" @click=${this._startEdit}>
            <i class="fa-solid fa-pen"></i>
          </button>
          ${done.length > 0 ? html`
            <button class="toggle-done" @click=${() => this._showDone = !this._showDone}>
              <i class="fa-solid fa-${this._showDone ? 'eye-slash' : 'eye'}"></i>
              ${done.length} gedaan
            </button>
          ` : ''}
        `}
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
