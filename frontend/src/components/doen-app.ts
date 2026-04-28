import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sharedStyles } from '../styles/shared-styles';
import { isLoggedIn, getMe } from '../services/auth';
import { sseConnect, type SSEClient } from '../services/api';
import type { User } from '../services/types';
import './doen-sidebar';
import './doen-toast';
import '../pages/page-login';
import '../pages/page-todo';
import '../pages/page-project';
import '../pages/page-groups';
import '../pages/page-group-settings';
import '../pages/page-admin';
import '../pages/page-account';
import '../pages/page-invite';
import '../pages/page-reset';

type Route =
  | { type: 'todo' }
  | { type: 'project'; projectId: string }
  | { type: 'groups' }
  | { type: 'group-settings'; groupId: string }
  | { type: 'admin' }
  | { type: 'account' };

@customElement('doen-app')
export class DoenApp extends LitElement {
  @state() private _user: User | null = null;
  @state() private _route: Route = { type: 'todo' };
  @state() private _booting = true;
  @state() private _sidebarOpen = false;
  @state() private _inviteToken: string | null = null;
  @state() private _resetToken: string | null = null;
  private _sse: SSEClient | null = null;

  private _readInviteTokenFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/invite\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private _readResetTokenFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/reset\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private _routeFromPath(): Route {
    const path = window.location.pathname;
    const projectMatch = path.match(/^\/project\/([^/]+)/);
    if (projectMatch) return { type: 'project', projectId: projectMatch[1] };
    const groupSettingsMatch = path.match(/^\/groups\/([^/]+)\/settings/);
    if (groupSettingsMatch) return { type: 'group-settings', groupId: groupSettingsMatch[1] };
    if (path.startsWith('/groups')) return { type: 'groups' };
    if (path.startsWith('/admin')) return { type: 'admin' };
    if (path.startsWith('/account')) return { type: 'account' };
    return { type: 'todo' };
  }

  private _pathFromRoute(route: Route): string {
    switch (route.type) {
      case 'todo':           return '/';
      case 'project':        return `/project/${route.projectId}`;
      case 'groups':         return '/groups';
      case 'group-settings': return `/groups/${route.groupId}/settings`;
      case 'admin':          return '/admin';
      case 'account':        return '/account';
    }
  }

  private _setRoute(route: Route) {
    this._route = route;
    history.pushState(null, '', this._pathFromRoute(route));
    this._sidebarOpen = false;
  }

  private _onPopState = () => {
    this._route = this._routeFromPath();
  };

