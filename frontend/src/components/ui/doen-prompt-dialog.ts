import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles';

@customElement('doen-prompt-dialog')
export class DoenPromptDialog extends LitElement {
  @property({ type: String }) message = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) submitLabel = 'OK';
  @property({ type: String }) cancelLabel = 'Annuleren';

  @state() private _value = '';

  @query('input') private _input!: HTMLInputElement;

  static styles = [...sharedStyles, css`
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 12, 20, 0.55);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 20px;
      animation: backdrop-in 160ms ease-out;
    }

    @keyframes backdrop-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .panel {
      width: 100%;
      max-width: 400px;
      background: rgba(30, 36, 54, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: panel-in 200ms cubic-bezier(0.2, 0.8, 0.3, 1);
      cursor: default;
    }

    @keyframes panel-in {
      from { opacity: 0; transform: translateY(8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .body {
      padding: 24px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text);
    }

    input {
      width: 100%;
      font: inherit;
      font-size: 14px;
      color: var(--color-text);
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      padding: 9px 12px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      transition: border-color var(--transition-fast), background var(--transition-fast);
      box-sizing: border-box;
    }
    input:focus {
      border-color: var(--color-accent);
      background: rgba(255, 255, 255, 0.12);
    }
    input::placeholder { color: var(--color-text-muted); }

    .footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 4px 20px 20px;
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--color-text-muted-strong);
      border-radius: var(--radius-sm);
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background var(--transition-fast);
    }
    .btn-cancel:hover { background: rgba(255, 255, 255, 0.12); }

    .btn-submit {
      background: var(--color-accent);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background var(--transition-fast);
    }
    .btn-submit:hover:not(:disabled) { background: var(--color-accent-hover); }
    .btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
  `];

  private _onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._cancel();
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeydown);
  }

  firstUpdated() {
    // Auto-focus the input after render
    requestAnimationFrame(() => this._input?.focus());
  }

  private _submit() {
    const trimmed = this._value.trim();
    if (!trimmed) return;
    this.dispatchEvent(new CustomEvent<string>('doen-submit', {
      detail: trimmed,
      bubbles: true,
      composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: true, composed: true }));
  }

  private _onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) this._cancel();
  }

  private _onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this._submit();
    }
  }

  render() {
    return html`
      <div class="backdrop" @click=${this._onBackdropClick}>
        <div class="panel">
          <div class="body">
            <div class="message">${this.message}</div>
            <input
              type="text"
              .value=${this._value}
              placeholder=${this.placeholder}
              @input=${(e: Event) => this._value = (e.target as HTMLInputElement).value}
              @keydown=${this._onInputKeydown}
            />
          </div>
          <div class="footer">
            <button class="btn-cancel" @click=${this._cancel}>${this.cancelLabel}</button>
            <button class="btn-submit" ?disabled=${!this._value.trim()} @click=${this._submit}>
              ${this.submitLabel}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-prompt-dialog': DoenPromptDialog; }
}
