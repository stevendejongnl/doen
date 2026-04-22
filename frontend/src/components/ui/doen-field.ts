import { LitElement, html, nothing, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles';

let nextId = 0;

@customElement('doen-field')
export class DoenField extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) errorText = '';
  @property({ type: String }) helpText = '';
  @property({ type: String, attribute: 'for' }) forId = '';

  private readonly _autoLabelId: string;
  private readonly _errorId: string;
  private readonly _helpId: string;

  constructor() {
    super();
    nextId += 1;
    this._autoLabelId = `doen-field-label-${nextId}`;
    this._errorId = `doen-field-err-${nextId}`;
    this._helpId = `doen-field-help-${nextId}`;
  }

  static styles = [...sharedStyles, css`
    :host {
      display: block;
    }

    .label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-muted-strong);
      margin-bottom: 5px;
    }

    .help-text {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 4px;
    }

    .error-text {
      font-size: 11px;
      color: var(--color-danger);
      margin-top: 4px;
    }
  `];

  render() {
    const resolvedFor = this.forId || nothing;

    return html`
      ${this.label ? html`
        <label class="label" id=${this._autoLabelId} for=${resolvedFor}>${this.label}</label>
      ` : nothing}
      <slot></slot>
      ${this.helpText ? html`
        <span id=${this._helpId} class="help-text">${this.helpText}</span>
      ` : nothing}
      ${this.errorText ? html`
        <span id=${this._errorId} role="alert" class="error-text">${this.errorText}</span>
      ` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-field': DoenField; }
}
