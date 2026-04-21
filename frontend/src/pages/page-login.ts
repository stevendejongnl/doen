import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { login } from '../services/auth';
import { ApiError } from '../services/api';
import type { User } from '../services/types';
import { sharedStyles } from '../styles/shared-styles';

@customElement('page-login')
export class PageLogin extends LitElement {
  @state() private _email = '';
  @state() private _password = '';
  @state() private _loading = false;
  @state() private _error = '';

  static styles = [...sharedStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      flex: 1;
      min-height: 100vh;
      padding: 20px;
      gap: 16px;
      box-sizing: border-box;
    }

    .card {
      width: 100%;
      max-width: 380px;
      padding: 40px;
      border-radius: 24px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
    }

    @media (max-width: 480px) {
      :host { padding: 16px; }
      .card { padding: 28px 22px; border-radius: 20px; }
    }

    .brand {
      text-align: center;
      margin-bottom: 36px;
    }

    .brand-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 14px;
      font-size: 22px;
      color: white;
      box-shadow: 0 8px 24px rgba(99,102,241,0.4);
    }

    .brand-name {
      font-size: 28px;
      font-weight: 800;
      color: var(--color-text);
      letter-spacing: -1px;
    }

    .brand-sub {
      font-size: 13px;
      color: var(--color-text-muted);
      margin-top: 4px;
    }

    .form { display: flex; flex-direction: column; gap: 14px; }

    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-muted);
    }

    input {
      padding: 12px 16px;
      font-size: 14px;
      border-radius: 12px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: var(--color-text);
    }

    input:focus { border-color: var(--color-accent); background: rgba(255,255,255,0.1); }

    .btn-login {
      margin-top: 8px;
      background: linear-gradient(135deg, var(--color-accent), #8b5cf6);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 13px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity var(--transition-fast), transform var(--transition-fast);
      letter-spacing: 0.2px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(99,102,241,0.35);
    }

    .btn-login:hover:not(:disabled) { opacity: 0.9; }
    .btn-login:active:not(:disabled) { transform: scale(0.98); }
    .btn-login:disabled { opacity: 0.45; cursor: not-allowed; }

    .error {
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.22);
      border-radius: 10px;
      padding: 11px 14px;
      font-size: 12px;
      color: #fca5a5;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .version {
      font-size: 11px;
      color: rgba(232,234,240,0.25);
    }
  `];

  private async _submit(e: Event) {
    e.preventDefault();
    if (this._loading) return;
    this._loading = true;
    this._error = '';
    try {
      const user = await login(this._email, this._password);
      this.dispatchEvent(new CustomEvent<User>('logged-in', { detail: user, bubbles: true, composed: true }));
    } catch (e) {
      this._error = (e instanceof ApiError && e.status === 401)
        ? 'Verkeerd e-mailadres of wachtwoord.'
        : 'Verbinding mislukt. Probeer het later opnieuw.';
    } finally {
      this._loading = false;
    }
  }

  render() {
    return html`
      <div class="card">
        <div class="brand">
          <div class="brand-icon"><i class="fa-solid fa-check-double"></i></div>
          <div class="brand-name">Doen</div>
          <div class="brand-sub">want er is altijd wel iets</div>
        </div>

        <form class="form" @submit=${this._submit}>
          <label>
            E-mailadres
            <input type="email" autocomplete="email"
              .value=${this._email}
              @input=${(e: Event) => this._email = (e.target as HTMLInputElement).value}
              ?disabled=${this._loading} required />
          </label>
          <label>
            Wachtwoord
            <input type="password" autocomplete="current-password"
              .value=${this._password}
              @input=${(e: Event) => this._password = (e.target as HTMLInputElement).value}
              ?disabled=${this._loading} required />
          </label>

          ${this._error ? html`
            <div class="error">
              <i class="fa-solid fa-circle-exclamation"></i>
              ${this._error}
            </div>
          ` : ''}

          <button class="btn-login" type="submit" ?disabled=${this._loading}>
            <i class="fa-solid fa-${this._loading ? 'spinner fa-spin' : 'right-to-bracket'}"></i>
            ${this._loading ? 'Bezig...' : 'Inloggen'}
          </button>
        </form>
      </div>
      <span class="version">${__APP_VERSION__}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-login': PageLogin; }
}
