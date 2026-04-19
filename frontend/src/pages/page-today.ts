import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Task } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import '../components/doen-task';

@customElement('page-today')
export class PageToday extends LitElement {
  @state() private _tasks: Task[] = [];
  @state() private _loading = true;

  static styles = css`
    :host { display: block; padding: 28px 32px; overflow-y: auto; height: 100%; }

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #e8eaf0;
      margin-bottom: 6px;
    }

    .subtitle {
      font-size: 13px;
      color: rgba(232,234,240,0.4);
      margin-bottom: 28px;
    }

    .section { margin-bottom: 24px; }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: rgba(232,234,240,0.35);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      background: #ef4444;
      color: white;
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 10px;
      font-weight: 700;
    }

    .task-list { display: flex; flex-direction: column; gap: 4px; }

    .empty {
      padding: 48px;
      text-align: center;
      color: rgba(232,234,240,0.3);
      font-size: 14px;
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

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this._loading = true;
    try {
      const tasks = await api.get<Task[]>('/tasks?due_today=true&overdue=true');
      this._tasks = tasks;
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Laden mislukt: ${e.message}`);
    } finally {
      this._loading = false;
    }
  }

  private _today() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    return this._tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      const d = new Date(t.due_date);
      return d >= now && d < tom;
    });
  }

  private _overdue() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this._tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < now;
    });
  }

  private _todayLabel() {
    return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  render() {
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
        <p class="subtitle">${this._todayLabel()}</p>
        <div class="empty">
          Niets te doen vandaag. Dat is óf heel goed óf je hebt alles vergeten in te plannen. 🤷
        </div>
      `;
    }

    return html`
      <h1>Vandaag</h1>
      <p class="subtitle">${this._todayLabel()}</p>

      ${overdue.length > 0 ? html`
        <div class="section">
          <div class="section-label">
            Achterstallig <span class="badge">${overdue.length}</span>
          </div>
          <div class="task-list">
            ${overdue.map(t => html`<doen-task .task=${t}></doen-task>`)}
          </div>
        </div>
      ` : ''}

      ${today.length > 0 ? html`
        <div class="section">
          <div class="section-label">Voor vandaag</div>
          <div class="task-list">
            ${today.map(t => html`<doen-task .task=${t}></doen-task>`)}
          </div>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-today': PageToday;
  }
}
