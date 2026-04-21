import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { User } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';

@customElement('page-admin')
export class PageAdmin extends LitElement {
  @state() private _users: User[] = [];
  @state() private _loading = true;
  @state() private _creating = false;
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
      border-radius: 18px;
      padding: 20px 22px;
      margin-bottom: 20px;
      backdrop-filter: blur(16px);
    }

    .section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.7px; color: rgba(232,234,240,0.4); margin-bottom: 14px;
    }

    .form-grid { display: flex; flex-direction: column; gap: 10px; }
    .form-row { display: flex; gap: 10px; flex-wrap: wrap; }

    input {
      font: inherit; color: #e8eaf0;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 9px; padding: 10px 14px;
      outline: none; transition: border-color 120ms, background 120ms;
      flex: 1; min-width: 140px;
    }
    input:focus { border-color: #6366f1; background: rgba(255,255,255,0.1); }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 7px;
      background: #6366f1; color: white; border: none;
      border-radius: 9px; padding: 10px 18px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background 120ms; white-space: nowrap; flex-shrink: 0;
    }
    .btn-primary:hover { background: #818cf8; }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.6px;
      color: rgba(232,234,240,0.4); padding: 0 12px 10px;
    }
    td {
      padding: 10px 12px; font-size: 13px; color: #e8eaf0;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    tr:hover td { background: rgba(255,255,255,0.03); }

    .avatar-sm {
      width: 26px; height: 26px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: white; vertical-align: middle;
      margin-right: 8px;
    }

    .sk { height: 44px; border-radius: 9px; margin-bottom: 6px;
      background: rgba(255,255,255,0.05);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
      background-size: 200% 100%;
    }

    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    @media (max-width: 768px) { h1 { font-size: 20px; } }

    @media (max-width: 480px) {
      table, thead, tbody, tr, th, td { display: block; }
      thead { display: none; }
      tr {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 0;
        border-top: 1px solid rgba(255,255,255,0.06);
      }
      tr:first-child { border-top: none; }
      td { padding: 2px 4px; border-top: none; }
      td:first-child { font-weight: 600; }
      td:not(:first-child) {
        font-size: 12px;
        color: rgba(232,234,240,0.55);
        padding-left: 38px;
      }
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
      const user = await api.post<User>('/auth/register', {
        name: this._name.trim(),
        email: this._email.trim(),
        password: this._password,
      });
      this._users = [...this._users, user];
      this._name = ''; this._email = ''; this._password = '';
      toast.success(`Gebruiker "${user.name}" aangemaakt!`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Aanmaken mislukt: ${e.message}`);
    } finally {
      this._creating = false;
    }
  }

  render() {
    return html`
      <h1>Gebruikers</h1>
      <p class="subtitle">Beheer accounts die toegang hebben tot Doen.</p>

      <div class="card">
        <div class="section-label">Nieuw account aanmaken</div>
        <form class="form-grid" @submit=${this._createUser}>
          <div class="form-row">
            <input type="text" placeholder="Naam"
              .value=${this._name}
              @input=${(e: Event) => this._name = (e.target as HTMLInputElement).value}
            />
            <input type="email" placeholder="E-mailadres"
              .value=${this._email}
              @input=${(e: Event) => this._email = (e.target as HTMLInputElement).value}
            />
          </div>
          <div class="form-row">
            <input type="password" placeholder="Wachtwoord"
              .value=${this._password}
              @input=${(e: Event) => this._password = (e.target as HTMLInputElement).value}
            />
            <button type="submit" class="btn-primary"
              ?disabled=${this._creating || !this._name.trim() || !this._email.trim() || !this._password.trim()}>
              <i class="fa-solid fa-${this._creating ? 'spinner fa-spin' : 'user-plus'}"></i>
              Aanmaken
            </button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="section-label">Alle gebruikers</div>
        ${this._loading ? html`
          ${[1,2,3].map(() => html`<div class="sk"></div>`)}
        ` : html`
          <table>
            <thead>
              <tr>
                <th>Naam</th>
                <th>E-mail</th>
              </tr>
            </thead>
            <tbody>
              ${this._users.map(u => html`
                <tr>
                  <td>
                    <span class="avatar-sm">${u.name.charAt(0).toUpperCase()}</span>
                    ${u.name}
                  </td>
                  <td>${u.email}</td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-admin': PageAdmin; }
}
