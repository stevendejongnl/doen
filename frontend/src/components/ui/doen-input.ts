import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles';
import { formControlStyles } from '../../styles/form-styles';

let nextId = 0;

@customElement('doen-input')
export class DoenInput extends LitElement {
  @property({ type: String }) type = 'text';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) label = '';
  @property({ type: String }) name = '';
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) readonly = false;
  @property({ type: String }) autocomplete = '';
  @property({ type: String }) inputmode = '';
  @property({ type: String }) min = '';
  @property({ type: String }) max = '';
  @property({ type: String }) pattern = '';
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
    this._controlId = `doen-input-${nextId}`;
    this._errorId = `doen-input-err-${nextId}`;
    this._helpId = `doen-input-help-${nextId}`;
  }

  static styles = [...sharedStyles, formControlStyles];

  get inputId(): string {
    return this._controlId;
  }

  override focus() {
    this.renderRoot.querySelector<HTMLInputElement>('input')?.focus();
  }

  override blur() {
    this.renderRoot.querySelector<HTMLInputElement>('input')?.blur();
  }

  select() {
    this.renderRoot.querySelector<HTMLInputElement>('input')?.select();
  }

  private _describedBy(): string | typeof nothing {
    const parts: string[] = [];
    if (this.helpText) parts.push(this._helpId);
    if (this.errorText || this._invalid) parts.push(this._errorId);
    return parts.length > 0 ? parts.join(' ') : nothing;
  }

  private _onInput(inputEvent: InputEvent) {
    const target = inputEvent.target as HTMLInputElement;
    this.value = target.value;
    this._invalid = false;
    this.dispatchEvent(new CustomEvent<{ value: string }>('doen-input', {
      detail: { value: this.value },
      bubbles: true,
      composed: true,
    }));
  }

  private _onChange(changeEvent: Event) {
    const target = changeEvent.target as HTMLInputElement;
    this.value = target.value;
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
      <input
        id=${this._controlId}
        class="control ${this.size === 'sm' ? 'size-sm' : ''}"
        type=${this.type}
        .value=${this.value}
        placeholder=${this.placeholder || nothing}
        name=${this.name || nothing}
        ?required=${this.required}
        ?disabled=${this.disabled}
        ?readonly=${this.readonly}
        autocomplete=${this.autocomplete || nothing}
        inputmode=${this.inputmode || nothing}
        min=${this.min || nothing}
        max=${this.max || nothing}
        pattern=${this.pattern || nothing}
        aria-label=${!this.label && accessibleLabel ? accessibleLabel : nothing}
        aria-required=${this.required ? 'true' : nothing}
        aria-invalid=${isInvalid ? 'true' : nothing}
        aria-describedby=${this._describedBy()}
        @input=${this._onInput}
        @change=${this._onChange}
        @invalid=${this._onNativeInvalid}
      />
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
  interface HTMLElementTagNameMap { 'doen-input': DoenInput; }
}
