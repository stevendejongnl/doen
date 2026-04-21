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

  input, textarea, select {
    font: inherit;
    font-size: 16px;
    color: var(--color-text);
    background: rgba(255,255,255,0.07);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
`];
