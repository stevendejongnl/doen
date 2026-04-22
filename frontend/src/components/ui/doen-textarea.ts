import { LitElement, html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles';
import { formControlStyles } from '../../styles/form-styles';

let nextId = 0;

@customElement('doen-textarea')
export class DoenTextarea extends LitElement {
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) label = '';
  @property({ type: String }) name = '';
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Number }) rows = 4;
  @property({ type: String }) errorText = '';
  @property({ type: String }) helpText = '';
  @property({ type: String, attribute: 'aria-label' }) ariaLabelAttr = '';

  @state() private _invalid = false;

  private readonly _controlId: string;
  private readonly _errorId: string;
  private readonly _helpId: string;

  constructor() {
    super();
    nextId += 1;
    this._controlId = `doen-textarea-${nextId}`;
    this._errorId = `doen-textarea-err-${nextId}`;
    this._helpId = `doen-textarea-help-${nextId}`;
  }

  static styles = [...sharedStyles, formControlStyles, css`
    .control {
      min-height: 72px;
      resize: vertical;
      font-size: 13px;
      line-height: 1.5;
    }
  `];

  get textareaId(): string {
    return this._controlId;
  }

  override focus() {
    this.renderRoot.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }

  override blur() {
    this.renderRoot.querySelector<HTMLTextAreaElement>('textarea')?.blur();
  }

  private _describedBy(): string | typeof nothing {
    const parts: string[] = [];
    if (this.helpText) parts.push(this._helpId);
    if (this.errorText || this._invalid) parts.push(this._errorId);
    return parts.length > 0 ? parts.join(' ') : nothing;
  }

  private _onInput(inputEvent: InputEvent) {
    const target = inputEvent.target as HTMLTextAreaElement;
    this.value = target.value;
    this._invalid = false;
    this.dispatchEvent(new CustomEvent<{ value: string }>('doen-input', {
      detail: { value: this.value },
      bubbles: true,
      composed: true,
    }));
  }

  private _onChange(changeEvent: Event) {
    const target = changeEvent.target as HTMLTextAreaElement;
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
      <textarea
        id=${this._controlId}
        class="control"
        .value=${this.value}
        placeholder=${this.placeholder || nothing}
        name=${this.name || nothing}
        rows=${this.rows}
        ?required=${this.required}
        ?disabled=${this.disabled}
        aria-label=${!this.label && accessibleLabel ? accessibleLabel : nothing}
        aria-required=${this.required ? 'true' : nothing}
        aria-invalid=${isInvalid ? 'true' : nothing}
        aria-describedby=${this._describedBy()}
        @input=${this._onInput}
        @change=${this._onChange}
        @invalid=${this._onNativeInvalid}
      ></textarea>
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
  interface HTMLElementTagNameMap { 'doen-textarea': DoenTextarea; }
}
