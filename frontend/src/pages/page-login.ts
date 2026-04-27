import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { login, registerFirst, requestPasswordReset, getAuthStatus } from '../services/auth';
import { ApiError } from '../services/api';
import type { User } from '../services/types';
import { sharedStyles } from '../styles/shared-styles';
import { inputValue } from '../utils/form';

type Mode = 'login' | 'register-first' | 'forgot';

@customElement('page-login')
export class PageLogin extends LitElement {
  @state() private _mode: Mode = 'login';
  @state() private _email = '';
  @state() private _password = '';
  @state() private _name = '';
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _resetSent = false;

  static styles = [...sharedStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      flex: 1;
      min-height: 100dvh;
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

    .brand { text-align: center; margin-bottom: 36px; }

    .brand-icon {
      width: 56px; height: 56px; border-radius: 16px;
      background: var(--color-accent-gradient);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 14px; font-size: 22px; color: white;
      box-shadow: 0 8px 24px rgba(99,102,241,0.4);
    }

    .brand-name { font-size: 28px; font-weight: 800; color: var(--color-text); letter-spacing: -1px; }
    .brand-sub { font-size: 13px; color: var(--color-text-muted); margin-top: 4px; }

    .mode-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.7px; color: rgba(99,102,241,0.8);
      margin-bottom: 18px; text-align: center;
    }

    .form { display: flex; flex-direction: column; gap: 14px; }

    label {
      display: flex; flex-direction: column; gap: 6px;
      font-size: 12px; font-weight: 500; color: var(--color-text-muted);
    }

    input {
      padding: 12px 16px; font-size: 14px; border-radius: 12px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: var(--color-text);
    }
    input:focus { border-color: var(--color-accent); background: rgba(255,255,255,0.1); }

    .btn-login {
      margin-top: 8px;
      background: linear-gradient(135deg, var(--color-accent), #8b5cf6);
      color: white; border: none; border-radius: 12px; padding: 13px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: opacity var(--transition-fast), transform var(--transition-fast);
      display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 4px 20px rgba(99,102,241,0.35);
    }
    .btn-login:hover:not(:disabled) { opacity: 0.9; }
    .btn-login:active:not(:disabled) { transform: scale(0.98); }
    .btn-login:disabled { opacity: 0.45; cursor: not-allowed; }

    .link-btn {
      background: none; border: none; padding: 0;
      color: rgba(99,102,241,0.8); font-size: 12px; cursor: pointer;
      text-align: center; margin-top: 4px;
      transition: color var(--transition-fast);
    }
    .link-btn:hover { color: var(--color-accent-hover); }

    .error {
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.22);
      border-radius: 10px; padding: 11px 14px; font-size: 12px; color: #fca5a5;
      display: flex; align-items: center; gap: 8px;
    }

