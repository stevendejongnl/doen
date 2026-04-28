import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { User } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import { inputValue } from '../utils/form';
import { PullToRefreshController } from '../utils/pull-to-refresh';

@customElement('page-admin')
export class PageAdmin extends LitElement {
  @property({ type: Object }) me!: User;

  private _ptr = new PullToRefreshController(this, () => this._load());

  @state() private _users: User[] = [];
  @state() private _loading = true;
  @state() private _creating = false;
  @state() private _filter: 'all' | 'active' | 'disabled' = 'active';
  @state() private _search = '';
  @state() private _name = '';
  @state() private _email = '';
  @state() private _password = '';

  static styles = [...sharedStyles, css`
    :host { display: block; overflow-y: auto; height: 100%; position: relative; overscroll-behavior-y: contain; }

    h1 { font-size: 24px; font-weight: 800; color: var(--color-text); margin-bottom: 4px; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: var(--color-text-muted); margin-bottom: 28px; }

    .card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: var(--radius-card); padding: 20px 22px; margin-bottom: 20px;
      backdrop-filter: blur(16px);
    }

    .section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.7px; color: var(--color-text-muted); margin-bottom: 14px;
    }

    .form-grid { display: flex; flex-direction: column; gap: 10px; }
    .form-row { display: flex; gap: 10px; flex-wrap: wrap; }

    input[type="text"], input[type="email"], input[type="password"], input[type="search"] {
      font: inherit; color: var(--color-text);
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: var(--radius-sm); padding: 10px 14px;
      outline: none; transition: border-color var(--transition-fast), background var(--transition-fast);
      flex: 1; min-width: 140px;
    }
    input:focus { border-color: var(--color-accent); background: rgba(255,255,255,0.1); }

    .toolbar {
      display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap;
    }

    .search-wrap { position: relative; flex: 1; min-width: 180px; }
    .search-wrap i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); font-size: 12px; pointer-events: none; }
    .search-wrap input { padding-left: 32px; width: 100%; }

    .filter-tabs { display: flex; gap: 4px; }
    .tab {
      padding: 6px 13px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1px solid transparent;
      color: var(--color-text-muted); background: none; transition: all var(--transition-fast);
    }
    .tab.active {
      background: var(--color-accent-subtle); border-color: rgba(99,102,241,0.35);
      color: #a5b4fc;
    }
    .tab:hover:not(.active) { background: rgba(255,255,255,0.06); color: #e8eaf0; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 7px;
      background: var(--color-accent); color: white; border: none;
      border-radius: var(--radius-sm); padding: 10px 18px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background var(--transition-fast); white-space: nowrap; flex-shrink: 0;
    }
    .btn-primary:hover { background: var(--color-accent-hover); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-icon {
      padding: 6px 9px; border-radius: var(--radius-sm); border: none; cursor: pointer;
      font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;
      transition: background var(--transition-fast), color var(--transition-fast); white-space: nowrap;
    }
    .btn-danger { background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }
    .btn-danger:hover { background: rgba(239,68,68,0.2); }
    .btn-warning { background: rgba(251,191,36,0.1); color: #fcd34d; border: 1px solid rgba(251,191,36,0.2); }
    .btn-warning:hover { background: rgba(251,191,36,0.2); }
    .btn-success { background: rgba(34,197,94,0.1); color: #86efac; border: 1px solid rgba(34,197,94,0.2); }
    .btn-success:hover { background: rgba(34,197,94,0.2); }
    .btn-neutral { background: rgba(255,255,255,0.07); color: rgba(232,234,240,0.7); border: 1px solid rgba(255,255,255,0.1); }
    .btn-neutral:hover { background: rgba(255,255,255,0.12); }

    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.6px;
      color: var(--color-text-muted); padding: 0 12px 10px;
    }
    td {
      padding: 10px 12px; font-size: 13px; color: var(--color-text);
      border-top: 1px solid rgba(255,255,255,0.06); vertical-align: middle;
    }
    tr:hover td { background: rgba(255,255,255,0.03); }

    .avatar-sm {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--color-accent-gradient);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: white; vertical-align: middle;
      margin-right: 8px; flex-shrink: 0;
    }
    .avatar-disabled { background: rgba(255,255,255,0.1); }

    .badge {
      display: inline-block; padding: 2px 7px; border-radius: var(--radius-xs);
      font-size: 10px; font-weight: 700; letter-spacing: 0.3px; margin-left: 5px;
      vertical-align: middle;
    }
    .badge-admin { background: var(--color-accent-subtle); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
    .badge-you { background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.25); }
    .badge-disabled { background: rgba(239,68,68,0.12); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }

    .actions { display: flex; gap: 5px; flex-wrap: wrap; }

    .muted { color: var(--color-text-muted); font-size: 12px; }

    .sk { height: 44px; border-radius: var(--radius-sm); margin-bottom: 6px;
      background: rgba(255,255,255,0.05);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
      background-size: 200% 100%;
    }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    .empty-state { text-align: center; padding: 32px; color: var(--color-text-muted); font-size: 13px; }

    @media (max-width: 768px) { h1 { font-size: 20px; } }
    @media (max-width: 600px) {
      .actions { flex-direction: column; }
      td:last-child { padding-top: 0; }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this._loading = true;
    try {
      this._users = await api.get<User[]>('/auth/users');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Laden mislukt: ${e.message}`);
    } finally {
      this._loading = false;
    }
  }

  private async _createUser(e: Event) {
    e.preventDefault();
    if (!this._name.trim() || !this._email.trim() || !this._password.trim()) return;
    this._creating = true;
    try {
      const user = await api.post<User>('/auth/users', {
        name: this._name.trim(),
        email: this._email.trim(),
        password: this._password,
      });
      this._users = [...this._users, user];
      this._name = ''; this._email = ''; this._password = '';
      toast.success(`Gebruiker "${user.name}" aangemaakt.`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Aanmaken mislukt: ${e.message}`);
    } finally {
      this._creating = false;
    }
  }

  private async _disable(user: User) {
    if (!confirm(`${user.name} uitschakelen? Ze kunnen niet meer inloggen.`)) return;
    try {
      const updated = await api.post<User>(`/auth/users/${user.id}/disable`, {});
      this._replaceUser(updated);
      toast.success(`${user.name} uitgeschakeld.`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Mislukt: ${e.message}`);
    }
  }

  private async _enable(user: User) {
    try {
      const updated = await api.post<User>(`/auth/users/${user.id}/enable`, {});
      this._replaceUser(updated);
      toast.success(`${user.name} weer ingeschakeld.`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Mislukt: ${e.message}`);
    }
  }

  private async _toggleAdmin(user: User) {
    const newVal = !user.is_admin;
    const label = newVal ? 'beheerder maken' : 'beheerdersrechten intrekken';
    if (!confirm(`${user.name} ${label}?`)) return;
    try {
      const updated = await api.post<User>(`/auth/users/${user.id}/admin`, { is_admin: newVal });
      this._replaceUser(updated);
      toast.success(`${user.name}: ${newVal ? 'beheerder' : 'gewone gebruiker'}.`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Mislukt: ${e.message}`);
    }
  }

  private async _sendReset(user: User) {
    try {
      await api.post(`/auth/users/${user.id}/send-reset`, {});
      toast.success(`Resetlink verstuurd naar ${user.email}.`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Mislukt: ${e.message}`);
    }
  }

  private async _delete(user: User) {
    if (!confirm(`${user.name} permanent verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    try {
      await api.delete(`/auth/users/${user.id}`);
      this._users = this._users.filter(u => u.id !== user.id);
      toast.success(`${user.name} verwijderd.`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Verwijderen mislukt: ${e.message}`);
    }
  }

  private _onNameInput = (e: Event) => { this._name = inputValue(e); };
  private _onEmailInput = (e: Event) => { this._email = inputValue(e); };
  private _onPasswordInput = (e: Event) => { this._password = inputValue(e); };
  private _onSearchInput = (e: Event) => { this._search = inputValue(e); };

  private _onFilterTabClick = (e: Event) => {
    const f = (e.currentTarget as HTMLElement).dataset.filter as 'all' | 'active' | 'disabled';
    this._filter = f;
  };

  private _onEnableClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.userId!;
    const user = this._users.find(u => u.id === id);
    if (user) this._enable(user);
  };

  private _onDisableClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.userId!;
    const user = this._users.find(u => u.id === id);
    if (user) this._disable(user);
  };

  private _onSendResetClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.userId!;
    const user = this._users.find(u => u.id === id);
    if (user) this._sendReset(user);
  };

  private _onToggleAdminClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.userId!;
    const user = this._users.find(u => u.id === id);
    if (user) this._toggleAdmin(user);
  };

  private _onDeleteClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.userId!;
    const user = this._users.find(u => u.id === id);
    if (user) this._delete(user);
  };

  private _replaceUser(updated: User) {
    this._users = this._users.map(u => u.id === updated.id ? updated : u);
  }

  private _filtered(): User[] {
    let list = this._users;
    if (this._filter === 'active') list = list.filter(u => !u.disabled_at);
    else if (this._filter === 'disabled') list = list.filter(u => !!u.disabled_at);
    if (this._search.trim()) {
      const q = this._search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }

  private _fmt(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
  }

  render() {
    const filtered = this._filtered();
    const isAdmin = this.me?.is_admin;

    return this._ptr.wrap(html`
      <h1>Gebruikers</h1>
      <p class="subtitle">Beheer accounts die toegang hebben tot Doen.</p>

      ${isAdmin ? html`
        <div class="card">
          <div class="section-label">Nieuw account aanmaken</div>
          <form class="form-grid" @submit=${this._createUser}>
            <div class="form-row">
              <input type="text" placeholder="Naam"
                .value=${this._name}
                @input=${this._onNameInput} />
              <input type="email" placeholder="E-mailadres"
                .value=${this._email}
                @input=${this._onEmailInput} />
            </div>
            <div class="form-row">
              <input type="password" placeholder="Tijdelijk wachtwoord"
                .value=${this._password}
                @input=${this._onPasswordInput} />
              <button type="submit" class="btn-primary"
                ?disabled=${this._creating || !this._name.trim() || !this._email.trim() || !this._password.trim()}>
                <i class="fa-solid fa-${this._creating ? 'spinner fa-spin' : 'user-plus'}"></i>
                Aanmaken
              </button>
            </div>
          </form>
        </div>
      ` : ''}

      <div class="card">
        <div class="toolbar">
          <div class="search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" placeholder="Zoeken op naam of e-mail"
              .value=${this._search}
              @input=${this._onSearchInput} />
          </div>
          <div class="filter-tabs">
            ${(['active','all','disabled'] as const).map(f => html`
              <button class="tab ${this._filter === f ? 'active' : ''}"
                data-filter=${f}
                @click=${this._onFilterTabClick}>
                ${f === 'active' ? 'Actief' : f === 'disabled' ? 'Uitgeschakeld' : 'Alle'}
              </button>
            `)}
          </div>
        </div>

        ${this._loading ? html`${[1,2,3].map(() => html`<div class="sk"></div>`)}` : html`
          ${filtered.length === 0 ? html`<div class="empty-state">Geen gebruikers gevonden.</div>` : html`
            <table>
              <thead><tr>
                <th>Naam</th>
                <th>E-mail</th>
                <th>Laatste login</th>
                ${isAdmin ? html`<th></th>` : ''}
              </tr></thead>
              <tbody>
                ${filtered.map(u => html`
                  <tr>
                    <td>
                      <span class="avatar-sm ${u.disabled_at ? 'avatar-disabled' : ''}">
                        ${u.name.charAt(0).toUpperCase()}
                      </span>
                      ${u.name}
                      ${u.id === this.me?.id ? html`<span class="badge badge-you">jij</span>` : ''}
                      ${u.is_admin ? html`<span class="badge badge-admin">admin</span>` : ''}
                      ${u.disabled_at ? html`<span class="badge badge-disabled">uitgeschakeld</span>` : ''}
                    </td>
                    <td class="${u.disabled_at ? 'muted' : ''}">${u.email}</td>
                    <td class="muted">${this._fmt(u.last_login_at)}</td>
                    ${isAdmin ? html`
                      <td>
                        <div class="actions">
                          ${u.id !== this.me?.id ? html`
                            ${u.disabled_at
                              ? html`<button class="btn-icon btn-success" data-user-id=${u.id} @click=${this._onEnableClick}>
                                  <i class="fa-solid fa-toggle-on"></i> Inschakelen
                                </button>`
                              : html`<button class="btn-icon btn-warning" data-user-id=${u.id} @click=${this._onDisableClick}>
                                  <i class="fa-solid fa-toggle-off"></i> Uitschakelen
                                </button>`
                            }
                            <button class="btn-icon btn-neutral" data-user-id=${u.id} @click=${this._onSendResetClick}>
                              <i class="fa-solid fa-key"></i> Reset
                            </button>
                            <button class="btn-icon ${u.is_admin ? 'btn-warning' : 'btn-neutral'}"
                              data-user-id=${u.id}
                              @click=${this._onToggleAdminClick}>
                              <i class="fa-solid fa-${u.is_admin ? 'user-minus' : 'user-shield'}"></i>
                              ${u.is_admin ? 'Admin intrekken' : 'Admin'}
                            </button>
                            <button class="btn-icon btn-danger" data-user-id=${u.id} @click=${this._onDeleteClick}>
                              <i class="fa-solid fa-trash"></i>
                            </button>
                          ` : html`<span class="muted" style="font-size:11px;">Dat ben jij</span>`}
                        </div>
                      </td>
                    ` : ''}
                  </tr>
                `)}
              </tbody>
            </table>
          `}
        `}
      </div>
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-admin': PageAdmin; }
}
