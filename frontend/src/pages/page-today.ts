import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Task } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import '../components/doen-task';

@customElement('page-today')
export class PageToday extends LitElement {
  @state() private _tasks: Task[] = [];
  @state() private _loading = true;

  static styles = [...sharedStyles, css`
    :host {
      display: block;
      overflow-y: auto;
      height: 100%;
    }

    h1 {
      font-size: 24px;
      font-weight: 800;
      color: var(--color-text);
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }

    .subtitle {
      font-size: 13px;
      color: var(--color-text-muted);
      margin-bottom: 28px;
    }

    .section { margin-bottom: 24px; }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      background: var(--color-danger);
      color: white;
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 10px;
      font-weight: 700;
    }

    .task-list { display: flex; flex-direction: column; gap: 5px; }

    .empty-state {
      margin-top: 60px;
      text-align: center;
      color: var(--color-text-muted);
    }

    .empty-state i {
      font-size: 36px;
      opacity: 0.25;
      display: block;
      margin-bottom: 14px;
    }

    .empty-state p { font-size: 14px; }
    .empty-state small { font-size: 12px; opacity: 0.6; }

    .hint {
      margin-top: 32px;
      padding: 16px 20px;
      border-radius: 14px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      font-size: 13px;
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .hint i { font-size: 16px; color: var(--color-accent); flex-shrink: 0; }

    /* Skeleton */
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

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this._loading = true;
    try {
      this._tasks = await api.get<Task[]>('/tasks?due_today=true&overdue=true');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Laden mislukt: ${e.message}`);
    } finally {
      this._loading = false;
    }
  }

  private _today() {
    const now = new Date(); now.setHours(0,0,0,0);
    const tom = new Date(now); tom.setDate(tom.getDate() + 1);
    return this._tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      const d = new Date(t.due_date);
      return d >= now && d < tom;
    });
  }

  private _overdue() {
    const now = new Date(); now.setHours(0,0,0,0);
    return this._tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < now;
    });
  }

  render() {
    const label = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

    if (this._loading) {
      return html`
        <h1>Vandaag</h1>
        <div class="subtitle">laden...</div>
        ${[1,2,3].map(() => html`<div class="sk-task"></div>`)}
      `;
    }

    const today = this._today();
    const overdue = this._overdue();

    if (today.length === 0 && overdue.length === 0) {
      return html`
        <h1>Vandaag</h1>
        <p class="subtitle">${label}</p>
        <div class="empty-state">
          <i class="fa-solid fa-circle-check"></i>
          <p>Niets te doen vandaag.</p>
          <small>Óf je bent super productief, óf je bent alles vergeten in te plannen.</small>
        </div>
        <div class="hint">
          <i class="fa-solid fa-arrow-left"></i>
          Maak een project aan in de zijbalk om taken toe te voegen.
        </div>
      `;
    }

    return html`
      <h1>Vandaag</h1>
      <p class="subtitle">${label}</p>

      ${overdue.length > 0 ? html`
        <div class="section">
          <div class="section-label">
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--color-danger)"></i>
            Achterstallig <span class="badge">${overdue.length}</span>
          </div>
          <div class="task-list">${overdue.map(t => html`<doen-task .task=${t}></doen-task>`)}</div>
        </div>
      ` : ''}

      ${today.length > 0 ? html`
        <div class="section">
          <div class="section-label">
            <i class="fa-solid fa-sun" style="color:var(--color-warning)"></i>
            Voor vandaag
          </div>
          <div class="task-list">${today.map(t => html`<doen-task .task=${t}></doen-task>`)}</div>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-today': PageToday; }
}
