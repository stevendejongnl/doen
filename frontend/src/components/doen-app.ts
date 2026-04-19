import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isLoggedIn, getMe } from '../services/auth';
import { sseConnect } from '../services/api';
import type { User, Task } from '../services/types';
import './doen-sidebar';
import './doen-toast';
import '../pages/page-login';
import '../pages/page-today';
import '../pages/page-project';

type Route =
  | { type: 'login' }
  | { type: 'today' }
  | { type: 'inbox' }
  | { type: 'project'; projectId: string };

@customElement('doen-app')
export class DoenApp extends LitElement {
  @state() private _user: User | null = null;
  @state() private _route: Route = { type: 'today' };
  @state() private _booting = true;
  private _sse: EventSource | null = null;

  static styles = css`
    :host { display: flex; height: 100vh; overflow: hidden; }

    .layout {
      display: flex;
      width: 100%;
      height: 100%;
    }

    .main {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .boot-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: rgba(232,234,240,0.3);
      font-size: 14px;
    }
  `;

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
    this._sse = sseConnect((name, data) => {
      this._handleSSE(name, data as Task);
    });
  }

  private _handleSSE(event: string, task: Task) {
    if (event === 'task_updated' || event === 'task_completed') {
      const el = this.shadowRoot?.querySelector('page-project') as any;
      el?.updateTask(task);
    } else if (event === 'task_deleted') {
      const el = this.shadowRoot?.querySelector('page-project') as any;
      el?.removeTask((task as any).id);
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
    if (projectId) {
      this._route = { type: 'project', projectId };
    } else if (page === 'today') {
      this._route = { type: 'today' };
    } else if (page === 'inbox') {
      this._route = { type: 'inbox' };
    }
  }

  private _renderMain() {
    switch (this._route.type) {
      case 'today': return html`<page-today></page-today>`;
      case 'inbox': return html`<page-today></page-today>`; // reuse for now
      case 'project': return html`
        <page-project .projectId=${this._route.projectId}></page-project>
      `;
    }
  }

  render() {
    if (this._booting) {
      return html`<div class="boot-screen">laden...</div>`;
    }

    if (!this._user) {
      return html`
        <page-login @logged-in=${this._onLoggedIn}></page-login>
        <doen-toast></doen-toast>
      `;
    }

    const activeId = this._route.type === 'project' ? this._route.projectId : '';

    return html`
      <div class="layout" @navigate=${this._onNavigate}>
        <doen-sidebar .user=${this._user} .activeProjectId=${activeId}></doen-sidebar>
        <main class="main">${this._renderMain()}</main>
      </div>
      <doen-toast></doen-toast>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'doen-app': DoenApp;
  }
}
