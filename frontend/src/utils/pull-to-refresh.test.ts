import { describe, it, expect, vi, beforeEach } from 'vitest';
import { html } from 'lit';
import { PullToRefreshController } from './pull-to-refresh';
import type { ReactiveControllerHost } from 'lit';

function makeHost(scrollTop = 0) {
  const host = {
    scrollTop,
    addController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as ReactiveControllerHost & HTMLElement;
  return host;
}

function makeTouch(clientY: number): Touch {
  return { clientY } as Touch;
}

function makeTouchEvent(touches: Touch[], preventDefault = vi.fn()): TouchEvent {
  return { touches, preventDefault } as unknown as TouchEvent;
}

describe('PullToRefreshController', () => {
  let host: ReactiveControllerHost & HTMLElement;
  let onRefresh: ReturnType<typeof vi.fn>;
  let ctrl: PullToRefreshController;

  beforeEach(() => {
    host = makeHost();
    onRefresh = vi.fn().mockResolvedValue(undefined);
    ctrl = new PullToRefreshController(host, onRefresh);
  });

  it('registers itself with the host', () => {
    expect((host as any).addController).toHaveBeenCalledWith(ctrl);
  });

  it('hostConnected attaches touch listeners', () => {
    ctrl.hostConnected();
    expect((host as any).addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
    expect((host as any).addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
    expect((host as any).addEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
    expect((host as any).addEventListener).toHaveBeenCalledWith('touchcancel', expect.any(Function));
  });

  it('hostDisconnected removes touch listeners', () => {
    ctrl.hostDisconnected();
    expect((host as any).removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect((host as any).removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
    expect((host as any).removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
    expect((host as any).removeEventListener).toHaveBeenCalledWith('touchcancel', expect.any(Function));
  });

  it('touchstart does not track when scrollTop > 0', () => {
    (host as any).scrollTop = 50;
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    expect((ctrl as any).isTracking).toBe(false);
  });

  it('touchstart does not track when already refreshing', () => {
    ctrl.state = 'refreshing';
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    expect((ctrl as any).isTracking).toBe(false);
  });

  it('touchstart does not track for multi-touch', () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100), makeTouch(120)]));
    expect((ctrl as any).isTracking).toBe(false);
  });

  it('touchstart begins tracking at scrollTop 0', () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    expect((ctrl as any).isTracking).toBe(true);
    expect((ctrl as any).startY).toBe(100);
  });

  it('touchmove ignores when not tracking', () => {
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(150)]));
    expect(ctrl.pullDistance).toBe(0);
  });

  it('touchmove stops tracking when scrollTop > 0 mid-pull', () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (host as any).scrollTop = 10;
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(160)]));
    expect((ctrl as any).isTracking).toBe(false);
    expect(ctrl.pullDistance).toBe(0);
  });

  it('touchmove ignores upward swipe (delta <= 0)', () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(80)]));
    expect(ctrl.pullDistance).toBe(0);
    expect(ctrl.state).toBe('idle');
  });

  it('touchmove sets pulling state below threshold', () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(160)])); // delta 60, * 0.5 = 30
    expect(ctrl.state).toBe('pulling');
    expect(ctrl.pullDistance).toBe(30);
    expect((host as any).requestUpdate).toHaveBeenCalled();
  });

  it('touchmove sets ready state at threshold (70px dampened)', () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(240)])); // delta 140, * 0.5 = 70
    expect(ctrl.state).toBe('ready');
  });

  it('touchmove caps pull distance at MAX_PULL', () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(400)])); // delta 300, * 0.5 = 150, capped at 120
    expect(ctrl.pullDistance).toBe(120);
  });

  it('touchmove calls preventDefault', () => {
    const preventDefault = vi.fn();
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(160)], preventDefault));
    expect(preventDefault).toHaveBeenCalled();
  });

  it('touchend does nothing when not tracking', async () => {
    await (ctrl as any)._onTouchEnd();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('touchend in pulling state resets to idle without calling onRefresh', async () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(150)])); // below threshold
    await (ctrl as any)._onTouchEnd();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(ctrl.state).toBe('idle');
    expect(ctrl.pullDistance).toBe(0);
  });

  it('touchend in ready state calls onRefresh then resets', async () => {
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(250)])); // above threshold
    expect(ctrl.state).toBe('ready');
    await (ctrl as any)._onTouchEnd();
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(ctrl.state).toBe('idle');
    expect(ctrl.pullDistance).toBe(0);
  });

  it('touchend sets refreshing state during onRefresh call', async () => {
    let capturedState = '';
    onRefresh.mockImplementation(() => {
      capturedState = ctrl.state;
      return Promise.resolve();
    });
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(250)]));
    await (ctrl as any)._onTouchEnd();
    expect(capturedState).toBe('refreshing');
  });

  it('touchend resets state even if onRefresh throws', async () => {
    onRefresh.mockRejectedValue(new Error('fail'));
    (ctrl as any)._onTouchStart(makeTouchEvent([makeTouch(100)]));
    (ctrl as any)._onTouchMove(makeTouchEvent([makeTouch(250)]));
    await (ctrl as any)._onTouchEnd();
    expect(ctrl.state).toBe('idle');
    expect(ctrl.pullDistance).toBe(0);
  });

  it('wrap returns a TemplateResult with indicator and content', () => {
    const result = ctrl.wrap(html`<span>content</span>`);
    expect(result).toBeDefined();
    expect(result.strings.join('')).toContain('ptr-indicator');
    expect(result.strings.join('')).toContain('ptr-content');
  });

  it('wrap shows spinner when refreshing', () => {
    ctrl.state = 'refreshing';
    ctrl.pullDistance = 70;
    const result = ctrl.wrap(html`<span></span>`);
    expect(result.strings.join('')).toContain('ptr-indicator');
  });

  it('wrap shows rotated arrow when ready', () => {
    ctrl.state = 'ready';
    ctrl.pullDistance = 70;
    const result = ctrl.wrap(html`<span></span>`);
    expect(result.strings.join('')).toContain('ptr-indicator');
  });

  it('wrap applies no transition when tracking', () => {
    (ctrl as any).isTracking = true;
    ctrl.pullDistance = 30;
    const result = ctrl.wrap(html`<span></span>`);
    const str = result.values.join('');
    expect(str).toContain('none');
  });
});
