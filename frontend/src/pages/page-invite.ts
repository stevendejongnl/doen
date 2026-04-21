import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { api, ApiError } from '../services/api';
import { isLoggedIn, getMe } from '../services/auth';
import { sharedStyles } from '../styles/shared-styles';

interface InvitationDetails {
  group_id: string;
  group_name: string;
  inviter_name: string;
  email: string;
  existing_user: boolean;
}

interface AcceptResponse {
  group_id: string;
  user_id: string;
  tokens: { access_token: string; refresh_token: string } | null;
}

@customElement('page-invite')
export class PageInvite extends LitElement {
  @property({ type: String }) token = '';

  @state() private _loading = true;
  @state() private _error = '';
  @state() private _details: InvitationDetails | null = null;
  @state() private _currentEmail: string | null = null;
  @state() private _name = '';
  @state() private _password = '';
  @state() private _submitting = false;
  @state() private _success = false;

  static styles = [...sharedStyles, css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 420px;
      padding: 40px;
      border-radius: 24px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      box-shadow: 0 32px 80px rgba(0,0,0,0.5);
    }
    h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; margin: 0 0 6px 0; color: var(--color-text); }
    p { margin: 0 0 18px 0; color: var(--color-text-muted); font-size: 14px; line-height: 1.5; }
    strong { color: var(--color-text); }
    .form { display: flex; flex-direction: column; gap: 12px; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--color-text-muted); }
    input {
      padding: 12px 16px; font-size: 14px; border-radius: 12px;
      background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
      color: var(--color-text);
    }
    input:focus { border-color: var(--color-accent); background: rgba(255,255,255,0.1); outline: none; }
    input[disabled] { opacity: 0.6; }
    .btn {
      margin-top: 6px; padding: 13px; font-size: 14px; font-weight: 600;
      background: linear-gradient(135deg, var(--color-accent), #8b5cf6);
      color: white; border: none; border-radius: 12px; cursor: pointer;
      box-shadow: 0 4px 20px rgba(99,102,241,0.35);
    }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .error {
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.22);
      border-radius: 10px; padding: 11px 14px; font-size: 13px; color: #fca5a5;
    }
    .muted { font-size: 12px; color: var(--color-text-muted); margin-top: 6px; }
  `];

  async connectedCallback() {
    super.connectedCallback();
    await this._load();
  }

  private async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._details = await api.get<InvitationDetails>(`/invitations/${this.token}`);
      if (isLoggedIn()) {
        try {
          const me = await getMe();
          this._currentEmail = me.email;
        } catch {
          this._currentEmail = null;
        }
      }
    } catch (e) {
      this._error = e instanceof ApiError
        ? (e.status === 410 ? 'Deze uitnodiging is verlopen of al gebruikt.' : e.message)
        : 'Kan uitnodiging niet laden.';
    } finally {
      this._loading = false;
    }
  }

  private async _acceptAsExistingUser() {
    if (!this._details) return;
    this._submitting = true;
    this._error = '';
    try {
      await api.post<AcceptResponse>(`/invitations/${this.token}/accept`, {});
      this._success = true;
      setTimeout(() => { window.location.href = '/'; }, 1200);
    } catch (e) {
      this._error = e instanceof ApiError ? e.message : 'Accepteren mislukt.';
    } finally {
      this._submitting = false;
    }
  }

  private async _acceptWithSignup(e: Event) {
    e.preventDefault();
    if (!this._details || !this._name.trim() || this._password.length < 6) return;
    this._submitting = true;
    this._error = '';
    try {
      const res = await api.post<AcceptResponse>(`/invitations/${this.token}/accept`, {
        name: this._name.trim(),
        password: this._password,
      });
      if (res.tokens) {
        localStorage.setItem('access_token', res.tokens.access_token);
        localStorage.setItem('refresh_token', res.tokens.refresh_token);
      }
      this._success = true;
      setTimeout(() => { window.location.href = '/'; }, 1200);
    } catch (e) {
      this._error = e instanceof ApiError ? e.message : 'Account aanmaken mislukt.';
    } finally {
      this._submitting = false;
    }
  }

  render() {
    if (this._loading) {
      return html`<div class="card"><p>Uitnodiging laden...</p></div>`;
    }
    if (this._error && !this._details) {
      return html`<div class="card"><h1>Niet beschikbaar</h1><p>${this._error}</p></div>`;
    }
    if (!this._details) return html``;

    if (this._success) {
      return html`
        <div class="card">
          <h1>Gelukt!</h1>
          <p>Je bent toegevoegd aan <strong>${this._details.group_name}</strong>. Je wordt doorgestuurd...</p>
        </div>
      `;
    }

    const emailMatches = this._currentEmail?.toLowerCase() === this._details.email.toLowerCase();

    if (this._currentEmail && emailMatches) {
      return html`
        <div class="card">
          <h1>Je bent uitgenodigd</h1>
          <p><strong>${this._details.inviter_name}</strong> heeft je uitgenodigd voor <strong>${this._details.group_name}</strong>.</p>
          ${this._error ? html`<div class="error">${this._error}</div>` : ''}
          <button class="btn" @click=${this._acceptAsExistingUser} ?disabled=${this._submitting}>
            ${this._submitting ? 'Bezig...' : 'Uitnodiging accepteren'}
          </button>
        </div>
      `;
    }

    if (this._currentEmail && !emailMatches) {
      return html`
        <div class="card">
          <h1>Verkeerd account</h1>
          <p>Deze uitnodiging is voor <strong>${this._details.email}</strong>, maar je bent ingelogd als <strong>${this._currentEmail}</strong>.</p>
          <p class="muted">Log uit en open deze link opnieuw om te accepteren.</p>
        </div>
      `;
    }

    if (this._details.existing_user) {
      return html`
        <div class="card">
          <h1>Je hebt al een account</h1>
          <p>Deze uitnodiging is voor <strong>${this._details.email}</strong>. Log in om te accepteren.</p>
          <a class="btn" style="text-align:center;text-decoration:none;display:block"
             href="/?next=/invite/${this.token}">Naar inloggen</a>
        </div>
      `;
    }

    return html`
      <div class="card">
        <h1>Account aanmaken</h1>
        <p><strong>${this._details.inviter_name}</strong> nodigt je uit voor <strong>${this._details.group_name}</strong>. Kies een naam en wachtwoord om je account aan te maken.</p>
        <form class="form" @submit=${this._acceptWithSignup}>
          <label>
            E-mailadres
            <input type="email" .value=${this._details.email} disabled />
          </label>
          <label>
            Je naam
            <input type="text" required autocomplete="name"
              .value=${this._name}
              @input=${(e: Event) => this._name = (e.target as HTMLInputElement).value}
              ?disabled=${this._submitting} />
          </label>
          <label>
            Wachtwoord
            <input type="password" required minlength="6" autocomplete="new-password"
              .value=${this._password}
              @input=${(e: Event) => this._password = (e.target as HTMLInputElement).value}
              ?disabled=${this._submitting} />
          </label>
          ${this._error ? html`<div class="error">${this._error}</div>` : ''}
          <button class="btn" type="submit"
            ?disabled=${this._submitting || !this._name.trim() || this._password.length < 6}>
            ${this._submitting ? 'Bezig...' : 'Account aanmaken en toetreden'}
          </button>
        </form>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-invite': PageInvite; }
}
