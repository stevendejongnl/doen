import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { confirmPasswordReset } from '../services/auth';
import { ApiError } from '../services/api';
import { sharedStyles } from '../styles/shared-styles';

@customElement('page-reset')
export class PageReset extends LitElement {
  @property({ type: String }) token = '';

  @state() private _password = '';
  @state() private _password2 = '';
  @state() private _loading = false;
  @state() private _done = false;
  @state() private _error = '';

  static styles = [...sharedStyles, css`
    :host {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; width: 100%; flex: 1; min-height: 100vh;
      padding: 20px; gap: 16px; box-sizing: border-box;
    }

    .card {
      width: 100%; max-width: 380px; padding: 40px; border-radius: 24px;
      background: var(--glass-bg); border: 1px solid var(--glass-border);
      backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
      box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
    }

    .brand { text-align: center; margin-bottom: 36px; }
    .brand-icon {
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 14px; font-size: 22px; color: white;
      box-shadow: 0 8px 24px rgba(99,102,241,0.4);
    }
    .brand-name { font-size: 28px; font-weight: 800; color: var(--color-text); letter-spacing: -1px; }

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

    .btn {
      margin-top: 8px; background: linear-gradient(135deg, var(--color-accent), #8b5cf6);
      color: white; border: none; border-radius: 12px; padding: 13px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: opacity var(--transition-fast);
      display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 4px 20px rgba(99,102,241,0.35);
    }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; }

    .error {
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.22);
      border-radius: 10px; padding: 11px 14px; font-size: 12px; color: #fca5a5;
      display: flex; align-items: center; gap: 8px;
    }

    .success {
      background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.22);
      border-radius: 10px; padding: 16px; font-size: 13px; color: #86efac;
      text-align: center; line-height: 1.5;
    }

    .link-btn {
      background: none; border: none; padding: 0;
      color: rgba(99,102,241,0.8); font-size: 12px; cursor: pointer;
      text-align: center; margin-top: 4px; transition: color 120ms;
    }
    .link-btn:hover { color: #818cf8; }
  `];

  private async _submit(e: Event) {
    e.preventDefault();
    if (this._loading) return;
    if (this._password.length < 6) { this._error = 'Wachtwoord moet minstens 6 tekens zijn.'; return; }
    if (this._password !== this._password2) { this._error = 'Wachtwoorden komen niet overeen.'; return; }
    this._loading = true;
    this._error = '';
    try {
      await confirmPasswordReset(this.token, this._password);
      this._done = true;
    } catch (e) {
      this._error = e instanceof ApiError && e.status === 401
        ? 'Deze resetlink is verlopen of al gebruikt.'
        : 'Er ging iets mis. Probeer een nieuwe resetlink aan te vragen.';
    } finally {
      this._loading = false;
    }
  }

  private _goLogin() {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'login' }, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="card">
        <div class="brand">
          <div class="brand-icon"><i class="fa-solid fa-check-double"></i></div>
          <div class="brand-name">Doen</div>
        </div>

        ${this._done ? html`
          <div class="success">
            <i class="fa-solid fa-check-circle" style="font-size:24px;display:block;margin-bottom:10px;"></i>
            Wachtwoord ingesteld. Je kunt nu inloggen.
          </div>
          <button class="link-btn" style="margin-top:16px;" @click=${this._goLogin}>
            Naar inloggen
          </button>
        ` : html`
          <div class="mode-label">Nieuw wachtwoord instellen</div>
          <form class="form" @submit=${this._submit}>
            <label>Nieuw wachtwoord
              <input type="password" autocomplete="new-password" minlength="6"
                .value=${this._password}
                @input=${(e: Event) => this._password = (e.target as HTMLInputElement).value}
                ?disabled=${this._loading} required />
            </label>
            <label>Herhaal wachtwoord
              <input type="password" autocomplete="new-password" minlength="6"
                .value=${this._password2}
                @input=${(e: Event) => this._password2 = (e.target as HTMLInputElement).value}
                ?disabled=${this._loading} required />
            </label>
            ${this._error ? html`<div class="error"><i class="fa-solid fa-circle-exclamation"></i>${this._error}</div>` : ''}
            <button class="btn" type="submit"
              ?disabled=${this._loading || !this._password || !this._password2}>
              <i class="fa-solid fa-${this._loading ? 'spinner fa-spin' : 'key'}"></i>
              ${this._loading ? 'Opslaan...' : 'Wachtwoord instellen'}
            </button>
          </form>
        `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-reset': PageReset; }
}
