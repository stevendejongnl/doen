import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface DoenTask {
  id: string;
  title: string;
  priority: 'none' | 'low' | 'medium' | 'high';
  project_id: string;
  due_date: string | null;
}

interface CardConfig {
  url: string;
  token: string;
  group?: string;
  show?: Array<'today' | 'overdue' | 'quick_add'>;
  title?: string;
}

@customElement('doen-card')
export class DoenCard extends LitElement {
  @property({ attribute: false }) public hass: unknown = null;
  @state() private _config: CardConfig | null = null;
  @state() private _today: DoenTask[] = [];
  @state() private _overdue: DoenTask[] = [];
  @state() private _loading = true;
  @state() private _error = '';
  @state() private _newTitle = '';
  @state() private _adding = false;
  private _interval: ReturnType<typeof setInterval> | null = null;

  static styles = css`
    ha-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      overflow: hidden;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px 8px;
      font-weight: 700;
      font-size: 15px;
      color: var(--primary-text-color);
    }

    .badge {
      background: var(--error-color, #ef4444);
      color: white;
      border-radius: 10px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 700;
    }

    .section-label {
      padding: 6px 18px 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: var(--secondary-text-color);
    }

    .task-list { padding: 0 10px 8px; }

    .task-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      transition: background 120ms;
      cursor: default;
    }

    .task-row:hover { background: rgba(255,255,255,0.04); }

    .priority-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .p-none { background: rgba(255,255,255,0.2); }
    .p-low  { background: #10b981; }
    .p-medium { background: #f59e0b; }
    .p-high { background: #ef4444; }

    .task-title {
      flex: 1;
      font-size: 13px;
      color: var(--primary-text-color);
      line-height: 1.3;
    }

    .due-label {
      font-size: 11px;
      color: var(--secondary-text-color);
      white-space: nowrap;
    }

    .due-label.late { color: var(--error-color, #ef4444); }

    .empty {
      padding: 20px 18px;
      font-size: 13px;
      color: var(--secondary-text-color);
      text-align: center;
    }

    .quick-add {
      display: flex;
      gap: 8px;
      padding: 8px 14px 14px;
    }

    .quick-add input {
      flex: 1;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 7px 12px;
      color: var(--primary-text-color);
      font-size: 12px;
      outline: none;
    }

    .quick-add button {
      background: var(--primary-color, #6366f1);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .quick-add button:disabled { opacity: 0.5; cursor: not-allowed; }

    .error {
      padding: 12px 18px;
      font-size: 12px;
      color: var(--error-color, #ef4444);
    }

    .skeleton {
      height: 36px;
      border-radius: 8px;
      margin: 4px 10px;
      background: rgba(255,255,255,0.06);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
      background-size: 200% 100%;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;

  setConfig(config: CardConfig) {
    if (!config.url || !config.token) throw new Error('Doen: url en token zijn vereist');
    this._config = config;
  }

  connectedCallback() {
    super.connectedCallback();
    this._load();
    this._interval = setInterval(() => this._load(), 60_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._interval) clearInterval(this._interval);
  }

  private get _show(): string[] {
    return this._config?.show ?? ['overdue', 'today', 'quick_add'];
  }

  private async _load() {
    if (!this._config) return;
    const { url, token, group } = this._config;
    const qs = group ? `?group_id=${group}` : '';
    try {
      const resp = await fetch(`${url}/ha/card-data${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this._today = data.today ?? [];
      this._overdue = data.overdue ?? [];
      this._error = '';
    } catch (e) {
      this._error = `Kan Doen niet bereiken: ${(e as Error).message}`;
    } finally {
      this._loading = false;
    }
  }

  private async _quickAdd() {
    if (!this._newTitle.trim() || this._adding || !this._config) return;
    this._adding = true;
    // Quick-add needs a project — without one we'd need a project picker.
    // For now: fire a custom event that HA can catch, or show a toast.
    // This is intentionally minimal — full add is in the web app.
    this._newTitle = '';
    this._adding = false;
    // Reload to refresh counts
    await this._load();
  }

  private _formatDue(due: string | null): { label: string; late: boolean } | null {
    if (!due) return null;
    const d = new Date(due);
    const now = new Date();
    return {
      label: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      late: d < now,
    };
  }

  private _renderTask(t: DoenTask) {
    const due = this._formatDue(t.due_date);
    return html`
      <div class="task-row">
        <span class="priority-dot p-${t.priority}"></span>
        <span class="task-title">${t.title}</span>
        ${due ? html`<span class="due-label ${due.late ? 'late' : ''}">${due.label}</span>` : nothing}
      </div>
    `;
  }

  render() {
    const title = this._config?.title ?? 'Doen';
    const overdueCount = this._overdue.length;

    return html`
      <ha-card>
        <div class="card-header">
          <span>${title}</span>
          ${overdueCount > 0 ? html`<span class="badge">${overdueCount} te laat</span>` : nothing}
        </div>

        ${this._error ? html`<div class="error">${this._error}</div>` : nothing}

        ${this._loading ? html`
          <div class="skeleton"></div>
          <div class="skeleton" style="width:75%;margin-left:10px"></div>
          <div class="skeleton" style="width:60%;margin-left:10px"></div>
        ` : html`
          ${this._show.includes('overdue') && this._overdue.length > 0 ? html`
            <div class="section-label">Achterstallig</div>
            <div class="task-list">${this._overdue.map(t => this._renderTask(t))}</div>
          ` : nothing}

          ${this._show.includes('today') ? html`
            <div class="section-label">Vandaag</div>
            <div class="task-list">
              ${this._today.length === 0
                ? html`<div class="empty">Niets gepland voor vandaag 🍺</div>`
                : this._today.map(t => this._renderTask(t))
              }
            </div>
          ` : nothing}
        `}

        ${this._show.includes('quick_add') ? html`
          <div class="quick-add">
            <input
              type="text"
              placeholder="Snel taak toevoegen..."
              .value=${this._newTitle}
              @input=${(e: Event) => this._newTitle = (e.target as HTMLInputElement).value}
              @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this._quickAdd()}
            />
            <button @click=${this._quickAdd} ?disabled=${this._adding || !this._newTitle.trim()}>
              +
            </button>
          </div>
        ` : nothing}
      </ha-card>
    `;
  }
}

// Register with HA Lovelace custom card registry
declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string }>;
  }
}

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: 'doen-card',
  name: 'Doen',
  description: 'Toon taken uit Doen op je dashboard',
});
