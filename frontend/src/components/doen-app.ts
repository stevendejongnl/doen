import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sharedStyles } from '../styles/shared-styles';
import { isLoggedIn, getMe } from '../services/auth';
import { sseConnect } from '../services/api';
import type { User, Task } from '../services/types';
import './doen-sidebar';
import './doen-toast';
import '../pages/page-login';
import '../pages/page-today';
import '../pages/page-project';
import '../pages/page-groups';
import '../pages/page-admin';

type Route =
  | { type: 'today' }
  | { type: 'inbox' }
  | { type: 'project'; projectId: string }
  | { type: 'groups' }
  | { type: 'admin' };

@customElement('doen-app')
export class DoenApp extends LitElement {
  @state() private _user: User | null = null;
  @state() private _route: Route = { type: 'today' };
  @state() private _booting = true;
  @state() private _sidebarOpen = false;
  private _sse: EventSource | null = null;

  static styles = [sharedStyles, css`
    :host { display: flex; height: 100vh; overflow: hidden; position: relative; }

    .layout { display: flex; width: 100%; height: 100%; }

    /* Sidebar overlay backdrop on mobile */
    .backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(2px);
      z-index: 40;
    }

    .backdrop.open { display: block; }

    .main {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Mobile topbar */
    .topbar {
      display: none;
      align-items: center;
      gap: 12px;
      height: var(--topbar-height);
      padding: 0 16px;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      border-bottom: 1px solid var(--glass-border);
      flex-shrink: 0;
    }

    .topbar-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-text);
    }

    .menu-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--glass-bg-raised);
      border: 1px solid var(--glass-border);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text);
      font-size: 15px;
      flex-shrink: 0;
    }

    .menu-btn:hover { background: rgba(255,255,255,0.14); }

    .boot-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--color-text-muted);
      font-size: 14px;
    }

    /* Sidebar: always visible on desktop, drawer on mobile */
    doen-sidebar {
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      .topbar { display: flex; }

      doen-sidebar {
        position: fixed;
        top: 0;
        left: 0;
        height: 100%;
        transform: translateX(-100%);
        transition: transform 280ms ease-out;
        z-index: 50;
      }

      doen-sidebar.open {
        transform: translateX(0);
      }
    }
  `];

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('doen:logout', this._onLogout);

    if (isLoggedIn()) {
      try {
        this._user = await getMe();
        this._connectSSE();
      } catch {
        this._user = null;
      }
    }
    this._booting = false;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('doen:logout', this._onLogout);
    this._sse?.close();
  }

  private _connectSSE() {
    this._sse?.close();
    this._sse = sseConnect((name, data) => this._handleSSE(name, data as Task));
  }

  private _handleSSE(event: string, task: Task) {
    if (event === 'task_updated' || event === 'task_completed') {
      (this.shadowRoot?.querySelector('page-project') as any)?.updateTask(task);
    } else if (event === 'task_deleted') {
      (this.shadowRoot?.querySelector('page-project') as any)?.removeTask((task as any).id);
    }
  }

  private _onLogout = () => {
    this._user = null;
    this._sse?.close();
    this._sse = null;
  };

  private _onLoggedIn(e: CustomEvent<User>) {
    this._user = e.detail;
    this._route = { type: 'today' };
    this._connectSSE();
  }

  private _onNavigate(e: CustomEvent<{ projectId?: string; page?: string }>) {
    const { projectId, page } = e.detail;
    if (projectId) this._route = { type: 'project', projectId };
    else if (page === 'today') this._route = { type: 'today' };
    else if (page === 'inbox') this._route = { type: 'inbox' };
    else if (page === 'groups') this._route = { type: 'groups' };
    else if (page === 'admin') this._route = { type: 'admin' };
    this._sidebarOpen = false;
  }

  private _renderMain() {
    switch (this._route.type) {
      case 'today':
      case 'inbox':
        return html`<page-today></page-today>`;
      case 'project':
        return html`<page-project .projectId=${this._route.projectId}></page-project>`;
      case 'groups':
        return html`<page-groups></page-groups>`;
      case 'admin':
        return html`<page-admin></page-admin>`;
    }
  }

  render() {
    if (this._booting) return html`<div class="boot-screen">laden...</div>`;

    if (!this._user) {
      return html`
        <page-login @logged-in=${this._onLoggedIn}></page-login>
        <doen-toast></doen-toast>
      `;
    }

    const activeId = this._route.type === 'project' ? this._route.projectId : '';

    return html`
      <div class="layout" @navigate=${this._onNavigate}>
        <div class="backdrop ${this._sidebarOpen ? 'open' : ''}"
             @click=${() => this._sidebarOpen = false}></div>

        <doen-sidebar
          class="${this._sidebarOpen ? 'open' : ''}"
          .user=${this._user}
          .activeProjectId=${activeId}
        ></doen-sidebar>

        <div class="main">
          <div class="topbar">
            <button class="menu-btn" @click=${() => this._sidebarOpen = !this._sidebarOpen}>
              <i class="fa-solid fa-bars"></i>
            </button>
            <span class="topbar-title">Doen</span>
          </div>
          ${this._renderMain()}
        </div>
      </div>
      <doen-toast></doen-toast>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-app': DoenApp; }
}
