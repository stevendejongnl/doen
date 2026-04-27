import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-reset';
import type { PageReset } from './page-reset';
import { confirmPasswordReset } from '../services/auth';

vi.mock('../services/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/auth')>();
  return { ...mod, confirmPasswordReset: vi.fn() };
});

describe('page-reset', () => {
  let el: PageReset;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  function $(selector: string) {
    const found = el.shadowRoot!.querySelector(selector);
    if (!found) throw new Error(`"${selector}" not found`);
    return found as HTMLElement;
  }

  beforeEach(async () => {
    el = await mount<PageReset>('page-reset', { token: 'abc123' });
  });

  it('renders the reset form', async () => {
    expect($('form')).toBeTruthy();
    expect(el.shadowRoot!.querySelectorAll('input[type="password"]').length).toBe(2);
  });

  it('submit button disabled initially', async () => {
    expect(($('.btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit button enabled when both fields filled', async () => {
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'newpass';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpass';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(($('.btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows error when passwords do not match', async () => {
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'newpass1';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpass2';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.error')?.textContent).toContain('overeen');
  });

  it('shows error when password too short', async () => {
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'abc';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'abc';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.error')?.textContent).toContain('6');
  });

  it('calls confirmPasswordReset on valid submit', async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue(undefined as never);
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'newpass123';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpass123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await el.updateComplete;
    await flushPromises();
    expect(vi.mocked(confirmPasswordReset)).toHaveBeenCalledWith('abc123', 'newpass123');
  });

  it('shows success after reset', async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue(undefined as never);
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'newpass123';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpass123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.success')).toBeTruthy();
  });

  it('shows error when reset fails with 401', async () => {
    const { ApiError } = await import('../services/api');
    vi.mocked(confirmPasswordReset).mockRejectedValue(new ApiError(401, 'expired'));
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'newpass123';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpass123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.error')?.textContent).toContain('verlopen');
  });

  it('shows generic error on other failure', async () => {
    vi.mocked(confirmPasswordReset).mockRejectedValue(new Error('network'));
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'newpass123';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpass123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.error')).toBeTruthy();
  });

  it('does nothing when _loading is true on submit', async () => {
    (el as any)._loading = true;
    const fakeEvent = { preventDefault: vi.fn() } as unknown as Event;
    await (el as any)._submit(fakeEvent);
    expect(vi.mocked(confirmPasswordReset)).not.toHaveBeenCalled();
  });

  it('dispatches navigate event on go-to-login click', async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue(undefined as never);
    const inputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="password"]');
    inputs[0].value = 'newpass123';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[1].value = 'newpass123';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    const events: CustomEvent[] = [];
    el.addEventListener('navigate', (e) => events.push(e as CustomEvent));
    (el.shadowRoot!.querySelector('.link-btn') as HTMLElement)?.click();
    await el.updateComplete;
    expect(events[0]?.detail.page).toBe('login');
  });
});
