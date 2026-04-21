import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Project, Group, User } from '../services/types';
import { api, logout } from '../services/api';
import { sharedStyles } from '../styles/shared-styles';

@customElement('doen-sidebar')
export class DoenSidebar extends LitElement {
  @property({ type: Object }) user!: User;
  @property({ type: String }) activeProjectId = '';
  @state() private _projects: Project[] = [];
  @state() private _groups: Group[] = [];
  @state() private _loading = true;
  @state() private _creatingIn: string | null = null; // 'personal' | group_id | null
  @state() private _newProjectName = '';

  static styles = [...sharedStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      width: var(--sidebar-width, 260px);
      height: 100%;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-right: 1px solid var(--glass-border);
      overflow-y: auto;
      flex-shrink: 0;
    }

    .header {
      padding: 20px 18px 14px;
      border-bottom: 1px solid var(--glass-border);
    }

    .app-name {
      font-size: 22px;
      font-weight: 800;
      color: var(--color-text);
      letter-spacing: -0.5px;
    }

    .app-tagline {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    nav { padding: 12px 10px; flex: 1; }

    .nav-section { margin-bottom: 24px; }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px;
      margin-bottom: 6px;
    }

    .section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--color-text-muted);
    }

    .add-project-btn {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: var(--color-text-muted);
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .add-project-btn:hover {
      background: var(--glass-bg-raised);
      color: var(--color-text);
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 9px;
      cursor: pointer;
      font-size: 13px;
      color: rgba(232,234,240,0.65);
      transition: background var(--transition-fast), color var(--transition-fast);
      width: 100%;
      text-align: left;
    }

    .nav-item:hover {
      background: var(--glass-bg-raised);
      color: var(--color-text);
    }

    .nav-item.active {
      background: rgba(99,102,241,0.18);
      color: #a5b4fc;
    }

    .nav-item i {
      width: 14px;
      text-align: center;
      font-size: 12px;
      flex-shrink: 0;
      opacity: 0.7;
    }

    .nav-item.active i { opacity: 1; }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Inline new project form */
    .new-project-form {
      display: flex;
      gap: 6px;
      padding: 4px 8px;
      align-items: center;
    }

    .new-project-form input {
      flex: 1;
      padding: 5px 10px;
      font-size: 12px;
      border-radius: 7px;
      font: inherit;
      color: #e8eaf0;
      background: rgba(255,255,255,0.09);
      border: 1px solid rgba(255,255,255,0.16);
      outline: none;
    }

    .new-project-form input:focus { border-color: #6366f1; }

    .new-project-form button {
      padding: 5px 10px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 600;
    }

    .btn-confirm {
      background: var(--color-accent);
      color: white;
    }

    .btn-confirm:hover { background: var(--color-accent-hover); }

    .btn-cancel {
      background: var(--glass-bg-raised);
      color: var(--color-text-muted);
      border: 1px solid var(--glass-border);
    }

    /* Skeleton */
    .skeleton {
      height: 28px;
      border-radius: 8px;
      margin: 3px 8px;
      background: var(--glass-bg);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: var(--shimmer);
      background-size: 200% 100%;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .user-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--glass-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
    }

    .version {
      font-size: 10px;
      color: var(--color-text-muted);
      opacity: 0.5;
    }

    .avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .user-name {
      flex: 1;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .logout-btn {
      font-size: 13px;
      color: var(--color-text-muted);
      padding: 5px 7px;
      border-radius: 7px;
      transition: color var(--transition-fast), background var(--transition-fast);
    }

    .logout-btn:hover { color: var(--color-danger); background: rgba(239,68,68,0.1); }
  `];

  async connectedCallback() {
    super.connectedCallback();
    await this._load();
  }

  async reload() {
    await this._load();
  }

  private async _load() {
    try {
      const [projects, groups] = await Promise.all([
        api.get<Project[]>('/projects'),
        api.get<Group[]>('/groups'),
      ]);
      this._projects = projects;
      this._groups = groups;
    } finally {
      this._loading = false;
    }
  }

  private _navigate(projectId: string) {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { projectId }, bubbles: true, composed: true }));
  }

  private _navigatePage(page: string) {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { page }, bubbles: true, composed: true }));
  }

  private _toggleCreate(target: string) {
    this._creatingIn = this._creatingIn === target ? null : target;
    if (this._creatingIn) this._newProjectName = '';
  }

  private async _createProject(e: Event) {
    e.preventDefault();
    const name = this._newProjectName.trim();
    const target = this._creatingIn;
    if (!name || !target) return;
    try {
      const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const body: Record<string, unknown> = { name, color };
      if (target !== 'personal') body.group_id = target;
      const p = await api.post<Project>('/projects', body);
      this._projects = [...this._projects, p];
      this._newProjectName = '';
      this._creatingIn = null;
      this._navigate(p.id);
    } catch { /* toast handled by api */ }
  }

  private _renderCreateForm() {
    return html`
      <form class="new-project-form" @submit=${this._createProject}>
        <input
          type="text"
          placeholder="Projectnaam..."
          .value=${this._newProjectName}
          @input=${(e: Event) => this._newProjectName = (e.target as HTMLInputElement).value}
          autofocus
        />
        <button type="submit" class="btn-confirm"><i class="fa-solid fa-check"></i></button>
        <button type="button" class="btn-cancel"
          @click=${() => { this._creatingIn = null; this._newProjectName = ''; }}>
          <i class="fa-solid fa-xmark"></i>
        </button>
      </form>
    `;
  }

  private _personalProjects() {
    return this._projects.filter(p => !p.group_id && !p.archived_at);
  }

  private _groupProjects(groupId: string) {
    return this._projects.filter(p => p.group_id === groupId && !p.archived_at);
  }

  render() {
    const initials = this.user?.name?.charAt(0).toUpperCase() ?? '?';

    return html`
      <div class="header">
        <div class="app-name">Doen</div>
        <div class="app-tagline">want er is altijd wel iets</div>
      </div>

      <nav>
        <div class="nav-section">
          <button class="nav-item" @click=${() => this._navigatePage('todo')}>
            <i class="fa-solid fa-list-check"></i> Te doen
          </button>
          <button class="nav-item" @click=${() => this._navigatePage('groups')}>
            <i class="fa-solid fa-people-group"></i> Groepen
          </button>
          ${this.user?.is_admin ? html`
            <button class="nav-item" @click=${() => this._navigatePage('admin')}>
              <i class="fa-solid fa-users-gear"></i> Gebruikers
            </button>
          ` : ''}
          <button class="nav-item" @click=${() => this._navigatePage('account')}>
            <i class="fa-solid fa-user-gear"></i> Account
          </button>
        </div>

        ${this._loading ? html`
          <div class="skeleton" style="width:70%"></div>
          <div class="skeleton" style="width:55%"></div>
          <div class="skeleton" style="width:80%"></div>
        ` : html`
          <div class="nav-section">
            <div class="section-header">
              <span class="section-label">Persoonlijk</span>
              <button class="add-project-btn" title="Nieuw project"
                @click=${() => this._toggleCreate('personal')}>
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>

            ${this._creatingIn === 'personal' ? this._renderCreateForm() : ''}

            ${this._personalProjects().map(p => html`
              <button class="nav-item ${this.activeProjectId === p.id ? 'active' : ''}"
                @click=${() => this._navigate(p.id)}>
                <span class="dot" style="background:${p.color}"></span>
                ${p.name}
              </button>
            `)}
          </div>

          ${this._groups.map(g => html`
            <div class="nav-section">
              <div class="section-header">
                <span class="section-label">${g.name}</span>
                <button class="add-project-btn" title="Nieuw project in ${g.name}"
                  @click=${() => this._toggleCreate(g.id)}>
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
              ${this._creatingIn === g.id ? this._renderCreateForm() : ''}
              ${this._groupProjects(g.id).map(p => html`
                <button class="nav-item ${this.activeProjectId === p.id ? 'active' : ''}"
                  @click=${() => this._navigate(p.id)}>
                  <span class="dot" style="background:${p.color}"></span>
                  ${p.name}
                </button>
              `)}
            </div>
          `)}
        `}
      </nav>

      <div class="user-footer">
        <div class="user-row">
          <div class="avatar">${initials}</div>
          <span class="user-name">${this.user?.name ?? '...'}</span>
          <button class="logout-btn" @click=${logout} title="Uitloggen">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
        <span class="version">${__APP_VERSION__}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-sidebar': DoenSidebar; }
}
