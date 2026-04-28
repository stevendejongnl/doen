import { html, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';

const THRESHOLD = 70;
const MAX_PULL = 120;
const DAMPENING = 0.5;
const INDICATOR_OFFSET = 50;

export type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

type Host = ReactiveControllerHost & HTMLElement;

export class PullToRefreshController implements ReactiveController {
  state: PullState = 'idle';
  pullDistance = 0;

  private startY = 0;
  private isTracking = false;

  constructor(private host: Host, private onRefresh: () => Promise<unknown> | unknown) {
    host.addController(this);
  }

  hostConnected() {
    this.host.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this.host.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.host.addEventListener('touchend', this._onTouchEnd);
    this.host.addEventListener('touchcancel', this._onTouchEnd);
  }

  hostDisconnected() {
    this.host.removeEventListener('touchstart', this._onTouchStart);
    this.host.removeEventListener('touchmove', this._onTouchMove);
    this.host.removeEventListener('touchend', this._onTouchEnd);
    this.host.removeEventListener('touchcancel', this._onTouchEnd);
  }

  private _onTouchStart = (e: TouchEvent) => {
    if (this.state === 'refreshing') return;
    if (this.host.scrollTop > 0) return;
    if (e.touches.length !== 1) return;
    this.startY = e.touches[0].clientY;
    this.isTracking = true;
  };

  private _onTouchMove = (e: TouchEvent) => {
    if (!this.isTracking) return;
    if (this.host.scrollTop > 0) {
      this.isTracking = false;
      return;
    }
    const delta = e.touches[0].clientY - this.startY;
    if (delta <= 0) return;
    e.preventDefault();
    this.pullDistance = Math.min(MAX_PULL, delta * DAMPENING);
    this.state = this.pullDistance >= THRESHOLD ? 'ready' : 'pulling';
    this.host.requestUpdate();
  };

  private _onTouchEnd = async () => {
    if (!this.isTracking) return;
    this.isTracking = false;
    if (this.state === 'ready') {
      this.state = 'refreshing';
      this.pullDistance = THRESHOLD;
      this.host.requestUpdate();
      try {
        await this.onRefresh();
      } catch { /* page handles its own errors */ } finally {
        this.state = 'idle';
        this.pullDistance = 0;
        this.host.requestUpdate();
      }
    } else {
      this.state = 'idle';
      this.pullDistance = 0;
      this.host.requestUpdate();
    }
  };

  wrap(content: TemplateResult): TemplateResult {
    const opacity = Math.min(1, this.pullDistance / THRESHOLD);
    const arrowRotation = this.state === 'ready' ? 180 : 0;
    const transition = this.isTracking ? 'none' : 'transform 0.25s ease-out';
    const indicatorTransform = `translateX(-50%) translateY(${this.pullDistance - INDICATOR_OFFSET}px)`;
    const contentTransform = `translateY(${this.pullDistance}px)`;
    return html`
      <div class="ptr-indicator"
        style="opacity: ${opacity}; transform: ${indicatorTransform}; transition: ${transition};"
        aria-hidden="true">
        ${this.state === 'refreshing'
          ? html`<div class="ptr-spinner"></div>`
          : html`<i class="ptr-arrow fa-solid fa-arrow-down" style="transform: rotate(${arrowRotation}deg);"></i>`}
      </div>
      <div class="ptr-content" style="transform: ${contentTransform}; transition: ${transition};">
        ${content}
      </div>
    `;
  }
}
