import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sharedStyles } from '../styles/shared-styles';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let _seq = 0;

@customElement('doen-toast')
export class DoenToast extends LitElement {
  @state() private toasts: Toast[] = [];

  static styles = [sharedStyles, css`
    :host {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 10px;
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.15);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      font-size: 13px;
      font-weight: 500;
      pointer-events: auto;
      animation: slide-in 220ms ease-out;
      min-width: 240px;
      max-width: 360px;
    }

    .toast.success {
      background: rgba(16, 185, 129, 0.2);
      border-color: rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
    }

    .toast.error {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }

    .toast.info {
      background: rgba(99, 102, 241, 0.2);
      border-color: rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
    }

    .icon { font-size: 16px; flex-shrink: 0; }

    @keyframes slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `];

  show(message: string, type: ToastType = 'info') {
    const toast: Toast = { id: ++_seq, message, type };
    this.toasts = [...this.toasts, toast];
    setTimeout(() => this._remove(toast.id), 3000);
  }

  private _remove(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  render() {
    const icons = { success: 'circle-check', error: 'circle-xmark', info: 'circle-info' };
    return html`${this.toasts.map(t => html`
      <div class="toast ${t.type}" @click=${() => this._remove(t.id)}>
        <i class="fa-solid fa-${icons[t.type]} icon"></i>
        <span>${t.message}</span>
      </div>
    `)}`;
  }
}

export const toast = {
  _el: null as DoenToast | null,
  _get() {
    if (!this._el) {
      this._el = document.querySelector('doen-toast') as DoenToast;
    }
    return this._el;
  },
  success: (msg: string) => toast._get()?.show(msg, 'success'),
  error: (msg: string) => toast._get()?.show(msg, 'error'),
  info: (msg: string) => toast._get()?.show(msg, 'info'),
};

declare global {
  interface HTMLElementTagNameMap {
    'doen-toast': DoenToast;
  }
}
