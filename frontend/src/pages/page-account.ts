import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api, ApiError, logout } from '../services/api';
import { getMe } from '../services/auth';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import { inputValue } from '../utils/form';
import { formatApiKeyExpiry, toEndOfDayIso } from '../utils/dates';
import { PullToRefreshController } from '../utils/pull-to-refresh';

interface ApiKey {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

interface ApiKeyCreateResponse {
  key: ApiKey;
  token: string;
}

interface Me {
  id: string;
  email: string;
  name: string;
}

@customElement('page-account')
export class PageAccount extends LitElement {
  @state() private _me: Me | null = null;

  private _ptr = new PullToRefreshController(this, () => Promise.all([this._loadMe(), this._loadKeys()]));

  @state() private _currentPw = '';
  @state() private _newPw = '';
  @state() private _newPw2 = '';
  @state() private _changingPw = false;

  @state() private _keys: ApiKey[] = [];
  @state() private _keysLoading = true;
  @state() private _newKeyName = '';
  @state() private _newKeyExpiry = '';
  @state() private _creatingKey = false;

  @state() private _justCreated: ApiKeyCreateResponse | null = null;
  @state() private _deletingAccount = false;

  static styles = [...sharedStyles, css`
    :host { display: block; overflow-y: auto; height: 100%; position: relative; overscroll-behavior-y: contain; }

    h1 {
      font-size: 24px; font-weight: 800; color: var(--color-text);
      margin-bottom: 4px; letter-spacing: -0.5px;
    }
    .subtitle { font-size: 13px; color: var(--color-text-muted); margin-bottom: 28px; }

    .card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: var(--radius-card);
      padding: 22px;
      margin-bottom: 16px;
      backdrop-filter: blur(16px);
    }

    h2 { font-size: 14px; font-weight: 700; color: var(--color-text); margin: 0 0 4px 0; letter-spacing: -0.2px; }
    .help { font-size: 12px; color: var(--color-text-muted); margin: 0 0 14px 0; }

    label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--color-text-muted-strong); margin-bottom: 10px; }

    input {
      font: inherit; color: var(--color-text);
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: var(--radius-sm); padding: 9px 14px;
      outline: none; width: 100%;
      transition: border-color var(--transition-fast), background var(--transition-fast);
    }
    input:focus { border-color: var(--color-accent); background: rgba(255,255,255,0.1); }
    input[disabled] { opacity: 0.6; }

    .btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 9px 16px; border-radius: var(--radius-sm);
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background 120ms, opacity 120ms;
      white-space: nowrap; border: none;
    }
    .btn-primary { background: var(--color-accent); color: white; }
    .btn-primary:hover { background: var(--color-accent-hover); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-danger {
      background: rgba(239,68,68,0.12); color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.24);
    }
    .btn-danger:hover { background: rgba(239,68,68,0.22); color: #fecaca; }

    .readonly {
      font-size: 13px; color: rgba(232,234,240,0.8);
      background: rgba(255,255,255,0.03);
      padding: 9px 14px; border-radius: 9px;
      border: 1px solid rgba(255,255,255,0.06);
    }

    .keys-list { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }

    .key-row {
      display: flex; align-items: center; gap: 12px; padding: 12px 14px;
      border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-btn);
      background: rgba(255,255,255,0.03);
    }
    .key-name { font-weight: 600; font-size: 13px; color: var(--color-text); }
    .key-meta { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
    .key-main { flex: 1; min-width: 0; }
    code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; color: #a5b4fc; }

    .form-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .form-row label { flex: 1; min-width: 140px; margin-bottom: 0; }

    .token-callout {
      background: rgba(99,102,241,0.12);
      border: 1px solid rgba(99,102,241,0.3);
      border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;
    }
    .token-callout h3 { margin: 0 0 4px 0; font-size: 13px; color: #c7d2fe; }
    .token-callout p { margin: 0 0 10px 0; font-size: 12px; color: rgba(232,234,240,0.7); }
    .token-row { display: flex; gap: 8px; }
    .token-row code {
      flex: 1; padding: 9px 12px; border-radius: 9px;
      background: rgba(0,0,0,0.25); border: 1px solid rgba(99,102,241,0.25);
      word-break: break-all; font-size: 12px; color: #e0e7ff;
    }

    .empty { font-size: 12px; color: var(--color-text-muted); padding: 8px 0; }
    .error { color: #fca5a5; font-size: 12px; margin-top: 6px; }
  `];

  async connectedCallback() {
    super.connectedCallback();
    await Promise.all([this._loadMe(), this._loadKeys()]);
  }

