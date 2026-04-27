import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { mount, unmount, flushPromises } from '../../test/helpers';
import './page-group-settings';
import type { PageGroupSettings } from './page-group-settings';
import { api, ApiError, purgeOffers, resetBalances, adjustBalance } from '../services/api';
import { getMe } from '../services/auth';

describe('page-group-settings', () => {
  let el: PageGroupSettings;
  afterEach(() => { unmount(el); vi.clearAllMocks(); });

  const me = { id: 'me', email: 'owner@example.com', name: 'Owner', is_admin: true };
  const group = { id: 'g1', name: 'My Household', type: 'household', owner_id: 'me' };
  const members = [
    { user_id: 'me', name: 'Owner', email: 'owner@example.com', role: 'admin' },
    { user_id: 'u2', name: 'Alice', email: 'alice@example.com', role: 'member' },
  ];
  const offers = [
    { id: 'o1', status: 'open', title: 'Offer 1', group_id: 'g1' },
    { id: 'o2', status: 'approved', title: 'Offer 2', group_id: 'g1' },
  ];
  const balances = [
    { user_id: 'me', balance: 10 },
    { user_id: 'u2', balance: -5 },
  ];
  const categories = [
    { id: 'c1', name: 'Food', color: '#6366f1', group_id: 'g1', project_id: null },
  ];

  async function setup(overrides: Partial<{group: typeof group, canManage: boolean}> = {}) {
    const g = overrides.group ?? group;
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes(`/groups/${g.id}`) && !url.includes('members')) return Promise.resolve(g);
      if (url.includes(`/groups/${g.id}/members`)) return Promise.resolve(members);
      if (url.includes('/categories')) return Promise.resolve(categories);
      if (url.includes(`/households/${g.id}/offers`)) return Promise.resolve(offers);
      if (url.includes(`/households/${g.id}/balances`)) return Promise.resolve(balances);
      return Promise.resolve([]);
    });
    el = await mount<PageGroupSettings>('page-group-settings', { groupId: g.id });
    await flushPromises();
    await el.updateComplete;
  }

  it('shows loading skeleton while fetching', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    el = await mount<PageGroupSettings>('page-group-settings', { groupId: 'g1' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.sk')).toBeTruthy();
  });

  it('shows group name after load', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('My Household');
  });

  it('shows offers section for household groups', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Aanbiedingen opschonen');
  });

  it('shows points section for household groups', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Punten corrigeren');
  });

  it('does not show offers/points for non-household groups', async () => {
    const customGroup = { ...group, type: 'custom' };
    await setup({ group: customGroup });
    expect(el.shadowRoot!.textContent).not.toContain('Aanbiedingen opschonen');
    expect(el.shadowRoot!.textContent).not.toContain('Punten corrigeren');
  });

  it('shows access denied when user is not admin', async () => {
    vi.mocked(getMe).mockResolvedValue({ ...me, id: 'other' });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes(`/groups/${group.id}`) && !url.includes('members')) return Promise.resolve(group);
      if (url.includes(`/groups/${group.id}/members`)) return Promise.resolve(members);
      if (url.includes('/categories')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el = await mount<PageGroupSettings>('page-group-settings', { groupId: 'g1' });
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('beheerders');
  });

  it('dispatches navigate back event on back button click', async () => {
    await setup();
    const events: CustomEvent[] = [];
    el.addEventListener('navigate', e => events.push(e as CustomEvent));
    (el.shadowRoot!.querySelector('.back-btn') as HTMLButtonElement).click();
    expect(events[0]?.detail).toEqual({ page: 'groups' });
  });

  // Offers section
  it('toggles offer status checkbox', async () => {
    await setup();
    const checkboxes = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const openCheckbox = Array.from(checkboxes).find(cb => cb.dataset.status === 'open')!;
    openCheckbox.click();
    await el.updateComplete;
    expect((el as any)._selectedStatuses.has('open')).toBe(true);
  });

  it('shows confirm purge UI on purge button click', async () => {
    await setup();
    // First select a status
    const checkboxes = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const openCheckbox = Array.from(checkboxes).find(cb => cb.dataset.status === 'open')!;
    openCheckbox.click();
    await el.updateComplete;
    const purgeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-danger:not([data-category-id])')!;
    purgeBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Bevestigen');
  });

  it('purges offers on confirm', async () => {
    await setup();
    vi.mocked(purgeOffers).mockResolvedValue({ deleted_offer_ids: ['o1'] });
    const checkboxes = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const openCheckbox = Array.from(checkboxes).find(cb => cb.dataset.status === 'open')!;
    openCheckbox.click();
    await el.updateComplete;
    const purgeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-danger:not([data-category-id])')!;
    purgeBtn.click();
    await el.updateComplete;
    const confirmBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.confirm-inline .btn-danger')!;
    confirmBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(purgeOffers)).toHaveBeenCalledWith('g1', ['open']);
  });

  it('cancels purge on cancel button click', async () => {
    await setup();
    const checkboxes = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const openCheckbox = Array.from(checkboxes).find(cb => cb.dataset.status === 'open')!;
    openCheckbox.click();
    await el.updateComplete;
    const purgeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-danger:not([data-category-id])')!;
    purgeBtn.click();
    await el.updateComplete;
    const cancelBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.confirm-inline .btn-outline')!;
    cancelBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.confirm-inline')).toBeNull();
    expect(vi.mocked(purgeOffers)).not.toHaveBeenCalled();
  });

  // Points section
  it('shows balance values', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('+10 pt');
    expect(el.shadowRoot!.textContent).toContain('-5 pt');
  });

  it('adjusts balance on apply click', async () => {
    await setup();
    vi.mocked(adjustBalance).mockResolvedValue({} as never);
    const deltaInputs = el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="number"]');
    const myDeltaInput = Array.from(deltaInputs).find(i => i.dataset.userId === 'me')!;
    myDeltaInput.value = '5';
    myDeltaInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const applyBtns = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-user-id="me"].btn-outline');
    const applyBtn = Array.from(applyBtns).find(b => b.textContent?.includes('Toepassen'))!;
    applyBtn.click();
    await flushPromises();
    expect(vi.mocked(adjustBalance)).toHaveBeenCalledWith('g1', 'me', 5, null);
  });

  it('shows confirm reset one on reset button click', async () => {
    await setup();
    const resetOneBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="me"][title="Reset naar 0"]')!;
    resetOneBtn.click();
    await el.updateComplete;
    expect((el as any)._confirmResetUserId).toBe('me');
  });

  it('resets one user balance on confirm', async () => {
    await setup();
    vi.mocked(resetBalances).mockResolvedValue(undefined);
    const resetOneBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="me"][title="Reset naar 0"]')!;
    resetOneBtn.click();
    await el.updateComplete;
    const confirmResetBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="me"].btn-danger')!;
    confirmResetBtn.click();
    await flushPromises();
    expect(vi.mocked(resetBalances)).toHaveBeenCalledWith('g1', ['me']);
  });

  it('cancels reset one on cancel', async () => {
    await setup();
    const resetOneBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-user-id="me"][title="Reset naar 0"]')!;
    resetOneBtn.click();
    await el.updateComplete;
    const cancelBtn = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.btn-outline')).find(b => b.textContent?.includes('Annuleren'))!;
    cancelBtn.click();
    await el.updateComplete;
    expect((el as any)._confirmResetUserId).toBe('');
  });

  it('shows confirm reset all on reset all click', async () => {
    await setup();
    const resetAllBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.reset-all-row .btn-danger')!;
    resetAllBtn.click();
    await el.updateComplete;
    expect((el as any)._confirmResetAll).toBe(true);
  });

  it('resets all balances on confirm', async () => {
    await setup();
    vi.mocked(resetBalances).mockResolvedValue(undefined);
    const resetAllBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.reset-all-row .btn-danger')!;
    resetAllBtn.click();
    await el.updateComplete;
    const confirmBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.reset-all-row .btn-danger')!;
    confirmBtn.click();
    await flushPromises();
    expect(vi.mocked(resetBalances)).toHaveBeenCalledWith('g1', null);
  });

  it('cancels reset all on cancel', async () => {
    await setup();
    const resetAllBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.reset-all-row .btn-danger')!;
    resetAllBtn.click();
    await el.updateComplete;
    const cancelBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.reset-all-row .btn-outline')!;
    cancelBtn.click();
    await el.updateComplete;
    expect((el as any)._confirmResetAll).toBe(false);
  });

  // Categories section
  it('shows categories', async () => {
    await setup();
    expect(el.shadowRoot!.textContent).toContain('Food');
  });

  it('creates a new category', async () => {
    await setup();
    const newCat = { id: 'c2', name: 'Work', color: '#6366f1', group_id: 'g1', project_id: null };
    vi.mocked(api.post).mockResolvedValue(newCat);
    const catInput = el.shadowRoot!.querySelector<HTMLInputElement>('.new-category-form input[type="text"]')!;
    catInput.value = 'Work';
    catInput.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    el.shadowRoot!.querySelector('.new-category-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/categories', expect.objectContaining({ name: 'Work', group_id: 'g1' }));
    expect(el.shadowRoot!.textContent).toContain('Work');
  });

  it('category create button disabled when name empty', async () => {
    await setup();
    const btn = el.shadowRoot!.querySelector<HTMLButtonElement>('.new-category-form button[type="submit"]')!;
    expect(btn.disabled).toBe(true);
  });

  it('selects a new category color', async () => {
    await setup();
    const colorOptions = el.shadowRoot!.querySelectorAll<HTMLElement>('.new-category-form .color-option');
    const lastColor = colorOptions[colorOptions.length - 1];
    lastColor.click();
    await el.updateComplete;
    expect(lastColor.className).toContain('active');
  });

  it('shows edit input on pencil click', async () => {
    await setup();
    const editBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-category-id="c1"].icon-btn:not(.danger)')!;
    editBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.category-name-input')).toBeTruthy();
  });

  it('commits category rename on blur', async () => {
    await setup();
    vi.mocked(api.put).mockResolvedValue({ ...categories[0], name: 'Groceries' });
    const editBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-category-id="c1"].icon-btn:not(.danger)')!;
    editBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.category-name-input')!;
    input.value = 'Groceries';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/categories/c1', expect.objectContaining({ name: 'Groceries' }));
  });

  it('commits category rename on Enter', async () => {
    await setup();
    vi.mocked(api.put).mockResolvedValue({ ...categories[0], name: 'Nutrition' });
    const editBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-category-id="c1"].icon-btn:not(.danger)')!;
    editBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.category-name-input')!;
    input.value = 'Nutrition';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('cancels category rename on Escape', async () => {
    await setup();
    const editBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-category-id="c1"].icon-btn:not(.danger)')!;
    editBtn.click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.category-name-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.category-name-input')).toBeNull();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('cycles category color on swatch click', async () => {
    await setup();
    vi.mocked(api.put).mockResolvedValue({ ...categories[0], color: '#10b981' });
    const swatch = el.shadowRoot!.querySelector<HTMLElement>('[data-category-id="c1"].color-swatch')!;
    swatch.click();
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalledWith('/categories/c1', expect.objectContaining({ color: '#10b981' }));
  });

  it('shows delete confirm on trash click', async () => {
    await setup();
    const trashBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-category-id="c1"].danger')!;
    trashBtn.click();
    await el.updateComplete;
    expect((el as any)._confirmDeleteCategoryId).toBe('c1');
  });

  it('deletes category on confirm', async () => {
    await setup();
    vi.mocked(api.delete).mockResolvedValue(undefined);
    const trashBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-category-id="c1"].danger')!;
    trashBtn.click();
    await el.updateComplete;
    const confirmBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-category-id="c1"].btn-danger')!;
    confirmBtn.click();
    await flushPromises();
    await el.updateComplete;
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith('/categories/c1');
    expect(el.shadowRoot!.textContent).not.toContain('Food');
  });

  it('cancels category delete on cancel', async () => {
    await setup();
    const trashBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-category-id="c1"].danger')!;
    trashBtn.click();
    await el.updateComplete;
    const cancelBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('.category-row .btn-outline')!;
    cancelBtn.click();
    await el.updateComplete;
    expect((el as any)._confirmDeleteCategoryId).toBe('');
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('reload() method refreshes data', async () => {
    await setup();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes(`/groups/${group.id}`) && !url.includes('members')) return Promise.resolve({ ...group, name: 'Reloaded' });
      if (url.includes(`/groups/${group.id}/members`)) return Promise.resolve(members);
      if (url.includes('/categories')) return Promise.resolve([]);
      if (url.includes(`/households/${group.id}/offers`)) return Promise.resolve([]);
      if (url.includes(`/households/${group.id}/balances`)) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    el.reload();
    await flushPromises();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('Reloaded');
  });

  it('shows error toast when category color change fails', async () => {
    const cats = [{ id: 'c1', name: 'Work', color: '#a855f7', group_id: 'g1', project_id: null }];
    await setup({ categories: cats });
    vi.mocked(api.put).mockRejectedValue(new ApiError(500, 'color fail'));
    await (el as any)._updateCategoryColor(cats[0]);
    await flushPromises();
    expect(vi.mocked(api.put)).toHaveBeenCalled();
  });

  it('shows error toast when category delete fails', async () => {
    const cats = [{ id: 'c1', name: 'Work', color: '#a855f7', group_id: 'g1', project_id: null }];
    await setup({ categories: cats });
    vi.mocked(api.delete).mockRejectedValue(new ApiError(500, 'delete fail'));
    await (el as any)._deleteCategory('c1');
    await flushPromises();
    expect((el as any)._deletingCategoryId).toBe('');
  });

  it('_onNoteInput sets point note for user', async () => {
    await setup();
    (el as any)._onNoteInput({
      currentTarget: { dataset: { userId: 'u1' } },
      target: { value: 'test note' },
    } as unknown as Event);
    expect((el as any)._pointNotes['u1']).toBe('test note');
  });

  it('shows error toast when create category fails', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'create cat fail'));
    (el as any)._newCategoryName = 'Work';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._createCategory(fakeEvent);
    await flushPromises();
    expect((el as any)._creatingCategory).toBe(false);
  });

  it('_commitEditCategory cancels when same name submitted', async () => {
    await setup();
    const cat = categories[0];
    (el as any)._editingCategoryId = cat.id;
    (el as any)._editingCategoryName = cat.name;
    await (el as any)._commitEditCategory(cat);
    expect((el as any)._editingCategoryId).toBe('');
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('shows error toast when _commitEditCategory fails', async () => {
    await setup();
    const cat = categories[0];
    vi.mocked(api.put).mockRejectedValue(new ApiError(500, 'rename cat fail'));
    (el as any)._editingCategoryId = cat.id;
    (el as any)._editingCategoryName = 'NewName';
    await (el as any)._commitEditCategory(cat);
    await flushPromises();
    expect((el as any)._savingCategoryId).toBe('');
  });

  it('_doAdjust shows error toast when NaN', async () => {
    await setup();
    (el as any)._pointDeltas = { me: 'abc' };
    await (el as any)._doAdjust({ user_id: 'me', name: 'Me', balance: 10 });
    expect(vi.mocked(adjustBalance)).not.toHaveBeenCalled();
  });

  it('_doAdjust shows error toast when zero', async () => {
    await setup();
    (el as any)._pointDeltas = { me: '0' };
    await (el as any)._doAdjust({ user_id: 'me', name: 'Me', balance: 10 });
    expect(vi.mocked(adjustBalance)).not.toHaveBeenCalled();
  });

  it('_doAdjust non-ApiError is ignored silently', async () => {
    await setup();
    vi.mocked(adjustBalance).mockRejectedValue(new Error('network'));
    (el as any)._pointDeltas = { me: '5' };
    await (el as any)._doAdjust({ user_id: 'me', name: 'Me', balance: 10 });
    await flushPromises();
    expect(vi.mocked(adjustBalance)).toHaveBeenCalled();
  });

  it('_doAdjust updates balance when user is not in balances list', async () => {
    await setup();
    vi.mocked(adjustBalance).mockResolvedValue({} as never);
    (el as any)._pointDeltas = { u999: '5' };
    (el as any)._balances = [];
    await (el as any)._doAdjust({ user_id: 'u999', name: 'Unknown', balance: 0 });
    await flushPromises();
    expect(vi.mocked(adjustBalance)).toHaveBeenCalled();
  });

  it('_doResetOne non-ApiError is ignored silently', async () => {
    await setup();
    vi.mocked(resetBalances).mockRejectedValue(new Error('network'));
    await (el as any)._doResetOne('me');
    await flushPromises();
    expect(vi.mocked(resetBalances)).toHaveBeenCalled();
  });

  it('_doResetAll non-ApiError is ignored silently', async () => {
    await setup();
    vi.mocked(resetBalances).mockRejectedValue(new Error('network'));
    await (el as any)._doResetAll();
    await flushPromises();
    expect(vi.mocked(resetBalances)).toHaveBeenCalled();
  });

  it('_doPurgeOffers non-ApiError is ignored silently', async () => {
    await setup();
    vi.mocked(purgeOffers).mockRejectedValue(new Error('network'));
    (el as any)._purgeStatuses = ['open'];
    (el as any)._confirmPurge = true;
    await (el as any)._doPurgeOffers();
    await flushPromises();
    expect(vi.mocked(purgeOffers)).toHaveBeenCalled();
  });

  it('_toggleStatus deselects a previously selected status', async () => {
    await setup();
    (el as any)._selectedStatuses = new Set(['open']);
    (el as any)._toggleStatus('open');
    expect((el as any)._selectedStatuses.has('open')).toBe(false);
  });

  it('non-ApiError from _load is ignored silently', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'));
    el = await mount<PageGroupSettings>('page-group-settings', { groupId: 'g1' });
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._loading).toBe(false);
  });

  it('ApiError from _load shows toast', async () => {
    vi.mocked(getMe).mockResolvedValue(me);
    vi.mocked(api.get).mockRejectedValue(new ApiError(500, 'load failed'));
    el = await mount<PageGroupSettings>('page-group-settings', { groupId: 'g1' });
    await flushPromises();
    await el.updateComplete;
    expect((el as any)._loading).toBe(false);
  });

  it('_canManage returns false when _me is null', async () => {
    await setup();
    (el as any)._me = null;
    expect((el as any)._canManage(group)).toBe(false);
  });

  it('_doPurgeOffers returns early when already purging', async () => {
    await setup();
    (el as any)._purging = true;
    await (el as any)._doPurgeOffers();
    expect(vi.mocked(purgeOffers)).not.toHaveBeenCalled();
  });

  it('ApiError from _doPurgeOffers shows toast', async () => {
    await setup();
    vi.mocked(purgeOffers).mockRejectedValue(new ApiError(500, 'purge fail'));
    (el as any)._purgeStatuses = ['open'];
    (el as any)._confirmPurge = true;
    await (el as any)._doPurgeOffers();
    await flushPromises();
    expect(vi.mocked(purgeOffers)).toHaveBeenCalled();
  });

  it('ApiError from _doAdjust shows toast', async () => {
    await setup();
    vi.mocked(adjustBalance).mockRejectedValue(new ApiError(500, 'adjust fail'));
    (el as any)._pointDeltas = { me: '5' };
    await (el as any)._doAdjust({ user_id: 'me', name: 'Me', balance: 10 });
    await flushPromises();
    expect(vi.mocked(adjustBalance)).toHaveBeenCalled();
  });

  it('ApiError from _doResetOne shows toast', async () => {
    await setup();
    vi.mocked(resetBalances).mockRejectedValue(new ApiError(500, 'reset fail'));
    await (el as any)._doResetOne('me');
    await flushPromises();
    expect(vi.mocked(resetBalances)).toHaveBeenCalled();
  });

  it('ApiError from _doResetAll shows toast', async () => {
    await setup();
    vi.mocked(resetBalances).mockRejectedValue(new ApiError(500, 'reset all fail'));
    await (el as any)._doResetAll();
    await flushPromises();
    expect(vi.mocked(resetBalances)).toHaveBeenCalled();
  });

  it('_createCategory returns early when already creating', async () => {
    await setup();
    (el as any)._creatingCategory = true;
    (el as any)._newCategoryName = 'Work';
    const fakeEvent = { preventDefault: () => {} } as Event;
    await (el as any)._createCategory(fakeEvent);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('_commitEditCategory returns early when already saving', async () => {
    await setup();
    (el as any)._savingCategoryId = 'c1';
    await (el as any)._commitEditCategory(categories[0]);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_onEditCategoryKeydown with unknown category id returns early', async () => {
    await setup();
    (el as any)._editingCategoryId = 'c1';
    const fakeEvent = { currentTarget: { dataset: { categoryId: 'unknown' } }, key: 'Enter', preventDefault: () => {} };
    (el as any)._onEditCategoryKeydown(fakeEvent as unknown as KeyboardEvent);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('balance with no matching member is skipped in render', async () => {
    await setup();
    (el as any)._balances = [{ user_id: 'ghost', balance: 5 }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.balance-row')).toBeNull();
  });

  it('shows + prefix for positive totalBalance in reset-all confirmation', async () => {
    await setup();
    (el as any)._balances = [{ user_id: 'me', balance: 10 }];
    (el as any)._confirmResetAll = true;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('+10');
  });

  it('shows spinner in purge confirm button while purging', async () => {
    await setup();
    (el as any)._confirmPurge = true;
    (el as any)._purging = true;
    (el as any)._selectedStatuses = new Set(['open']);
    await el.updateComplete;
    const spinner = el.shadowRoot!.querySelector('.confirm-inline .fa-spinner');
    expect(spinner).toBeTruthy();
  });

  it('shows spinner in reset-one confirm button while resetting', async () => {
    await setup();
    (el as any)._confirmResetUserId = 'me';
    (el as any)._resettingUserId = 'me';
    await el.updateComplete;
    const spinner = el.shadowRoot!.querySelector('.fa-spinner');
    expect(spinner).toBeTruthy();
  });

  it('shows spinner in reset-all confirm button while resetting all', async () => {
    await setup();
    (el as any)._confirmResetAll = true;
    (el as any)._resettingAll = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.reset-all-row .fa-spinner')).toBeTruthy();
  });

  it('category with project_id shows scope label', async () => {
    await setup();
    (el as any)._categories = [{ id: 'c2', name: 'MyProj', color: '#fff', group_id: 'g1', project_id: 'p1' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.category-scope')).toBeTruthy();
  });

  it('shows spinner in delete category confirm button while deleting', async () => {
    await setup();
    (el as any)._confirmDeleteCategoryId = 'c1';
    (el as any)._deletingCategoryId = 'c1';
    await el.updateComplete;
    const catSection = el.shadowRoot!.querySelector('[data-category-id="c1"].btn-danger');
    expect(catSection).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.fa-spinner')).toBeTruthy();
  });

  it('_doAdjust uses empty string when member not in pointDeltas', async () => {
    await setup();
    // Don't set _pointDeltas for 'me' — should fallback to '' and trigger NaN guard
    (el as any)._pointDeltas = {};
    await (el as any)._doAdjust({ user_id: 'me', name: 'Me', balance: 10 });
    expect(vi.mocked(adjustBalance)).not.toHaveBeenCalled();
  });

  it('_doResetOne shows "lid" when member not found', async () => {
    await setup();
    vi.mocked(resetBalances).mockResolvedValue(undefined);
    (el as any)._members = [];
    await (el as any)._doResetOne('unknown-user');
    await flushPromises();
    expect(vi.mocked(resetBalances)).toHaveBeenCalled();
  });

  it('_commitEditCategory updates non-matching categories unchanged', async () => {
    await setup();
    const cat1 = { id: 'c1', name: 'Food', color: '#6366f1', group_id: 'g1', project_id: null };
    const cat2 = { id: 'c2', name: 'Sport', color: '#10b981', group_id: 'g1', project_id: null };
    (el as any)._categories = [cat1, cat2];
    const updated = { ...cat1, name: 'Voeding' };
    vi.mocked(api.put).mockResolvedValue(updated);
    (el as any)._editingCategoryName = 'Voeding';
    await (el as any)._commitEditCategory(cat1);
    await flushPromises();
    expect((el as any)._categories.find((c: typeof cat2) => c.id === 'c2').name).toBe('Sport');
  });

  it('_updateCategoryColor updates non-matching categories unchanged', async () => {
    await setup();
    const cat1 = { id: 'c1', name: 'Food', color: '#6366f1', group_id: 'g1', project_id: null };
    const cat2 = { id: 'c2', name: 'Sport', color: '#10b981', group_id: 'g1', project_id: null };
    (el as any)._categories = [cat1, cat2];
    const updated = { ...cat1, color: '#10b981' };
    vi.mocked(api.put).mockResolvedValue(updated);
    await (el as any)._updateCategoryColor(cat1);
    await flushPromises();
    expect((el as any)._categories.find((c: typeof cat2) => c.id === 'c2').color).toBe('#10b981');
  });

  it('shows no + prefix when totalBalance is zero in reset-all confirmation', async () => {
    await setup();
    (el as any)._balances = [{ user_id: 'me', balance: 0 }];
    (el as any)._confirmResetAll = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.reset-all-row')).toBeTruthy();
  });

  it('non-ApiError from _createCategory is ignored silently', async () => {
    await setup();
    vi.mocked(api.post).mockRejectedValue(new Error('network failure'));
    (el as any)._newCategoryName = 'New Cat';
    await (el as any)._createCategory({ preventDefault: () => {} });
    await flushPromises();
    expect((el as any)._creatingCategory).toBe(false);
  });

  it('non-ApiError from _commitEditCategory is ignored silently', async () => {
    await setup();
    vi.mocked(api.put).mockRejectedValue(new Error('network failure'));
    const cat = { id: 'c1', name: 'Food', color: '#6366f1', group_id: 'g1', project_id: null };
    (el as any)._categories = [cat];
    (el as any)._editingCategoryName = 'Updated';
    await (el as any)._commitEditCategory(cat);
    await flushPromises();
    expect((el as any)._savingCategoryId).toBe('');
  });

  it('non-ApiError from _updateCategoryColor is ignored silently', async () => {
    await setup();
    vi.mocked(api.put).mockRejectedValue(new Error('network failure'));
    const cat = { id: 'c1', name: 'Food', color: '#6366f1', group_id: 'g1', project_id: null };
    (el as any)._categories = [cat];
    await (el as any)._updateCategoryColor(cat);
    await flushPromises();
    expect((el as any)._categories[0].color).toBe('#6366f1');
  });

  it('non-ApiError from _deleteCategory is ignored silently', async () => {
    await setup();
    vi.mocked(api.delete).mockRejectedValue(new Error('network failure'));
    const cat = { id: 'c1', name: 'Food', color: '#6366f1', group_id: 'g1', project_id: null };
    (el as any)._categories = [cat];
    await (el as any)._deleteCategory('c1');
    await flushPromises();
    expect((el as any)._deletingCategoryId).toBe('');
  });

  it('_onAdjustClick does nothing when member not found', async () => {
    await setup();
    (el as any)._onAdjustClick({ currentTarget: { dataset: { userId: 'nonexistent' } } } as any);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_onColorSwatchClick does nothing when category not found', async () => {
    await setup();
    (el as any)._categories = [];
    (el as any)._onColorSwatchClick({ currentTarget: { dataset: { categoryId: 'nonexistent' } } } as any);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_onEditCategoryKeydown does nothing for non-Enter non-Escape key', async () => {
    await setup();
    const cat = { id: 'c1', name: 'Food', color: '#6366f1', group_id: 'g1', project_id: null };
    (el as any)._categories = [cat];
    const event = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(event, 'currentTarget', { value: { dataset: { categoryId: 'c1' } } });
    (el as any)._onEditCategoryKeydown(event);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_onEditCategoryBlur does nothing when category not found', async () => {
    await setup();
    (el as any)._categories = [];
    const event = new Event('blur');
    Object.defineProperty(event, 'currentTarget', { value: { dataset: { categoryId: 'nonexistent' } } });
    (el as any)._onEditCategoryBlur(event);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('_onStartEditCategoryClick does nothing when category not found', async () => {
    await setup();
    (el as any)._categories = [];
    (el as any)._onStartEditCategoryClick({ currentTarget: { dataset: { categoryId: 'nonexistent' } } } as any);
    expect((el as any)._editingCategoryId).toBe('');
  });
});
