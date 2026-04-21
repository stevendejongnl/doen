import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { User } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';

@customElement('page-admin')
export class PageAdmin extends LitElement {
  @property({ type: Object }) me!: User;

  @state() private _users: User[] = [];
  @state() private _loading = true;
  @state() private _creating = false;
  @state() private _filter: 'all' | 'active' | 'disabled' = 'active';
  @state() private _search = '';
  @state() private _name = '';
  @state() private _email = '';
  @state() private _password = '';

  static styles = [...sharedStyles, css`
    :host { display: block; overflow-y: auto; height: 100%; }

    h1 { font-size: 24px; font-weight: 800; color: #e8eaf0; margin-bottom: 4px; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: rgba(232,234,240,0.45); margin-bottom: 28px; }

    .card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 18px; padding: 20px 22px; margin-bottom: 20px;
      backdrop-filter: blur(16px);
    }

    .section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.7px; color: rgba(232,234,240,0.4); margin-bottom: 14px;
    }

    .form-grid { display: flex; flex-direction: column; gap: 10px; }
    .form-row { display: flex; gap: 10px; flex-wrap: wrap; }

    input[type="text"], input[type="email"], input[type="password"], input[type="search"] {
      font: inherit; color: #e8eaf0;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 9px; padding: 10px 14px;
      outline: none; transition: border-color 120ms, background 120ms;
      flex: 1; min-width: 140px;
    }
    input:focus { border-color: #6366f1; background: rgba(255,255,255,0.1); }

    .toolbar {
      display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap;
    }

    .search-wrap { position: relative; flex: 1; min-width: 180px; }
    .search-wrap i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: rgba(232,234,240,0.35); font-size: 12px; pointer-events: none; }
    .search-wrap input { padding-left: 32px; width: 100%; }

    .filter-tabs { display: flex; gap: 4px; }
    .tab {
      padding: 6px 13px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1px solid transparent;
      color: rgba(232,234,240,0.5); background: none; transition: all 120ms;
    }
    .tab.active {
      background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.35);
      color: #a5b4fc;
    }
    .tab:hover:not(.active) { background: rgba(255,255,255,0.06); color: #e8eaf0; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 7px;
      background: #6366f1; color: white; border: none;
      border-radius: 9px; padding: 10px 18px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background 120ms; white-space: nowrap; flex-shrink: 0;
    }
    .btn-primary:hover { background: #818cf8; }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-icon {
      padding: 6px 9px; border-radius: 7px; border: none; cursor: pointer;
      font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;
      transition: background 120ms, color 120ms; white-space: nowrap;
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
      color: rgba(232,234,240,0.4); padding: 0 12px 10px;
    }
    td {
      padding: 10px 12px; font-size: 13px; color: #e8eaf0;
      border-top: 1px solid rgba(255,255,255,0.06); vertical-align: middle;
    }
    tr:hover td { background: rgba(255,255,255,0.03); }

    .avatar-sm {
      width: 26px; height: 26px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: white; vertical-align: middle;
      margin-right: 8px; flex-shrink: 0;
    }
    .avatar-disabled { background: rgba(255,255,255,0.1); }

    .badge {
      display: inline-block; padding: 2px 7px; border-radius: 5px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.3px; margin-left: 5px;
      vertical-align: middle;
    }
    .badge-admin { background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
    .badge-you { background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.25); }
    .badge-disabled { background: rgba(239,68,68,0.12); color: #fca5a5; border: 1px solid rgba(239,68,68,0.2); }

    .actions { display: flex; gap: 5px; flex-wrap: wrap; }

    .muted { color: rgba(232,234,240,0.4); font-size: 12px; }

    .sk { height: 44px; border-radius: 9px; margin-bottom: 6px;
      background: rgba(255,255,255,0.05);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
      background-size: 200% 100%;
    }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    .empty-state { text-align: center; padding: 32px; color: rgba(232,234,240,0.35); font-size: 13px; }

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

    return html`
      <h1>Gebruikers</h1>
      <p class="subtitle">Beheer accounts die toegang hebben tot Doen.</p>

      ${isAdmin ? html`
        <div class="card">
          <div class="section-label">Nieuw account aanmaken</div>
          <form class="form-grid" @submit=${this._createUser}>
            <div class="form-row">
              <input type="text" placeholder="Naam"
                .value=${this._name}
                @input=${(e: Event) => this._name = (e.target as HTMLInputElement).value} />
              <input type="email" placeholder="E-mailadres"
                .value=${this._email}
                @input=${(e: Event) => this._email = (e.target as HTMLInputElement).value} />
            </div>
            <div class="form-row">
              <input type="password" placeholder="Tijdelijk wachtwoord"
                .value=${this._password}
                @input=${(e: Event) => this._password = (e.target as HTMLInputElement).value} />
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
              @input=${(e: Event) => this._search = (e.target as HTMLInputElement).value} />
          </div>
          <div class="filter-tabs">
            ${(['active','all','disabled'] as const).map(f => html`
              <button class="tab ${this._filter === f ? 'active' : ''}"
                @click=${() => this._filter = f}>
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
                              ? html`<button class="btn-icon btn-success" @click=${() => this._enable(u)}>
                                  <i class="fa-solid fa-toggle-on"></i> Inschakelen
                                </button>`
                              : html`<button class="btn-icon btn-warning" @click=${() => this._disable(u)}>
                                  <i class="fa-solid fa-toggle-off"></i> Uitschakelen
                                </button>`
                            }
                            <button class="btn-icon btn-neutral" @click=${() => this._sendReset(u)}>
                              <i class="fa-solid fa-key"></i> Reset
                            </button>
                            <button class="btn-icon ${u.is_admin ? 'btn-warning' : 'btn-neutral'}"
                              @click=${() => this._toggleAdmin(u)}>
                              <i class="fa-solid fa-${u.is_admin ? 'user-minus' : 'user-shield'}"></i>
                              ${u.is_admin ? 'Admin intrekken' : 'Admin'}
                            </button>
                            <button class="btn-icon btn-danger" @click=${() => this._delete(u)}>
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-admin': PageAdmin; }
}
