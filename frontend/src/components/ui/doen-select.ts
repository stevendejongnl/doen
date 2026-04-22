import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles';
import { formControlStyles } from '../../styles/form-styles';

let nextId = 0;

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@customElement('doen-select')
export class DoenSelect extends LitElement {
  @property({ type: String }) value = '';
  @property({ type: Array }) options: SelectOption[] = [];
  @property({ type: String }) label = '';
  @property({ type: String }) name = '';
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: String }) errorText = '';
  @property({ type: String }) helpText = '';
  @property({ type: String }) size: 'sm' | 'md' = 'md';
  @property({ type: String, attribute: 'aria-label' }) ariaLabelAttr = '';

  @state() private _invalid = false;

  private readonly _controlId: string;
  private readonly _errorId: string;
  private readonly _helpId: string;

  constructor() {
    super();
    nextId += 1;
    this._controlId = `doen-select-${nextId}`;
    this._errorId = `doen-select-err-${nextId}`;
    this._helpId = `doen-select-help-${nextId}`;
  }

  static styles = [...sharedStyles, formControlStyles];

  get selectId(): string {
    return this._controlId;
  }

  override focus() {
    this.renderRoot.querySelector<HTMLSelectElement>('select')?.focus();
  }

  private _describedBy(): string | typeof nothing {
    const parts: string[] = [];
    if (this.helpText) parts.push(this._helpId);
    if (this.errorText || this._invalid) parts.push(this._errorId);
    return parts.length > 0 ? parts.join(' ') : nothing;
  }

  private _onChange(changeEvent: Event) {
    const target = changeEvent.target as HTMLSelectElement;
    this.value = target.value;
    this._invalid = false;
    this.dispatchEvent(new CustomEvent<{ value: string }>('doen-change', {
      detail: { value: this.value },
      bubbles: true,
      composed: true,
    }));
  }

  private _onNativeInvalid() {
    this._invalid = true;
  }

  render() {
    const isInvalid = this._invalid || !!this.errorText;
    const accessibleLabel = this.ariaLabelAttr || this.label;

    return html`
      ${this.label ? html`
        <label class="label" for=${this._controlId}>${this.label}</label>
      ` : nothing}
      <select
        id=${this._controlId}
        class="control ${this.size === 'sm' ? 'size-sm' : ''}"
        .value=${this.value}
        name=${this.name || nothing}
        ?required=${this.required}
        ?disabled=${this.disabled}
        aria-label=${!this.label && accessibleLabel ? accessibleLabel : nothing}
        aria-required=${this.required ? 'true' : nothing}
        aria-invalid=${isInvalid ? 'true' : nothing}
        aria-describedby=${this._describedBy()}
        @change=${this._onChange}
        @invalid=${this._onNativeInvalid}
      >
        ${this.options.map((option) => html`
          <option value=${option.value} ?disabled=${option.disabled ?? false}>${option.label}</option>
        `)}
      </select>
      ${this.helpText ? html`
        <span id=${this._helpId} class="help-text">${this.helpText}</span>
      ` : nothing}
      ${isInvalid && this.errorText ? html`
        <span id=${this._errorId} role="alert" class="error-text">${this.errorText}</span>
      ` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-select': DoenSelect; }
}
