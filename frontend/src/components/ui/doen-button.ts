import { LitElement, html, nothing, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'warning' | 'success' | 'neutral' | 'icon';
export type ButtonSize = 'sm' | 'md';

@customElement('doen-button')
export class DoenButton extends LitElement {
  @property({ type: String }) variant: ButtonVariant = 'primary';
  @property({ type: String }) size: ButtonSize = 'md';
  @property({ type: String }) type: 'button' | 'submit' | 'reset' = 'button';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: String, attribute: 'aria-label' }) ariaLabelAttr = '';
  @property({ type: Boolean }) pressed: boolean | undefined = undefined;

  static styles = [...sharedStyles, css`
    :host {
      display: inline-block;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: none;
      border-radius: var(--radius-btn);
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition:
        background var(--transition-fast),
        opacity var(--transition-fast),
        transform var(--transition-fast);
      white-space: nowrap;
      padding: 8px 16px;
    }

    button.size-sm {
      padding: 5px 10px;
      font-size: 12px;
      border-radius: var(--radius-sm);
    }

    button:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    button:not(:disabled):active {
      transform: scale(0.97);
    }

    button.variant-primary {
      background: var(--color-accent);
      color: white;
    }
    button.variant-primary:not(:disabled):hover { background: var(--color-accent-hover); }

    button.variant-ghost {
      background: transparent;
      color: var(--color-text-muted);
      border: 1px solid var(--glass-border);
    }
    button.variant-ghost:not(:disabled):hover { color: var(--color-text); background: var(--glass-bg); }

    button.variant-danger {
      background: rgba(239, 68, 68, 0.9);
      color: white;
    }
    button.variant-danger:not(:disabled):hover { background: rgba(220, 38, 38, 0.95); }

    button.variant-warning {
      background: rgba(245, 158, 11, 0.9);
      color: white;
    }
    button.variant-warning:not(:disabled):hover { background: rgba(217, 119, 6, 0.95); }

    button.variant-success {
      background: rgba(16, 185, 129, 0.9);
      color: white;
    }
    button.variant-success:not(:disabled):hover { background: rgba(5, 150, 105, 0.95); }

    button.variant-neutral {
      background: rgba(255, 255, 255, 0.07);
      color: var(--color-text);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    button.variant-neutral:not(:disabled):hover { background: rgba(255, 255, 255, 0.12); }

    button.variant-icon {
      background: transparent;
      color: var(--color-text-muted);
      border: 1px solid transparent;
      padding: 6px 8px;
    }
    button.variant-icon:not(:disabled):hover {
      color: var(--color-text);
      background: var(--glass-bg);
      border-color: var(--glass-border);
    }
  `];

  override focus() {
    this.renderRoot.querySelector<HTMLButtonElement>('button')?.focus();
  }

  private _onClick(clickEvent: MouseEvent) {
    if (this.disabled || this.loading) {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
    }
  }

  render() {
    const classes = `variant-${this.variant} size-${this.size}`;
    const isDisabled = this.disabled || this.loading;

    return html`
      <button
        class=${classes}
        type=${this.type}
        ?disabled=${isDisabled}
        aria-label=${this.ariaLabelAttr || nothing}
        aria-pressed=${this.pressed !== undefined ? String(this.pressed) : nothing}
        aria-busy=${this.loading ? 'true' : nothing}
        @click=${this._onClick}
      >
        ${this.loading ? html`<i class="fa-solid fa-spinner fa-spin"></i>` : nothing}
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-button': DoenButton; }
}
