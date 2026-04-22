import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  GroupMember,
  HouseholdBalance,
  HouseholdNotification,
  PointTransaction,
  Project,
  Task,
  TaskOffer,
} from '../services/types';
import { api, ApiError } from '../services/api';
import { getMe, type Me } from '../services/auth';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import '../components/doen-task';
import '../components/doen-task-form';
import '../components/ui/doen-input';
import '../components/ui/doen-select';
import type { SelectOption } from '../components/ui/doen-select';
import '../components/ui/doen-button';

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
  @state() private _balances: HouseholdBalance[] = [];
  @state() private _offers: TaskOffer[] = [];
  @state() private _transactions: PointTransaction[] = [];
  @state() private _members: GroupMember[] = [];
  @state() private _notifications: HouseholdNotification[] = [];
  @state() private _me: Me | null = null;
  @state() private _transferTo = '';
  @state() private _transferAmount = 1;
  @state() private _transferNote = '';

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
    .edit-row input[type="text"]:focus { border-color: var(--color-accent); }

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
    .btn-primary { background: var(--color-accent); color: white; }
    .btn-primary:hover { background: var(--color-accent-hover); }
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

    .household-panel {
      margin-bottom: 18px;
      padding: 14px 16px;
      border-radius: var(--radius-card);
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .panel-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: var(--color-text-muted);
    }

    .balance-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .balance-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--color-text);
      font-size: 12px;
    }

    .balance-chip .value { font-weight: 700; }
    .balance-chip.negative .value { color: #f87171; }
    .balance-chip.positive .value { color: #4ade80; }

    .offer-list { display: flex; flex-direction: column; gap: 8px; }

    .offer-card {
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .offer-top {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .offer-task {
      font-size: 13px;
      color: var(--color-text);
      font-weight: 600;
    }

    .offer-meta {
      font-size: 11px;
      color: var(--color-text-muted);
    }

    .offer-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .offer-actions doen-button {
      flex-shrink: 0;
    }

    .inbox-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .inbox-item {
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .inbox-item.actionable {
      border-color: rgba(99,102,241,0.24);
      background: rgba(99,102,241,0.08);
    }

    .inbox-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text);
    }

    .inbox-meta {
      font-size: 11px;
      color: var(--color-text-muted);
    }

    .inbox-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .inbox-actions doen-button {
      flex-shrink: 0;
    }

    .transaction-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .transaction-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      font-size: 12px;
    }

    .transaction-row .amt {
      font-weight: 700;
    }

    .transaction-row .amt.positive { color: #4ade80; }
    .transaction-row .amt.negative { color: #f87171; }

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
      const [project, tasks, me] = await Promise.all([
        api.get<Project>(`/projects/${this.projectId}`),
        api.get<Task[]>(`/projects/${this.projectId}/tasks`),
        getMe(),
      ]);
      this._project = project;
      this._tasks = tasks;
      this._me = me;
      await this._loadHousehold(project);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Laden mislukt: ${e.message}`);
    } finally {
      this._loading = false;
    }
  }

  reload() {
    return this._load();
  }

  private async _loadHousehold(project: Project) {
    if (!project.group_id) {
      this._balances = [];
      this._offers = [];
      this._transactions = [];
      this._members = [];
      this._notifications = [];
      return;
    }
    const [balances, offers, transactions, members, notifications] = await Promise.all([
      api.get<HouseholdBalance[]>(`/households/${project.group_id}/balances`),
      api.get<TaskOffer[]>(`/households/${project.group_id}/offers`),
      api.get<PointTransaction[]>(`/households/${project.group_id}/transactions`),
      api.get<GroupMember[]>(`/groups/${project.group_id}/members`),
      api.get<HouseholdNotification[]>(`/households/${project.group_id}/notifications`),
    ]);
    this._balances = balances;
    this._offers = offers;
    this._transactions = transactions;
    this._members = members;
    this._notifications = notifications;
  }

  private async _refreshHousehold() {
    if (this._project) {
      await this._loadHousehold(this._project);
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

  private async _acceptOffer(offer: TaskOffer) {
    try {
      await api.post(`/offers/${offer.id}/accept`, {});
      await this._load();
      toast.success('Aanbod geaccepteerd');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Accepteren mislukt: ${e.message}`);
    }
  }

  private async _decideOffer(offer: TaskOffer, approved: boolean) {
    try {
      const reopen = approved ? true : confirm('Na afwijzen opnieuw openzetten?');
      await api.post(`/offers/${offer.id}/decision`, { approved, reopen });
      await this._load();
      toast.success(approved ? 'Aanbod goedgekeurd' : 'Aanbod afgewezen');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Beoordelen mislukt: ${e.message}`);
    }
  }

  private async _withdrawOffer(offer: TaskOffer) {
    try {
      await api.delete(`/offers/${offer.id}`);
      await this._load();
      toast.success('Aanbod ingetrokken');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Intrekken mislukt: ${e.message}`);
    }
  }

  private async _handleInboxAction(offer: TaskOffer, approved: boolean) {
    try {
      const reopen = approved ? true : confirm('Na afwijzen opnieuw openzetten?');
      await api.post(`/offers/${offer.id}/decision`, { approved, reopen });
      await this._load();
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Inbox actie mislukt: ${e.message}`);
    }
  }

  private async _transferPoints() {
    if (!this._project?.group_id || !this._transferTo || this._transferAmount <= 0) return;
    try {
      await api.post(`/households/${this._project.group_id}/transfer`, {
        to_user_id: this._transferTo,
        amount: this._transferAmount,
        note: this._transferNote.trim() || null,
      });
      this._transferTo = '';
      this._transferAmount = 1;
      this._transferNote = '';
      await this._load();
      toast.success('Punten overgezet');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Overzetten mislukt: ${e.message}`);
    }
  }

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

      ${this._project?.group_id ? html`
        <div class="household-panel">
          <div class="panel-title">Inbox</div>
          <div class="inbox-list">
            ${this._notifications.length === 0 ? html`
              <div class="inbox-meta">Geen meldingen.</div>
            ` : this._notifications.map(item => {
              const offer = this._offers.find(o => o.id === item.offer_id);
              return html`
                <div class="inbox-item ${item.actionable ? 'actionable' : ''}">
                  <div class="inbox-title">${item.title}</div>
                  <div class="inbox-meta">${item.message}</div>
                  ${item.actionable && offer ? html`
                    <div class="inbox-actions">
                      <doen-button variant="primary" size="sm" @click=${() => this._handleInboxAction(offer, true)}>Goedkeuren</doen-button>
                      <doen-button variant="neutral" size="sm" @click=${() => this._handleInboxAction(offer, false)}>Afwijzen</doen-button>
                    </div>
                  ` : ''}
                </div>
              `;
            })}
          </div>
          <div class="panel-title">Huishoudsaldo</div>
          <div class="balance-row">
            ${this._balances.map(b => html`
              <span class="balance-chip ${b.balance < 0 ? 'negative' : 'positive'}">
                ${b.name}
                <span class="value">${b.balance}</span>
              </span>
            `)}
          </div>
          <div class="panel-title">Aanbiedingen</div>
          <div class="offer-list">
            ${this._offers.length === 0 ? html`
              <div class="offer-meta">Nog geen openstaande aanbiedingen.</div>
            ` : this._offers.map(offer => {
              const mine = this._me?.id === offer.owner_id;
              const canAccept = !mine && offer.status === 'open';
              const canDecide = mine && offer.status === 'requested';
              const canWithdraw = mine && offer.status === 'open';
              return html`
                <div class="offer-card">
                  <div class="offer-top">
                    <div>
                      <div class="offer-task">${offer.task_title}</div>
                      <div class="offer-meta">
                        ${offer.point_value} pt · ${offer.owner_name}
                        ${offer.reward_note ? html` · ${offer.reward_note}` : ''}
                        · ${offer.status}
                      </div>
                    </div>
                    <div class="offer-actions">
                      ${canAccept ? html`
                        <doen-button variant="primary" size="sm" @click=${() => this._acceptOffer(offer)}>Accepteren</doen-button>
                      ` : ''}
                      ${canDecide ? html`
                        <doen-button variant="primary" size="sm" @click=${() => this._decideOffer(offer, true)}>Goedkeuren</doen-button>
                        <doen-button variant="neutral" size="sm" @click=${() => this._decideOffer(offer, false)}>Afwijzen</doen-button>
                      ` : ''}
                      ${canWithdraw ? html`
                        <doen-button variant="neutral" size="sm" @click=${() => this._withdrawOffer(offer)}>Intrekken</doen-button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            })}
          </div>
          <div class="panel-title">Punten overzetten</div>
          <div class="offer-card">
            <div class="offer-meta">Stuur punten naar iemand anders als debt payment of onderlinge verrekening.</div>
            <div class="offer-actions">
              <doen-select
                label="Ontvanger"
                .value=${this._transferTo}
                .options=${[
                  { value: '', label: 'Kies iemand' } as SelectOption,
                  ...this._members
                    .filter((member) => member.user_id !== this._me?.id)
                    .map((member): SelectOption => ({ value: member.user_id, label: member.name })),
                ]}
                @doen-change=${(changeEvent: CustomEvent<{ value: string }>) => { this._transferTo = changeEvent.detail.value; }}
                required
              ></doen-select>
              <doen-input
                label="Punten"
                type="number"
                inputmode="numeric"
                min="1"
                style="max-width: 110px;"
                .value=${String(this._transferAmount)}
                @doen-input=${(inputEvent: CustomEvent<{ value: string }>) => {
                  this._transferAmount = Math.max(1, parseInt(inputEvent.detail.value, 10) || 1);
                }}
                required
              ></doen-input>
              <doen-input
                label="Notitie"
                placeholder="Optioneel"
                style="flex:1;min-width:160px"
                .value=${this._transferNote}
                @doen-input=${(inputEvent: CustomEvent<{ value: string }>) => { this._transferNote = inputEvent.detail.value; }}
              ></doen-input>
              <doen-button
                variant="primary"
                size="sm"
                style="align-self: flex-end;"
                ?disabled=${!this._transferTo || this._transferAmount <= 0}
                @click=${this._transferPoints}
              >Versturen</doen-button>
            </div>
          </div>
          <div class="panel-title">Recente transacties</div>
          <div class="transaction-list">
            ${this._transactions.length === 0 ? html`
              <div class="offer-meta">Nog geen transacties.</div>
            ` : this._transactions.map(tx => html`
              <div class="transaction-row">
                <div>
                  <div>${tx.user_name} · ${tx.kind}</div>
                  <div class="offer-meta">${tx.note ?? ''}</div>
                </div>
                <div class="amt ${tx.amount < 0 ? 'negative' : 'positive'}">
                  ${tx.amount > 0 ? '+' : ''}${tx.amount}
                </div>
              </div>
            `)}
          </div>
        </div>
      ` : ''}

      <div class="add-card">
        <doen-task-form .project=${this._project}></doen-task-form>
      </div>

      <div class="task-list"
        @offer-created=${() => this._refreshHousehold()}
        @offer-updated=${() => this._refreshHousehold()}
        @task-updated=${(e: CustomEvent<Task>) => { this.updateTask(e.detail); void this._refreshHousehold(); }}
        >
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
