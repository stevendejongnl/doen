import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount } from '../../../test/helpers';
import './doen-input';
import type { DoenInput } from './doen-input';

describe('doen-input', () => {
  let el: DoenInput;
  afterEach(() => { unmount(el); });

  function $<T extends Element>(selector: string) {
    const found = el.shadowRoot!.querySelector<T>(selector);
    if (!found) throw new Error(`"${selector}" not found`);
    return found;
  }

  it('renders input', async () => {
    el = await mount<DoenInput>('doen-input');
    expect($('input')).toBeTruthy();
  });

  it('renders label when provided', async () => {
    el = await mount<DoenInput>('doen-input', { label: 'Email' });
    expect($('label').textContent).toBe('Email');
  });

  it('does not render label when omitted', async () => {
    el = await mount<DoenInput>('doen-input');
    expect(el.shadowRoot!.querySelector('label')).toBeNull();
  });

  it('sets input type', async () => {
    el = await mount<DoenInput>('doen-input', { type: 'password' });
    expect($<HTMLInputElement>('input').type).toBe('password');
  });

  it('sets placeholder', async () => {
    el = await mount<DoenInput>('doen-input', { placeholder: 'Enter name' });
    expect($<HTMLInputElement>('input').placeholder).toBe('Enter name');
  });

  it('disables input', async () => {
    el = await mount<DoenInput>('doen-input', { disabled: true });
    expect($<HTMLInputElement>('input').disabled).toBe(true);
  });

  it('fires doen-input event on input', async () => {
    el = await mount<DoenInput>('doen-input', { value: '' });
    const events: CustomEvent<{ value: string }>[] = [];
    el.addEventListener('doen-input', (e) => events.push(e as CustomEvent<{ value: string }>));
    const input = $<HTMLInputElement>('input');
    input.value = 'hello';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await el.updateComplete;
    expect(events[0]?.detail.value).toBe('hello');
  });

  it('fires doen-change event on change', async () => {
    el = await mount<DoenInput>('doen-input', { value: '' });
    const events: CustomEvent<{ value: string }>[] = [];
    el.addEventListener('doen-change', (e) => events.push(e as CustomEvent<{ value: string }>));
    const input = $<HTMLInputElement>('input');
    input.value = 'world';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    expect(events[0]?.detail.value).toBe('world');
  });

  it('shows helpText', async () => {
    el = await mount<DoenInput>('doen-input', { helpText: 'Enter your name' });
    expect(el.shadowRoot!.querySelector('.help-text')?.textContent).toBe('Enter your name');
  });

  it('shows errorText when set', async () => {
    el = await mount<DoenInput>('doen-input', { errorText: 'Required' });
    expect(el.shadowRoot!.querySelector('.error-text')?.textContent).toBe('Required');
  });

  it('does not show errorText when not set', async () => {
    el = await mount<DoenInput>('doen-input');
    expect(el.shadowRoot!.querySelector('.error-text')).toBeNull();
  });

  it('sets aria-invalid when errorText is set', async () => {
    el = await mount<DoenInput>('doen-input', { errorText: 'Bad' });
    expect($<HTMLInputElement>('input').getAttribute('aria-invalid')).toBe('true');
  });

  it('marks invalid on native invalid event', async () => {
    el = await mount<DoenInput>('doen-input', { required: true });
    const input = $<HTMLInputElement>('input');
    input.dispatchEvent(new Event('invalid', { bubbles: true }));
    await el.updateComplete;
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('focus() delegates to inner input', async () => {
    el = await mount<DoenInput>('doen-input');
    el.focus();
    expect(el.shadowRoot!.querySelector('input')).toBeTruthy();
  });

  it('exposesInputId', async () => {
    el = await mount<DoenInput>('doen-input');
    expect(el.inputId).toContain('doen-input-');
  });

  it('applies size-sm class', async () => {
    el = await mount<DoenInput>('doen-input', { size: 'sm' });
    expect($<HTMLInputElement>('input').classList.contains('size-sm')).toBe(true);
  });

  it('blur() delegates to inner input', async () => {
    el = await mount<DoenInput>('doen-input');
    expect(() => el.blur()).not.toThrow();
  });

  it('select() delegates to inner input', async () => {
    el = await mount<DoenInput>('doen-input');
    expect(() => (el as any).select()).not.toThrow();
  });
});
