import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount } from '../../../test/helpers';
import './doen-prompt-dialog';
import type { DoenPromptDialog } from './doen-prompt-dialog';

describe('doen-prompt-dialog', () => {
  let el: DoenPromptDialog;
  afterEach(() => { unmount(el); });

  function $(selector: string) {
    const found = el.shadowRoot!.querySelector(selector);
    if (!found) throw new Error(`"${selector}" not found`);
    return found as HTMLElement;
  }

  it('renders message', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'Enter name' });
    expect(el.shadowRoot!.querySelector('.message')?.textContent).toBe('Enter name');
  });

  it('renders input', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'Name?' });
    expect($('input')).toBeTruthy();
  });

  it('sets placeholder', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x', placeholder: 'Type here' });
    expect(($('input') as HTMLInputElement).placeholder).toBe('Type here');
  });

  it('submit button disabled when empty', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const btn = $('.btn-submit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit button enabled when value entered', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const input = $('input') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(($('.btn-submit') as HTMLButtonElement).disabled).toBe(false);
  });

  it('fires doen-submit with trimmed value on submit click', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: CustomEvent<string>[] = [];
    el.addEventListener('doen-submit', (e) => events.push(e as CustomEvent<string>));
    const input = $('input') as HTMLInputElement;
    input.value = '  my value  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    $('.btn-submit').click();
    await el.updateComplete;
    expect(events[0]?.detail).toBe('my value');
  });

  it('fires doen-cancel on cancel click', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    $('.btn-cancel').click();
    await el.updateComplete;
    expect(events.length).toBe(1);
  });

  it('fires doen-cancel on Escape key', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(events.length).toBe(1);
  });

  it('fires doen-submit on Enter key in input', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: CustomEvent<string>[] = [];
    el.addEventListener('doen-submit', (e) => events.push(e as CustomEvent<string>));
    const input = $('input') as HTMLInputElement;
    input.value = 'enter-submit';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;
    expect(events[0]?.detail).toBe('enter-submit');
  });

  it('does not fire doen-submit on Enter if value is empty', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: Event[] = [];
    el.addEventListener('doen-submit', (e) => events.push(e));
    const input = $('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;
    expect(events.length).toBe(0);
  });

  it('fires doen-cancel on backdrop click when target equals currentTarget', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    const backdrop = el.shadowRoot!.querySelector('.backdrop') as HTMLElement;
    const fakeEvent = { target: backdrop, currentTarget: backdrop } as unknown as MouseEvent;
    (el as any)._onBackdropClick(fakeEvent);
    await el.updateComplete;
    expect(events.length).toBe(1);
  });

  it('does not cancel on backdrop click when target differs from currentTarget', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    const backdrop = el.shadowRoot!.querySelector('.backdrop') as HTMLElement;
    const inner = el.shadowRoot!.querySelector('.dialog') as HTMLElement;
    const fakeEvent = { target: inner, currentTarget: backdrop } as unknown as MouseEvent;
    (el as any)._onBackdropClick(fakeEvent);
    expect(events.length).toBe(0);
  });

  it('uses custom labels', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', {
      message: 'x', submitLabel: 'Save', cancelLabel: 'Nope',
    });
    expect($('.btn-submit').textContent?.trim()).toBe('Save');
    expect($('.btn-cancel').textContent?.trim()).toBe('Nope');
  });

  it('non-Escape keydown does not fire doen-cancel', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(events.length).toBe(0);
  });

  it('non-Enter keydown in input does not submit', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    const events: Event[] = [];
    el.addEventListener('doen-submit', (e) => events.push(e));
    (el as any)._value = 'some text';
    (el as any)._onInputKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(events.length).toBe(0);
  });

  it('removes Escape listener on disconnect', async () => {
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'x' });
    unmount(el);
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(events.length).toBe(0);
    el = await mount<DoenPromptDialog>('doen-prompt-dialog', { message: 'reused' });
  });
});
