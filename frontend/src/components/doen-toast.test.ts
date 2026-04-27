import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount } from '../../test/helpers';
import './doen-toast';
import type { DoenToast } from './doen-toast';
import { toast } from './doen-toast';

describe('doen-toast', () => {
  let el: DoenToast;
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); unmount(el); });

  function toasts() {
    return Array.from(el.shadowRoot!.querySelectorAll('.toast'));
  }

  it('renders no toasts initially', async () => {
    el = await mount<DoenToast>('doen-toast');
    expect(toasts()).toHaveLength(0);
  });

  it('renders a success toast after show()', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('It worked', 'success');
    await el.updateComplete;
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].classList.contains('success')).toBe(true);
    expect(toasts()[0].textContent).toContain('It worked');
  });

  it('renders an error toast', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('Oh no', 'error');
    await el.updateComplete;
    expect(toasts()[0].classList.contains('error')).toBe(true);
  });

  it('renders an info toast', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('FYI', 'info');
    await el.updateComplete;
    expect(toasts()[0].classList.contains('info')).toBe(true);
  });

  it('defaults to info when type omitted', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('Default type');
    await el.updateComplete;
    expect(toasts()[0].classList.contains('info')).toBe(true);
  });

  it('auto-removes toast after 3 seconds', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('Gone soon', 'info');
    await el.updateComplete;
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    await el.updateComplete;
    expect(toasts()).toHaveLength(0);
  });

  it('removes toast on click', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('Click me', 'success');
    await el.updateComplete;
    (toasts()[0] as HTMLElement).click();
    await el.updateComplete;
    expect(toasts()).toHaveLength(0);
  });

  it('can show multiple toasts', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('First', 'success');
    el.show('Second', 'error');
    await el.updateComplete;
    expect(toasts()).toHaveLength(2);
  });

  it('clicking one toast removes only that one', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('First', 'info');
    el.show('Second', 'info');
    await el.updateComplete;
    (toasts()[0] as HTMLElement).click();
    await el.updateComplete;
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].textContent).toContain('Second');
  });

  it('toast helper functions call show() on the element', async () => {
    el = await mount<DoenToast>('doen-toast');
    document.body.appendChild(el);
    toast._el = el;
    toast.success('s');
    toast.error('e');
    toast.info('i');
    await el.updateComplete;
    expect(toasts().length).toBeGreaterThanOrEqual(3);
    document.body.removeChild(el);
  });

  it('shows correct icon for each type', async () => {
    el = await mount<DoenToast>('doen-toast');
    el.show('s', 'success');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.fa-circle-check')).toBeTruthy();
    (toasts()[0] as HTMLElement).click();
    await el.updateComplete;

    el.show('e', 'error');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.fa-circle-xmark')).toBeTruthy();
    (toasts()[0] as HTMLElement).click();
    await el.updateComplete;

    el.show('i', 'info');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.fa-circle-info')).toBeTruthy();
  });
});
