import { css, unsafeCSS } from 'lit';
import faRaw from '@fortawesome/fontawesome-free/css/all.min.css?inline';

// Strip @font-face blocks — fonts are loaded in the light DOM via main.ts.
// Only the selector rules (.fa-solid, .fa-brands etc.) need to be in each
// shadow root so that FA class names resolve correctly inside shadow DOM.
const faSelectors = unsafeCSS(faRaw.replace(/@font-face\s*\{[^}]*\}/g, ''));

// CSS custom properties are inherited and cascade into shadow roots, so
// tokens from :root in tokens.css are available here without re-declaration.
export const sharedStyles = [faSelectors, css`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  button {
    cursor: pointer;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    -webkit-appearance: none;
    appearance: none;
  }

  input:not([type="checkbox"]):not([type="radio"]), textarea, select {
    font: inherit;
    font-size: 16px;
    color: var(--color-text);
    background: rgba(255,255,255,0.07);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    transition: border-color var(--transition-fast), background var(--transition-fast);
    box-sizing: border-box;
  }

  input:not([type="checkbox"]):not([type="radio"]):focus-visible, textarea:focus-visible, select:focus-visible {
    border-color: var(--color-accent);
    background: rgba(255,255,255,0.1);
  }

  input:not([type="checkbox"]):not([type="radio"]):-webkit-autofill,
  input:not([type="checkbox"]):not([type="radio"]):-webkit-autofill:hover,
  input:not([type="checkbox"]):not([type="radio"]):-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #1a1f35 inset !important;
    -webkit-text-fill-color: var(--color-text) !important;
    border-color: var(--color-accent) !important;
  }

  input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(0.6);
    cursor: pointer;
  }

  select option {
    background: var(--color-surface-solid);
    color: var(--color-text);
  }
`];