  private async _loadMe() {
    try { this._me = await getMe(); } catch { /* ignore */ }
  }

  private async _loadKeys() {
    this._keysLoading = true;
    try {
      this._keys = await api.get<ApiKey[]>('/auth/api-keys');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Sleutels laden mislukt: ${e.message}`);
    } finally {
      this._keysLoading = false;
    }
  }

  private async _changePassword(e: Event) {
    e.preventDefault();
    if (this._changingPw) return;
    if (this._newPw.length < 6) {
      toast.error('Nieuw wachtwoord moet minstens 6 tekens zijn.');
      return;
    }
    if (this._newPw !== this._newPw2) {
      toast.error('Wachtwoorden komen niet overeen.');
      return;
    }
    this._changingPw = true;
    try {
      await api.post('/auth/change-password', {
        current_password: this._currentPw,
        new_password: this._newPw,
      });
      this._currentPw = '';
      this._newPw = '';
      this._newPw2 = '';
      toast.success('Wachtwoord gewijzigd.');
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(e.status === 401
          ? 'Huidig wachtwoord klopt niet.'
          : `Wijzigen mislukt: ${e.message}`);
      }
    } finally {
      this._changingPw = false;
    }
  }

  private async _createKey(e: Event) {
    e.preventDefault();
    const name = this._newKeyName.trim();
    if (!name || this._creatingKey) return;
    this._creatingKey = true;
    try {
      const body: Record<string, unknown> = { name };
      if (this._newKeyExpiry) {
        body.expires_at = toEndOfDayIso(this._newKeyExpiry);
      }
      const resp = await api.post<ApiKeyCreateResponse>('/auth/api-keys', body);
      this._justCreated = resp;
      this._keys = [resp.key, ...this._keys];
      this._newKeyName = '';
      this._newKeyExpiry = '';
      toast.success('Sleutel aangemaakt — kopieer \'m nu!');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Aanmaken mislukt: ${e.message}`);
    } finally {
      this._creatingKey = false;
    }
  }

