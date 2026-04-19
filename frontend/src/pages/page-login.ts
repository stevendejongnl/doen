import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { login } from '../services/auth';
import { ApiError } from '../services/api';
import type { User } from '../services/types';

@customElement('page-login')
export class PageLogin extends LitElement {
  @state() private _email = '';
  @state() private _password = '';
  @state() private _loading = false;
  @state() private _error = '';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0f1117;
    }

    .card {
      width: 100%;
      max-width: 380px;
      padding: 40px;
      border-radius: 20px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(12px);
      box-shadow: 0 24px 64px rgba(0,0,0,0.4);
    }

    .brand {
      text-align: center;
      margin-bottom: 32px;
    }

    .brand-name {
      font-size: 36px;
      font-weight: 800;
      color: #e8eaf0;
      letter-spacing: -1px;
    }

    .brand-sub {
      font-size: 13px;
      color: rgba(232,234,240,0.4);
      margin-top: 4px;
    }

    .form { display: flex; flex-direction: column; gap: 14px; }

    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: rgba(232,234,240,0.6);
    }

    input {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 11px 16px;
      color: #e8eaf0;
      font-size: 14px;
      outline: none;
      transition: border-color 120ms ease-out;
    }

    input:focus { border-color: #6366f1; }

    .btn-login {
      margin-top: 8px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 10px;
      padding: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease-out, transform 120ms ease-out;
      letter-spacing: 0.2px;
    }

    .btn-login:hover:not(:disabled) { background: #818cf8; }
    .btn-login:active:not(:disabled) { transform: scale(0.98); }
    .btn-login:disabled { opacity: 0.5; cursor: not-allowed; }

    .error {
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      color: #fca5a5;
    }
  `;

  private async _submit(e: Event) {
    e.preventDefault();
    if (this._loading) return;
    this._loading = true;
    this._error = '';

    try {
      const user = await login(this._email, this._password);
      this.dispatchEvent(new CustomEvent<User>('logged-in', {
        detail: user,
        bubbles: true,
        composed: true,
      }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        this._error = 'Verkeerd e-mailadres of wachtwoord. Probeer het nog eens, tenzij je het echt bent vergeten.';
      } else {
        this._error = 'Verbinding mislukt. Is de backend wel aan?';
      }
    } finally {
      this._loading = false;
    }
  }

  render() {
    return html`
      <div class="card">
        <div class="brand">
          <div class="brand-name">Doen</div>
          <div class="brand-sub">want er is altijd wel iets</div>
        </div>

        <form class="form" @submit=${this._submit}>
          <label>
            E-mailadres
            <input
              type="email"
              autocomplete="email"
              .value=${this._email}
              @input=${(e: Event) => this._email = (e.target as HTMLInputElement).value}
              ?disabled=${this._loading}
              required
            />
          </label>
          <label>
            Wachtwoord
            <input
              type="password"
              autocomplete="current-password"
              .value=${this._password}
              @input=${(e: Event) => this._password = (e.target as HTMLInputElement).value}
              ?disabled=${this._loading}
              required
            />
          </label>

          ${this._error ? html`<div class="error">${this._error}</div>` : ''}

          <button class="btn-login" type="submit" ?disabled=${this._loading}>
            ${this._loading ? 'Bezig...' : 'Inloggen'}
          </button>
        </form>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-login': PageLogin;
  }
}
