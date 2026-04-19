import { css, unsafeCSS } from 'lit';
import faStyles from '@fortawesome/fontawesome-free/css/all.min.css?inline';

export const sharedStyles = [unsafeCSS(faStyles), css`

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
