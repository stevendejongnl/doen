import { css, unsafeCSS } from 'lit';
import faRaw from '@fortawesome/fontawesome-free/css/all.min.css?inline';

// Strip @font-face blocks — fonts are loaded in the light DOM via main.ts.
// Only the selector rules (.fa-solid, .fa-brands etc.) need to be in each
// shadow root so that FA class names resolve correctly inside shadow DOM.
const faSelectors = unsafeCSS(faRaw.replace(/@font-face\s*\{[^}]*\}/g, ''));

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
    color: var(--color-text);
    background: rgba(255,255,255,0.07);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  :host {
    --glass-bg: rgba(255, 255, 255, 0.07);
    --glass-bg-raised: rgba(255, 255, 255, 0.11);
    --glass-border: rgba(255, 255, 255, 0.14);
    --glass-blur: blur(16px);
    --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
    --radius-card: 18px;
    --radius-btn: 10px;
    --radius-sm: 8px;
    --transition-smooth: 220ms ease-out;
    --transition-fast: 120ms ease-out;
    --shimmer: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%);
    --color-text: #e8eaf0;
    --color-text-muted: rgba(232, 234, 240, 0.45);
    --color-accent: #6366f1;
    --color-accent-hover: #818cf8;
    --color-success: #10b981;
    --color-danger: #ef4444;
    --color-warning: #f59e0b;
    --color-priority-none: rgba(255,255,255,0.22);
    --color-priority-low: #10b981;
    --color-priority-medium: #f59e0b;
    --color-priority-high: #ef4444;
    --sidebar-width: 260px;
    --topbar-height: 56px;
  }
`];
