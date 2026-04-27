import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount } from '../../../test/helpers';
import './doen-confirm-dialog';
import type { DoenConfirmDialog } from './doen-confirm-dialog';

describe('doen-confirm-dialog', () => {
  let el: DoenConfirmDialog;
  afterEach(() => { unmount(el); });

  function $(selector: string) {
    const found = el.shadowRoot!.querySelector(selector);
    if (!found) throw new Error(`"${selector}" not found`);
    return found as HTMLElement;
  }

  it('renders message', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Are you sure?' });
    expect(el.shadowRoot!.querySelector('.body')?.textContent).toBe('Are you sure?');
  });

  it('renders confirm and cancel buttons', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Sure?' });
    expect($('.btn-confirm')).toBeTruthy();
    expect($('.btn-cancel')).toBeTruthy();
  });

  it('uses custom labels', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', {
      message: 'Delete?', confirmLabel: 'Yes, delete', cancelLabel: 'No',
    });
    expect($('.btn-confirm').textContent?.trim()).toBe('Yes, delete');
    expect($('.btn-cancel').textContent?.trim()).toBe('No');
  });

  it('fires doen-confirm on confirm button click', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Sure?' });
    const events: Event[] = [];
    el.addEventListener('doen-confirm', (e) => events.push(e));
    $('.btn-confirm').click();
    await el.updateComplete;
    expect(events.length).toBe(1);
  });

  it('fires doen-cancel on cancel button click', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Sure?' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    $('.btn-cancel').click();
    await el.updateComplete;
    expect(events.length).toBe(1);
  });

  it('fires doen-cancel on Escape keydown', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Sure?' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(events.length).toBe(1);
  });

  it('fires doen-cancel on backdrop click when target equals currentTarget', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Sure?' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    const backdrop = el.shadowRoot!.querySelector('.backdrop') as HTMLElement;
    const fakeEvent = { target: backdrop, currentTarget: backdrop } as unknown as MouseEvent;
    (el as any)._onBackdropClick(fakeEvent);
    await el.updateComplete;
    expect(events.length).toBe(1);
  });

  it('applies danger variant class', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Delete?', confirmVariant: 'danger' });
    expect($('.btn-confirm').classList.contains('danger')).toBe(true);
  });

  it('applies primary variant class', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Go?', confirmVariant: 'primary' });
    expect($('.btn-confirm').classList.contains('primary')).toBe(true);
  });

  it('non-Escape keydown does not fire doen-cancel', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Sure?' });
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(events.length).toBe(0);
  });

  it('removes Escape listener on disconnect', async () => {
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'Sure?' });
    unmount(el);
    const events: Event[] = [];
    el.addEventListener('doen-cancel', (e) => events.push(e));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(events.length).toBe(0);
    el = await mount<DoenConfirmDialog>('doen-confirm-dialog', { message: 'reused' });
  });
});
