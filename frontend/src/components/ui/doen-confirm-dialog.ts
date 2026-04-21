import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles';

@customElement('doen-confirm-dialog')
export class DoenConfirmDialog extends LitElement {
  @property({ type: String }) message = '';
  @property({ type: String }) confirmLabel = 'Bevestigen';
  @property({ type: String }) cancelLabel = 'Annuleren';
  @property({ type: String }) confirmVariant: 'danger' | 'primary' = 'primary';

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
      padding: 24px 20px 20px;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text);
    }

    .footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 0 20px 20px;
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

    .btn-confirm {
      border: none;
      border-radius: var(--radius-sm);
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .btn-confirm.primary {
      background: var(--color-accent);
      color: white;
    }
    .btn-confirm.primary:hover { background: var(--color-accent-hover); }

    .btn-confirm.danger {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--color-danger);
    }
    .btn-confirm.danger:hover { background: rgba(239, 68, 68, 0.28); }
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

  private _confirm() {
    this.dispatchEvent(new CustomEvent('doen-confirm', { bubbles: true, composed: true }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('doen-cancel', { bubbles: true, composed: true }));
  }

  private _onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) this._cancel();
  }

  render() {
    return html`
      <div class="backdrop" @click=${this._onBackdropClick}>
        <div class="panel">
          <div class="body">${this.message}</div>
          <div class="footer">
            <button class="btn-cancel" @click=${this._cancel}>${this.cancelLabel}</button>
            <button class="btn-confirm ${this.confirmVariant}" @click=${this._confirm}>
              ${this.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-confirm-dialog': DoenConfirmDialog; }
}
