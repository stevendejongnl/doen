import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount } from '../../../test/helpers';
import './doen-field';
import type { DoenField } from './doen-field';

describe('doen-field', () => {
  let el: DoenField;
  afterEach(() => { unmount(el); });

  function q(selector: string) {
    return el.shadowRoot!.querySelector(selector);
  }

  it('renders slot', async () => {
    el = await mount<DoenField>('doen-field');
    expect(q('slot')).toBeTruthy();
  });

  it('renders label when provided', async () => {
    el = await mount<DoenField>('doen-field', { label: 'Name' });
    expect(q('label')?.textContent).toBe('Name');
  });

  it('does not render label when omitted', async () => {
    el = await mount<DoenField>('doen-field');
    expect(q('label')).toBeNull();
  });

  it('renders helpText', async () => {
    el = await mount<DoenField>('doen-field', { helpText: 'Hint' });
    expect(q('.help-text')?.textContent).toBe('Hint');
  });

  it('does not render helpText when empty', async () => {
    el = await mount<DoenField>('doen-field');
    expect(q('.help-text')).toBeNull();
  });

  it('renders errorText', async () => {
    el = await mount<DoenField>('doen-field', { errorText: 'Error msg' });
    expect(q('.error-text')?.textContent).toBe('Error msg');
  });

  it('does not render errorText when empty', async () => {
    el = await mount<DoenField>('doen-field');
    expect(q('.error-text')).toBeNull();
  });

  it('sets for attribute on label', async () => {
    el = await mount<DoenField>('doen-field', { label: 'Email', forId: 'email-input' });
    const label = q<HTMLLabelElement>('label')!;
    expect(label.htmlFor).toBe('email-input');
  });
});

function q<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}
