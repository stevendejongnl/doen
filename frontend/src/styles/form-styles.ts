import { css } from 'lit';

export const formControlStyles = css`
  .control {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font: inherit;
    font-size: 16px;
    color: var(--color-text);
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    transition: border-color var(--transition-fast), background var(--transition-fast);
    box-sizing: border-box;
  }

  .control:focus-visible {
    border-color: var(--color-accent);
    background: rgba(255, 255, 255, 0.1);
  }

  .control[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  .control:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .control:-webkit-autofill,
  .control:-webkit-autofill:hover,
  .control:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #1a1f35 inset !important;
    -webkit-text-fill-color: var(--color-text) !important;
    border-color: var(--color-accent) !important;
  }

  .control[type='date']::-webkit-calendar-picker-indicator {
    filter: invert(0.6);
    cursor: pointer;
  }

  .control option {
    background: var(--color-surface-solid);
    color: var(--color-text);
  }

  .control.size-sm {
    padding: 5px 8px;
    font-size: 12px;
    border-radius: var(--radius-xs);
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
`;
