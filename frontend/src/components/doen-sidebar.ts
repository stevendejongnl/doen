import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Project, Group, User } from '../services/types';
import { api } from '../services/api';
import { logout } from '../services/api';

@customElement('doen-sidebar')
export class DoenSidebar extends LitElement {
  @property({ type: Object }) user!: User;
  @property({ type: String }) activeProjectId = '';
  @state() private _projects: Project[] = [];
  @state() private _groups: Group[] = [];
  @state() private _loading = true;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: var(--sidebar-width, 260px);
      height: 100%;
      background: rgba(255,255,255,0.03);
      border-right: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(12px);
      overflow-y: auto;
      flex-shrink: 0;
    }

    .header {
      padding: 20px 16px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .app-name {
      font-size: 20px;
      font-weight: 700;
      color: #e8eaf0;
      letter-spacing: -0.5px;
    }

    .app-tagline {
      font-size: 11px;
      color: rgba(232,234,240,0.4);
      margin-top: 2px;
    }

    nav { padding: 12px 8px; flex: 1; }

    .nav-section {
      margin-bottom: 20px;
    }

    .section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: rgba(232,234,240,0.35);
      padding: 0 8px;
      margin-bottom: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      color: rgba(232,234,240,0.65);
      transition: background 120ms ease-out, color 120ms ease-out;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
    }

    .nav-item:hover {
      background: rgba(255,255,255,0.06);
      color: #e8eaf0;
    }

    .nav-item.active {
      background: rgba(99,102,241,0.15);
      color: #a5b4fc;
    }

    .nav-item .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .skeleton {
      background: rgba(255,255,255,0.06);
      border-radius: 6px;
      margin: 4px 8px;
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
      background-size: 200% 100%;
    }

    .skeleton-item { height: 30px; }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .user-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #6366f1;
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
      color: rgba(232,234,240,0.7);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .logout-btn {
      font-size: 11px;
      color: rgba(232,234,240,0.35);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: color 120ms;
      background: none;
      border: none;
    }

    .logout-btn:hover { color: #ef4444; }
  `;

  async connectedCallback() {
    super.connectedCallback();
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
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { projectId },
      bubbles: true,
      composed: true,
    }));
  }

  private _navigatePage(page: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { page },
      bubbles: true,
      composed: true,
    }));
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
          <button class="nav-item" @click=${() => this._navigatePage('today')}>
            <span>📅</span> Vandaag
          </button>
          <button class="nav-item" @click=${() => this._navigatePage('inbox')}>
            <span>📥</span> Inbox
          </button>
        </div>

        ${this._loading ? html`
          <div class="nav-section">
            <div class="skeleton skeleton-item" style="width:70%"></div>
            <div class="skeleton skeleton-item" style="width:55%"></div>
            <div class="skeleton skeleton-item" style="width:80%"></div>
          </div>
        ` : html`
          <div class="nav-section">
            <div class="section-label">Persoonlijk</div>
            ${this._personalProjects().map(p => html`
              <button
                class="nav-item ${this.activeProjectId === p.id ? 'active' : ''}"
                @click=${() => this._navigate(p.id)}
              >
                <span class="dot" style="background:${p.color}"></span>
                ${p.name}
              </button>
            `)}
          </div>

          ${this._groups.map(g => html`
            <div class="nav-section">
              <div class="section-label">${g.name}</div>
              ${this._groupProjects(g.id).map(p => html`
                <button
                  class="nav-item ${this.activeProjectId === p.id ? 'active' : ''}"
                  @click=${() => this._navigate(p.id)}
                >
                  <span class="dot" style="background:${p.color}"></span>
                  ${p.name}
                </button>
              `)}
            </div>
          `)}
        `}
      </nav>

      <div class="user-footer">
        <div class="avatar">${initials}</div>
        <span class="user-name">${this.user?.name ?? '...'}</span>
        <button class="logout-btn" @click=${logout} title="Uitloggen">↩</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'doen-sidebar': DoenSidebar;
  }
}
