import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount } from '../../../test/helpers';
import './doen-select';
import type { DoenSelect } from './doen-select';
import type { SelectOption } from './doen-select';

describe('doen-select', () => {
  let el: DoenSelect;
  afterEach(() => { unmount(el); });

  const opts: SelectOption[] = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C', disabled: true },
  ];

  function $<T extends Element>(selector: string) {
    const found = el.shadowRoot!.querySelector<T>(selector);
    if (!found) throw new Error(`"${selector}" not found`);
    return found;
  }

  it('renders select element', async () => {
    el = await mount<DoenSelect>('doen-select', { options: opts });
    expect($('select')).toBeTruthy();
  });

  it('renders options', async () => {
    el = await mount<DoenSelect>('doen-select', { options: opts });
    const options = el.shadowRoot!.querySelectorAll('option');
    expect(options.length).toBe(3);
    expect(options[0].value).toBe('a');
    expect(options[1].textContent).toBe('Option B');
  });

  it('marks disabled option', async () => {
    el = await mount<DoenSelect>('doen-select', { options: opts });
    const options = el.shadowRoot!.querySelectorAll('option');
    expect(options[2].disabled).toBe(true);
  });

  it('renders label when provided', async () => {
    el = await mount<DoenSelect>('doen-select', { options: [], label: 'Pick one' });
    expect($('label').textContent).toBe('Pick one');
  });

  it('fires doen-change on selection change', async () => {
    el = await mount<DoenSelect>('doen-select', { options: opts, value: 'a' });
    const events: CustomEvent<{ value: string }>[] = [];
    el.addEventListener('doen-change', (e) => events.push(e as CustomEvent<{ value: string }>));
    const select = $<HTMLSelectElement>('select');
    select.value = 'b';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    expect(events[0]?.detail.value).toBe('b');
  });

  it('disables select when disabled=true', async () => {
    el = await mount<DoenSelect>('doen-select', { options: opts, disabled: true });
    expect($<HTMLSelectElement>('select').disabled).toBe(true);
  });

  it('shows errorText', async () => {
    el = await mount<DoenSelect>('doen-select', { options: [], errorText: 'Required' });
    expect(el.shadowRoot!.querySelector('.error-text')?.textContent).toBe('Required');
  });

  it('shows helpText', async () => {
    el = await mount<DoenSelect>('doen-select', { options: [], helpText: 'Choose wisely' });
    expect(el.shadowRoot!.querySelector('.help-text')?.textContent).toBe('Choose wisely');
  });

  it('marks invalid on native invalid event', async () => {
    el = await mount<DoenSelect>('doen-select', { options: opts, required: true });
    const select = $<HTMLSelectElement>('select');
    select.dispatchEvent(new Event('invalid', { bubbles: true }));
    await el.updateComplete;
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });

  it('exposes selectId', async () => {
    el = await mount<DoenSelect>('doen-select', { options: [] });
    expect(el.selectId).toContain('doen-select-');
  });

  it('focus() delegates to select', async () => {
    el = await mount<DoenSelect>('doen-select', { options: [] });
    el.focus();
    expect($('select')).toBeTruthy();
  });

  it('applies size-sm', async () => {
    el = await mount<DoenSelect>('doen-select', { options: [], size: 'sm' });
    expect($<HTMLSelectElement>('select').classList.contains('size-sm')).toBe(true);
  });
});