  static styles = [...sharedStyles, css`
    :host {
      display: flex;
      height: 100%;
      overflow: hidden;
      position: relative;
      background:
        radial-gradient(ellipse at 20% 50%, rgba(6, 182, 212, 0.12) 0%, transparent 55%),
        radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.14) 0%, transparent 50%),
        radial-gradient(ellipse at 60% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 45%),
        linear-gradient(160deg, #060d1a 0%, #081020 40%, #0a1628 70%, #0d0f1f 100%);
    }

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
      padding: 16px 24px 16px 16px;
    }

    .page-wrap {
      flex: 1;
      overflow: hidden;
      border-radius: 16px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      display: flex;
      flex-direction: column;
      padding: 28px;
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
      width: 44px;
      height: 44px;
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
      .topbar {
        display: flex;
        padding-top: env(safe-area-inset-top, 0px);
        height: calc(var(--topbar-height) + env(safe-area-inset-top, 0px));
      }

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

      .main {
        padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));
        gap: 8px;
      }
      .page-wrap { padding: 16px; border-radius: 12px; }
    }
  `];

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('doen:logout', this._onLogout);
    window.addEventListener('popstate', this._onPopState);
    this._inviteToken = this._readInviteTokenFromUrl();
    this._resetToken = this._readResetTokenFromUrl();
    this._route = this._routeFromPath();

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
    window.removeEventListener('popstate', this._onPopState);
    this._sse?.stop();
  }

  private _connectSSE() {
    this._sse?.stop();
    this._sse = sseConnect((name, data) => this._handleSSE(name, data));
  }

  private _handleSSE(event: string, data: unknown) {
    const root = this.shadowRoot;
    const project = root?.querySelector('page-project') as any;
    const todo = root?.querySelector('page-todo') as any;
    const sidebar = root?.querySelector('doen-sidebar') as any;
    const groups = root?.querySelector('page-groups') as any;
    const groupSettings = root?.querySelector('page-group-settings') as any;

    switch (event) {
      case 'task_created':
        project?.addTask?.(data);
        todo?.addTask?.(data);
        break;
      case 'task_updated':
      case 'task_completed':
        project?.updateTask?.(data);
        todo?.updateTask?.(data);
        break;
      case 'task_deleted':
        project?.removeTask?.((data as any).id);
        todo?.removeTask?.((data as any).id);
        break;
      case 'category_created':
      case 'category_updated':
      case 'category_deleted':
        window.dispatchEvent(new CustomEvent('doen:categories-changed'));
        groupSettings?.reload?.();
        break;
      case 'project_created':
        sidebar?.reload?.();
        groups?.reload?.();
        break;
      case 'project_updated':
      case 'project_deleted': {
        sidebar?.reload?.();
        groups?.reload?.();
        const pid = (data as any).id;
        if (this._route.type === 'project' && this._route.projectId === pid) {
          project?.reload?.();
        }
        break;
      }
      case 'group_created':
      case 'group_updated':
      case 'group_deleted': {
        sidebar?.reload?.();
        groups?.reload?.();
        const gid = (data as any).id;
        if (this._route.type === 'group-settings' && this._route.groupId === gid) {
          groupSettings?.reload?.();
        }
        break;
      }
      case 'group_member_added':
      case 'group_member_removed':
        groups?.reload?.();
        groupSettings?.reload?.();
        project?.reload?.();
        break;
      case 'offer_created':
      case 'offer_updated':
        project?.reload?.();
        groupSettings?.reload?.();
        break;
      case 'offers_purged':
        groupSettings?.reload?.();
        project?.reload?.();
        break;
      case 'points_updated':
        project?.reload?.();
        groupSettings?.reload?.();
        break;
      case 'heartbeat':
        break;
    }
  }

  private _onLogout = () => {
    this._user = null;
    this._sse?.stop();
    this._sse = null;
  };

  private _onLoggedIn(e: CustomEvent<User>) {
    this._user = e.detail;
    this._route = { type: 'todo' };
    this._connectSSE();
  }

  private _onProjectCreated() {
    (this.shadowRoot?.querySelector('doen-sidebar') as any)?.reload();
  }

  private _onCloseSidebar = () => { this._sidebarOpen = false; };
  private _onToggleSidebar = () => { this._sidebarOpen = !this._sidebarOpen; };
  private _onResetNavigate = (e: CustomEvent) => { if (e.detail.page === 'login') this._resetToken = null; };

  private _onNavigate(e: CustomEvent<{ projectId?: string; page?: string; groupId?: string }>) {
    const { projectId, page, groupId } = e.detail;

    if (this._route.type === 'project') {
      const isSwitchingAway =
        (projectId && projectId !== this._route.projectId) ||
        (!projectId && (page || groupId));
      if (isSwitchingAway) {
        const pageEl = this.renderRoot.querySelector('page-project') as
          | (HTMLElement & {
              hasUnsavedProjectChanges?: () => boolean;
              discardProjectEdit?: () => void;
            })
          | null;
        if (pageEl?.hasUnsavedProjectChanges?.()) {
          if (!confirm('Wijzigingen verwerpen?')) return;
          pageEl.discardProjectEdit?.();
        }
      }
    }

    if (projectId) this._setRoute({ type: 'project', projectId });
    else if (page === 'todo') this._setRoute({ type: 'todo' });
    else if (page === 'groups') this._setRoute({ type: 'groups' });
    else if (page === 'group-settings' && groupId) this._setRoute({ type: 'group-settings', groupId });
    else if (page === 'admin') this._setRoute({ type: 'admin' });
    else if (page === 'account') this._setRoute({ type: 'account' });
    else this._sidebarOpen = false;
  }

  private _renderMain() {
    switch (this._route.type) {
      case 'todo':
        return html`<page-todo></page-todo>`;
      case 'project':
        return html`<page-project .projectId=${this._route.projectId}></page-project>`;
      case 'groups':
        return html`<page-groups></page-groups>`;
      case 'group-settings':
        return html`<page-group-settings .groupId=${this._route.groupId}></page-group-settings>`;
      case 'admin':
        return html`<page-admin .me=${this._user}></page-admin>`;
      case 'account':
        return html`<page-account></page-account>`;
    }
  }

  render() {
    if (this._booting) return html`<div class="boot-screen">laden...</div>`;

    if (this._inviteToken) {
      return html`
        <page-invite .token=${this._inviteToken}></page-invite>
        <doen-toast></doen-toast>
      `;
    }

    if (this._resetToken) {
      return html`
        <page-reset .token=${this._resetToken}
          @navigate=${this._onResetNavigate}>
        </page-reset>
        <doen-toast></doen-toast>
      `;
    }

    if (!this._user) {
      return html`
        <page-login @logged-in=${this._onLoggedIn}></page-login>
        <doen-toast></doen-toast>
      `;
    }

    const activeId = this._route.type === 'project' ? this._route.projectId : '';

    return html`
      <div class="layout" @navigate=${this._onNavigate} @project-created=${this._onProjectCreated}>
        <div class="backdrop ${this._sidebarOpen ? 'open' : ''}"
             @click=${this._onCloseSidebar}></div>

        <doen-sidebar
          class="${this._sidebarOpen ? 'open' : ''}"
          .user=${this._user}
          .activeProjectId=${activeId}
        ></doen-sidebar>

        <div class="main">
          <div class="topbar">
            <button class="menu-btn" @click=${this._onToggleSidebar}>
              <i class="fa-solid fa-bars"></i>
            </button>
            <span class="topbar-title">Doen</span>
          </div>
          <div class="page-wrap">
            ${this._renderMain()}
          </div>
        </div>
      </div>
      <doen-toast></doen-toast>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-app': DoenApp; }
}
