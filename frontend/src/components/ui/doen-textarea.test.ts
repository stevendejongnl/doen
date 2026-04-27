import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount } from '../../../test/helpers';
import './doen-textarea';
import type { DoenTextarea } from './doen-textarea';

describe('doen-textarea', () => {
  let el: DoenTextarea;
  afterEach(() => { unmount(el); });

  function $<T extends Element>(selector: string) {
    const found = el.shadowRoot!.querySelector<T>(selector);
    if (!found) throw new Error(`"${selector}" not found`);
    return found;
  }

  it('renders textarea', async () => {
    el = await mount<DoenTextarea>('doen-textarea');
    expect($('textarea')).toBeTruthy();
  });

  it('renders label', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { label: 'Notes' });
    expect($('label').textContent).toBe('Notes');
  });

  it('sets placeholder', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { placeholder: 'Write here' });
    expect($<HTMLTextAreaElement>('textarea').placeholder).toBe('Write here');
  });

  it('disables textarea', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { disabled: true });
    expect($<HTMLTextAreaElement>('textarea').disabled).toBe(true);
  });

  it('sets rows', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { rows: 6 });
    expect($<HTMLTextAreaElement>('textarea').rows).toBe(6);
  });

  it('fires doen-input event', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { value: '' });
    const events: CustomEvent<{ value: string }>[] = [];
    el.addEventListener('doen-input', (e) => events.push(e as CustomEvent<{ value: string }>));
    const ta = $<HTMLTextAreaElement>('textarea');
    ta.value = 'hi';
    ta.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await el.updateComplete;
    expect(events[0]?.detail.value).toBe('hi');
  });

  it('fires doen-change event', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { value: '' });
    const events: CustomEvent<{ value: string }>[] = [];
    el.addEventListener('doen-change', (e) => events.push(e as CustomEvent<{ value: string }>));
    const ta = $<HTMLTextAreaElement>('textarea');
    ta.value = 'changed';
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    expect(events[0]?.detail.value).toBe('changed');
  });

  it('shows helpText', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { helpText: 'Optional note' });
    expect(el.shadowRoot!.querySelector('.help-text')?.textContent).toBe('Optional note');
  });

  it('shows errorText', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { errorText: 'Too short' });
    expect(el.shadowRoot!.querySelector('.error-text')?.textContent).toBe('Too short');
  });

  it('marks invalid on native invalid', async () => {
    el = await mount<DoenTextarea>('doen-textarea', { required: true });
    const ta = $<HTMLTextAreaElement>('textarea');
    ta.dispatchEvent(new Event('invalid', { bubbles: true }));
    await el.updateComplete;
    expect(ta.getAttribute('aria-invalid')).toBe('true');
  });

  it('exposes textareaId', async () => {
    el = await mount<DoenTextarea>('doen-textarea');
    expect(el.textareaId).toContain('doen-textarea-');
  });

  it('focus() delegates', async () => {
    el = await mount<DoenTextarea>('doen-textarea');
    el.focus();
    expect($('textarea')).toBeTruthy();
  });

  it('blur() delegates', async () => {
    el = await mount<DoenTextarea>('doen-textarea');
    expect(() => el.blur()).not.toThrow();
  });
});