  private async _revokeKey(id: string) {
    if (!confirm('Sleutel intrekken? Integraties die deze sleutel gebruiken gaan stuk.')) return;
    try {
      await api.delete(`/auth/api-keys/${id}`);
      this._keys = this._keys.filter(k => k.id !== id);
      toast.success('Sleutel ingetrokken.');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Intrekken mislukt: ${e.message}`);
    }
  }

  private _copyToken() {
    if (!this._justCreated) return;
    navigator.clipboard.writeText(this._justCreated.token).then(
      () => toast.success('Gekopieerd.'),
      () => toast.error('Kopiëren mislukt — selecteer handmatig.'),
    );
  }

  private _onCurrentPwInput = (e: Event) => { this._currentPw = inputValue(e); };
  private _onNewPwInput = (e: Event) => { this._newPw = inputValue(e); };
  private _onNewPw2Input = (e: Event) => { this._newPw2 = inputValue(e); };
  private _onNewKeyNameInput = (e: Event) => { this._newKeyName = inputValue(e); };
  private _onNewKeyExpiryInput = (e: Event) => { this._newKeyExpiry = inputValue(e); };
  private _onDismissCreated = () => { this._justCreated = null; };

  private _onRevokeKeyClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.keyId!;
    this._revokeKey(id);
  };

  private async _deleteAccount() {
    if (!confirm('Je account permanent verwijderen? Als je nog projecten of groepen bezit, wordt je account uitgeschakeld in plaats van verwijderd.')) return;
    if (!confirm('Weet je het zeker? Dit is onomkeerbaar.')) return;
    this._deletingAccount = true;
    try {
      await api.delete('/auth/me');
      logout();
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Mislukt: ${e.message}`);
      this._deletingAccount = false;
    }
  }

  private _fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return formatApiKeyExpiry(iso);
  }

  render() {
    return this._ptr.wrap(html`
      <h1>Account</h1>
      <p class="subtitle">Beheer je profiel, wachtwoord en API-sleutels voor integraties.</p>

      <div class="card">
        <h2>Profiel</h2>
        <p class="help">Aangemeld als:</p>
        <label>Naam <div class="readonly">${this._me?.name ?? '...'}</div></label>
        <label>E-mailadres <div class="readonly">${this._me?.email ?? '...'}</div></label>
      </div>

      <div class="card">
        <h2>Wachtwoord wijzigen</h2>
        <p class="help">Je wordt niet automatisch uitgelogd na wijzigen.</p>
        <form @submit=${this._changePassword}>
          <label>Huidig wachtwoord
            <input type="password" autocomplete="current-password" required
              .value=${this._currentPw}
              @input=${this._onCurrentPwInput}
              ?disabled=${this._changingPw} />
          </label>
          <label>Nieuw wachtwoord
            <input type="password" autocomplete="new-password" required minlength="6"
              .value=${this._newPw}
              @input=${this._onNewPwInput}
              ?disabled=${this._changingPw} />
          </label>
          <label>Nieuw wachtwoord (nogmaals)
            <input type="password" autocomplete="new-password" required minlength="6"
              .value=${this._newPw2}
              @input=${this._onNewPw2Input}
              ?disabled=${this._changingPw} />
          </label>
          <button class="btn btn-primary" type="submit"
            ?disabled=${this._changingPw || !this._currentPw || !this._newPw || !this._newPw2}>
            <i class="fa-solid fa-${this._changingPw ? 'spinner fa-spin' : 'key'}"></i>
            Wachtwoord wijzigen
          </button>
        </form>
      </div>

      <div class="card">
        <h2>API-sleutels</h2>
        <p class="help">Lang-levende tokens voor integraties zoals de Home Assistant custom component. Een sleutel geeft volledige toegang tot je account — behandel ze als wachtwoorden.</p>

        ${this._justCreated ? html`
          <div class="token-callout">
            <h3>Sleutel "${this._justCreated.key.name}" aangemaakt</h3>
            <p>Dit is het enige moment waarop je de volledige sleutel ziet. Kopieer \'m nu en sla \'m veilig op (bv. 1Password).</p>
            <div class="token-row">
              <code>${this._justCreated.token}</code>
              <button class="btn btn-primary" @click=${this._copyToken}>
                <i class="fa-solid fa-copy"></i> Kopieer
              </button>
              <button class="btn btn-danger" @click=${this._onDismissCreated}>
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        ` : ''}

        <form @submit=${this._createKey}>
          <div class="form-row">
            <label>Naam
              <input type="text" placeholder="bv. ha-integration" required
                .value=${this._newKeyName}
                @input=${this._onNewKeyNameInput}
                ?disabled=${this._creatingKey} />
            </label>
            <label>Verloopt op (optioneel)
              <input type="date"
                .value=${this._newKeyExpiry}
                @input=${this._onNewKeyExpiryInput}
                ?disabled=${this._creatingKey} />
            </label>
            <button class="btn btn-primary" type="submit"
              ?disabled=${this._creatingKey || !this._newKeyName.trim()}>
              <i class="fa-solid fa-${this._creatingKey ? 'spinner fa-spin' : 'plus'}"></i>
              Aanmaken
            </button>
          </div>
        </form>

        <div class="keys-list">
          ${this._keysLoading ? html`<div class="empty">Laden…</div>` : ''}
          ${!this._keysLoading && this._keys.length === 0 ? html`
            <div class="empty">Nog geen sleutels. Maak er één aan hierboven om integraties te koppelen.</div>
          ` : ''}
          ${this._keys.map(k => html`
            <div class="key-row">
              <div class="key-main">
                <div class="key-name">${k.name} <code>doen_${k.token_prefix}…</code></div>
                <div class="key-meta">
                  aangemaakt ${this._fmtDate(k.created_at)}
                  · laatst gebruikt ${this._fmtDate(k.last_used_at)}
                  ${k.expires_at ? html`· verloopt ${this._fmtDate(k.expires_at)}` : ''}
                </div>
              </div>
              <button class="btn btn-danger" data-key-id=${k.id} @click=${this._onRevokeKeyClick}>
                <i class="fa-solid fa-trash"></i> Intrekken
              </button>
            </div>
          `)}
        </div>
      </div>

      <div class="card" style="border-color: rgba(239,68,68,0.2);">
        <h2 style="color:#fca5a5;">Account verwijderen</h2>
        <p class="help">
          Verwijdert je account permanent. Als je nog projecten, groepen of categorieën bezit,
          wordt je account uitgeschakeld in plaats van verwijderd — een beheerder kan daarna
          de data overdragen en het account definitief verwijderen.
        </p>
        <button class="btn btn-danger" ?disabled=${this._deletingAccount}
          @click=${this._deleteAccount}>
          <i class="fa-solid fa-${this._deletingAccount ? 'spinner fa-spin' : 'user-xmark'}"></i>
          Account verwijderen
        </button>
      </div>
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-account': PageAccount; }
}
