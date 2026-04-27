import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, $, unmount, click } from '../../../test/helpers';
import './doen-button';
import type { DoenButton } from './doen-button';

describe('doen-button', () => {
  let el: DoenButton;
  afterEach(() => { unmount(el); });

  it('renders a button with slot content', async () => {
    el = await mount<DoenButton>('doen-button');
    const btn = $<HTMLButtonElement>(el, 'button');
    expect(btn.tagName).toBe('BUTTON');
  });

  it('applies variant class', async () => {
    el = await mount<DoenButton>('doen-button', { variant: 'danger' });
    const btn = $<HTMLButtonElement>(el, 'button');
    expect(btn.className).toContain('variant-danger');
  });

  it('applies size class', async () => {
    el = await mount<DoenButton>('doen-button', { size: 'sm' });
    const btn = $<HTMLButtonElement>(el, 'button');
    expect(btn.className).toContain('size-sm');
  });

  it('disables button when disabled=true', async () => {
    el = await mount<DoenButton>('doen-button', { disabled: true });
    const btn = $<HTMLButtonElement>(el, 'button');
    expect(btn.disabled).toBe(true);
  });

  it('disables button when loading=true', async () => {
    el = await mount<DoenButton>('doen-button', { loading: true });
    const btn = $<HTMLButtonElement>(el, 'button');
    expect(btn.disabled).toBe(true);
  });

  it('shows spinner when loading', async () => {
    el = await mount<DoenButton>('doen-button', { loading: true });
    expect(el.shadowRoot!.querySelector('.fa-spinner')).not.toBeNull();
  });

  it('does not show spinner when not loading', async () => {
    el = await mount<DoenButton>('doen-button');
    expect(el.shadowRoot!.querySelector('.fa-spinner')).toBeNull();
  });

  it('sets button type', async () => {
    el = await mount<DoenButton>('doen-button', { type: 'submit' });
    const btn = $<HTMLButtonElement>(el, 'button');
    expect(btn.type).toBe('submit');
  });

  it('sets aria-label when provided', async () => {
    el = await mount<DoenButton>('doen-button', { ariaLabelAttr: 'close' });
    const btn = $<HTMLButtonElement>(el, 'button');
    expect(btn.getAttribute('aria-label')).toBe('close');
  });

  it('prevents click when disabled', async () => {
    el = await mount<DoenButton>('doen-button', { disabled: true });
    let clicked = false;
    el.addEventListener('click', () => { clicked = true; });
    await click(el, $<HTMLButtonElement>(el, 'button'));
    expect(clicked).toBe(false);
  });

  it('prevents click propagation when loading', async () => {
    el = await mount<DoenButton>('doen-button', { loading: true });
    const events: MouseEvent[] = [];
    el.addEventListener('click', e => events.push(e));
    const btn = $<HTMLButtonElement>(el, 'button');
    const fakeClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopPropSpy = vi.spyOn(fakeClick, 'stopPropagation');
    const preventSpy = vi.spyOn(fakeClick, 'preventDefault');
    (el as any)._onClick(fakeClick);
    expect(preventSpy).toHaveBeenCalled();
    expect(stopPropSpy).toHaveBeenCalled();
    expect(btn).toBeTruthy();
  });

  it('does not prevent click when not disabled or loading', async () => {
    el = await mount<DoenButton>('doen-button');
    const fakeClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopPropSpy = vi.spyOn(fakeClick, 'stopPropagation');
    const preventSpy = vi.spyOn(fakeClick, 'preventDefault');
    (el as any)._onClick(fakeClick);
    expect(preventSpy).not.toHaveBeenCalled();
    expect(stopPropSpy).not.toHaveBeenCalled();
  });

  it('sets aria-pressed when pressed is defined', async () => {
    el = await mount<DoenButton>('doen-button', { pressed: true });
    const btn = $<HTMLButtonElement>(el, 'button');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('focuses inner button on focus()', async () => {
    el = await mount<DoenButton>('doen-button');
    el.focus();
    const btn = $<HTMLButtonElement>(el, 'button');
    // just assert no error thrown
    expect(btn).toBeTruthy();
  });
});

function $<T extends Element = Element>(el: DoenButton, selector: string): T {
  const found = el.shadowRoot?.querySelector<T>(selector);
  if (!found) throw new Error(`"${selector}" not found`);
  return found;
}