    .success {
      background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.22);
      border-radius: 10px; padding: 11px 14px; font-size: 12px; color: #86efac;
      display: flex; align-items: center; gap: 8px;
    }

    .setup-banner {
      background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25);
      border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;
      font-size: 12px; color: rgba(199,210,254,0.85); line-height: 1.5;
    }

    .version { font-size: 11px; color: var(--color-text-muted); }
  `];

  async connectedCallback() {
    super.connectedCallback();
    const status = await getAuthStatus();
    if (!status.has_users) this._mode = 'register-first';
  }

  private async _submitLogin(e: Event) {
    e.preventDefault();
    if (this._loading) return;
    this._loading = true;
    this._error = '';
    try {
      const user = await login(this._email, this._password);
      this.dispatchEvent(new CustomEvent<User>('logged-in', { detail: user as unknown as User, bubbles: true, composed: true }));
    } catch (e) {
      this._error = (e instanceof ApiError && e.status === 401)
        ? 'Verkeerd e-mailadres of wachtwoord.'
        : e instanceof ApiError && e.status === 403
        ? 'Dit account is uitgeschakeld.'
        : 'Verbinding mislukt. Probeer het later opnieuw.';
    } finally {
      this._loading = false;
    }
  }

  private async _submitRegisterFirst(e: Event) {
    e.preventDefault();
    if (this._loading) return;
    if (this._password.length < 6) { this._error = 'Wachtwoord moet minstens 6 tekens zijn.'; return; }
    this._loading = true;
    this._error = '';
    try {
      const user = await registerFirst(this._email, this._name, this._password);
      this.dispatchEvent(new CustomEvent<User>('logged-in', { detail: user as unknown as User, bubbles: true, composed: true }));
    } catch (e) {
      this._error = e instanceof ApiError ? `Registratie mislukt: ${e.message}` : 'Verbinding mislukt.';
    } finally {
      this._loading = false;
    }
  }

  private async _submitForgot(e: Event) {
    e.preventDefault();
    if (this._loading || !this._email) return;
    this._loading = true;
    this._error = '';
    try {
      await requestPasswordReset(this._email);
      this._resetSent = true;
    } catch {
      this._resetSent = true; // don't leak account existence
    } finally {
      this._loading = false;
    }
  }

  private _onEmailInput = (e: Event) => { this._email = inputValue(e); };
  private _onPasswordInput = (e: Event) => { this._password = inputValue(e); };
  private _onNameInput = (e: Event) => { this._name = inputValue(e); };

  private _goToForgot = () => { this._mode = 'forgot'; this._error = ''; this._resetSent = false; };
  private _backToLogin = () => { this._mode = 'login'; this._error = ''; };
  private _backToLoginAfterSent = () => { this._mode = 'login'; this._resetSent = false; };

  private _renderBrand() {
    return html`
      <div class="brand">
        <div class="brand-icon"><i class="fa-solid fa-check-double"></i></div>
        <div class="brand-name">Doen</div>
        <div class="brand-sub">want er is altijd wel iets</div>
      </div>
    `;
  }

  private _renderLogin() {
    return html`
      ${this._renderBrand()}
      <form class="form" @submit=${this._submitLogin}>
        <label>E-mailadres
          <input type="email" autocomplete="email" .value=${this._email}
            @input=${this._onEmailInput}
            ?disabled=${this._loading} required />
        </label>
        <label>Wachtwoord
          <input type="password" autocomplete="current-password" .value=${this._password}
            @input=${this._onPasswordInput}
            ?disabled=${this._loading} required />
        </label>
        ${this._error ? html`<div class="error"><i class="fa-solid fa-circle-exclamation"></i>${this._error}</div>` : ''}
        <button class="btn-login" type="submit" ?disabled=${this._loading}>
          <i class="fa-solid fa-${this._loading ? 'spinner fa-spin' : 'right-to-bracket'}"></i>
          ${this._loading ? 'Bezig...' : 'Inloggen'}
        </button>
      </form>
      <button class="link-btn" @click=${this._goToForgot}>
        Wachtwoord vergeten?
      </button>
    `;
  }

  private _renderRegisterFirst() {
    return html`
      ${this._renderBrand()}
      <div class="setup-banner">
        <strong>Eerste keer opstarten</strong><br />
        Maak een beheerdersaccount aan. Dit is het enige account dat je zelf kunt aanmaken — verdere gebruikers worden daarna door de beheerder toegevoegd.
      </div>
      <div class="mode-label">Beheerder aanmaken</div>
      <form class="form" @submit=${this._submitRegisterFirst}>
        <label>Naam
          <input type="text" autocomplete="name" .value=${this._name}
            @input=${this._onNameInput}
            ?disabled=${this._loading} required />
        </label>
        <label>E-mailadres
          <input type="email" autocomplete="email" .value=${this._email}
            @input=${this._onEmailInput}
            ?disabled=${this._loading} required />
        </label>
        <label>Wachtwoord
          <input type="password" autocomplete="new-password" minlength="6" .value=${this._password}
            @input=${this._onPasswordInput}
            ?disabled=${this._loading} required />
        </label>
        ${this._error ? html`<div class="error"><i class="fa-solid fa-circle-exclamation"></i>${this._error}</div>` : ''}
        <button class="btn-login" type="submit"
          ?disabled=${this._loading || !this._name.trim() || !this._email || !this._password}>
          <i class="fa-solid fa-${this._loading ? 'spinner fa-spin' : 'user-shield'}"></i>
          ${this._loading ? 'Bezig...' : 'Account aanmaken'}
        </button>
      </form>
    `;
  }

  private _renderForgot() {
    if (this._resetSent) return html`
      ${this._renderBrand()}
      <div class="success">
        <i class="fa-solid fa-envelope-circle-check"></i>
        Als er een account bestaat voor dit e-mailadres, ontvang je een resetlink.
      </div>
      <button class="link-btn" @click=${this._backToLoginAfterSent}>
        Terug naar inloggen
      </button>
    `;

    return html`
      ${this._renderBrand()}
      <div class="mode-label">Wachtwoord herstellen</div>
      <form class="form" @submit=${this._submitForgot}>
        <label>E-mailadres
          <input type="email" autocomplete="email" .value=${this._email}
            @input=${this._onEmailInput}
            ?disabled=${this._loading} required />
        </label>
        ${this._error ? html`<div class="error"><i class="fa-solid fa-circle-exclamation"></i>${this._error}</div>` : ''}
        <button class="btn-login" type="submit" ?disabled=${this._loading || !this._email}>
          <i class="fa-solid fa-${this._loading ? 'spinner fa-spin' : 'paper-plane'}"></i>
          ${this._loading ? 'Bezig...' : 'Resetlink sturen'}
        </button>
      </form>
      <button class="link-btn" @click=${this._backToLogin}>
        Terug naar inloggen
      </button>
    `;
  }

  render() {
    return html`
      <div class="card">
        ${this._mode === 'login' ? this._renderLogin()
          : this._mode === 'register-first' ? this._renderRegisterFirst()
          : this._renderForgot()}
      </div>
      <span class="version">${__APP_VERSION__}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-login': PageLogin; }
}
