import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { PullToRefreshController } from '../utils/pull-to-refresh';
import type { Group, GroupMember, TaskOffer, HouseholdBalance, Category } from '../services/types';
import { api, ApiError, purgeOffers, resetBalances, adjustBalance } from '../services/api';
import { getMe, type Me } from '../services/auth';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import { inputValue } from '../utils/form';

const PROJECT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const OFFER_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  requested: 'Gevraagd',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  withdrawn: 'Ingetrokken',
  closed: 'Gesloten',
};

@customElement('page-group-settings')
export class PageGroupSettings extends LitElement {
  @property({ type: String }) groupId = '';

  @state() private _group: Group | null = null;
  @state() private _members: GroupMember[] = [];
  @state() private _me: Me | null = null;
  @state() private _offers: TaskOffer[] = [];
  @state() private _balances: HouseholdBalance[] = [];
  @state() private _categories: Category[] = [];
  @state() private _loading = true;
  @state() private _accessDenied = false;

  @state() private _selectedStatuses: Set<string> = new Set();
  @state() private _purging = false;
  @state() private _confirmPurge = false;

  @state() private _pointDeltas: Record<string, string> = {};
  @state() private _pointNotes: Record<string, string> = {};
  @state() private _adjustingUserId = '';
  @state() private _confirmResetUserId = '';
  @state() private _confirmResetAll = false;
  @state() private _resettingUserId = '';
  @state() private _resettingAll = false;

  @state() private _newCategoryName = '';
  @state() private _newCategoryColor = PROJECT_COLORS[0];
  @state() private _creatingCategory = false;
  @state() private _editingCategoryId = '';
  @state() private _editingCategoryName = '';
  @state() private _savingCategoryId = '';
  @state() private _confirmDeleteCategoryId = '';
  @state() private _deletingCategoryId = '';

  static styles = [...sharedStyles, css`
    :host { display: block; overflow-y: auto; height: 100%; position: relative; overscroll-behavior-y: contain; }

    h1 { font-size: 24px; font-weight: 800; color: var(--color-text); margin-bottom: 4px; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: var(--color-text-muted); margin-bottom: 24px; }

    .back-btn {
      display: inline-flex; align-items: center; gap: 7px;
      background: transparent; border: none; color: var(--color-text-muted);
      font-size: 13px; font-weight: 600; cursor: pointer; padding: 0;
      margin-bottom: 20px;
      transition: color var(--transition-fast);
    }
    .back-btn:hover { color: var(--color-text); }

    .card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: var(--radius-card);
      padding: 20px 22px;
      margin-bottom: 16px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .card-title {
      font-size: 15px; font-weight: 700; color: var(--color-text);
      margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
    }
    .card-title i { color: var(--color-accent); font-size: 14px; }

    .section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.7px; color: var(--color-text-muted); margin-bottom: 10px;
    }

    input, select {
      font: inherit; color: var(--color-text);
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: var(--radius-sm); padding: 9px 14px;
      outline: none; -webkit-appearance: none; appearance: none;
      transition: border-color var(--transition-fast), background var(--transition-fast);
    }
    input:focus, select:focus { border-color: var(--color-accent); background: rgba(255,255,255,0.1); }
    select option { background: var(--color-surface-solid); color: var(--color-text); }
    input[type="number"] { width: 80px; text-align: center; padding: 6px 10px; }
    input[type="text"].note-input { flex: 1; min-width: 100px; padding: 6px 10px; }

    .btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 9px 18px; border-radius: var(--radius-sm);
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background 120ms, opacity 120ms;
      white-space: nowrap; flex-shrink: 0; border: none;
    }
    .btn-primary { background: var(--color-accent); color: white; }
    .btn-primary:hover { background: var(--color-accent-hover); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-outline {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.14);
      color: var(--color-text-muted-strong);
    }
    .btn-outline:hover { background: rgba(255,255,255,0.1); color: var(--color-text); }
    .btn-outline:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-danger { background: rgba(239,68,68,0.18); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
    .btn-danger:hover { background: rgba(239,68,68,0.28); }
    .btn-danger:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-sm { padding: 5px 12px; font-size: 12px; }

    /* Status checkboxes */
    .status-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px;
      margin-bottom: 16px;
    }
    .status-check {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-radius: var(--radius-sm);
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      cursor: pointer; user-select: none;
      transition: background var(--transition-fast);
    }
    .status-check:hover { background: rgba(255,255,255,0.07); }
    .status-check.selected { border-color: var(--color-accent); background: rgba(99,102,241,0.12); }
    .status-check input[type="checkbox"] {
      width: 14px; height: 14px; padding: 0; margin: 0; cursor: pointer;
      accent-color: var(--color-accent);
    }
    .status-label { font-size: 13px; color: var(--color-text); flex: 1; }
    .status-count {
      font-size: 11px; color: var(--color-text-muted);
      background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 999px;
    }

    /* Balance rows */
    .balance-list { display: flex; flex-direction: column; gap: 8px; }
    .balance-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 14px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: var(--radius-sm);
    }
    .balance-name { font-size: 13px; font-weight: 600; color: var(--color-text); flex: 1; min-width: 80px; }
    .balance-chip {
      font-size: 13px; font-weight: 700;
      padding: 3px 10px; border-radius: 999px;
      background: rgba(99,102,241,0.18); color: #a5b4fc;
      flex-shrink: 0;
    }
    .balance-chip.negative { background: rgba(239,68,68,0.15); color: #f87171; }
    .adjust-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    /* Confirm inline */
    .confirm-inline {
      padding: 12px 14px; border-radius: var(--radius-sm);
      background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      margin-top: 8px;
    }
    .confirm-inline span { font-size: 13px; color: var(--color-text); flex: 1; min-width: 160px; }

    /* Reset all footer */
    .reset-all-row {
      margin-top: 16px; padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; justify-content: flex-end;
    }

    /* Category rows */
    .category-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
    .category-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: var(--radius-sm);
    }
    .color-swatch {
      width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;
      cursor: pointer; border: 2px solid transparent;
      transition: border-color var(--transition-fast), transform 80ms;
    }
    .color-swatch:hover { border-color: rgba(255,255,255,0.4); transform: scale(1.15); }
    .category-name-input {
      font-size: 13px; font-weight: 600; color: var(--color-text);
      background: rgba(255,255,255,0.07); border: 1px solid rgba(99,102,241,0.5);
      border-radius: var(--radius-sm); padding: 4px 10px; outline: none; flex: 1;
    }
    .category-name-input:focus { border-color: var(--color-accent); background: rgba(255,255,255,0.1); }
    .category-name { font-size: 13px; font-weight: 600; color: var(--color-text); flex: 1; }
    .category-scope {
      font-size: 11px; color: var(--color-text-muted);
      background: rgba(255,255,255,0.07); padding: 2px 7px; border-radius: 999px; flex-shrink: 0;
    }
    .icon-btn {
      background: transparent; border: none; color: var(--color-text-muted);
      width: 26px; height: 26px; border-radius: var(--radius-xs); cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 11px;
      transition: background var(--transition-fast), color var(--transition-fast);
    }
    .icon-btn:hover { background: rgba(255,255,255,0.08); color: var(--color-text); }
    .icon-btn.danger:hover { background: rgba(239,68,68,0.15); color: #f87171; }

    .new-category-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .new-category-form input[type="text"] { flex: 1; min-width: 120px; }

    .color-row { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
    .color-option {
      width: 18px; height: 18px; border-radius: 4px; cursor: pointer;
      border: 2px solid transparent; transition: border-color 80ms, transform 80ms;
    }
    .color-option:hover { border-color: rgba(255,255,255,0.5); transform: scale(1.15); }
    .color-option.active { border-color: white; }

    .empty-state {
      padding: 32px; text-align: center; color: var(--color-text-muted); font-size: 13px;
    }

    .sk {
      height: 80px; border-radius: var(--radius-card); margin-bottom: 16px;
      background: rgba(255,255,255,0.05);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
      background-size: 200% 100%;
    }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    @media (max-width: 600px) {
      .balance-row { flex-direction: column; align-items: flex-start; }
      .adjust-controls { width: 100%; }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private _ptr = new PullToRefreshController(this, () => this._load());

  reload() {
    this._load();
  }

  private _canManage(group: Group): boolean {
    if (!this._me) return false;
    if (group.owner_id === this._me.id) return true;
    const self = this._members.find(member => member.user_id === this._me!.id);
    return self?.role === 'admin';
  }

  private async _load() {
    this._loading = true;
    this._accessDenied = false;
    try {
      const [group, me] = await Promise.all([
        api.get<Group>(`/groups/${this.groupId}`),
        getMe(),
      ]);
      this._group = group;
      this._me = me;

      const [members, categories] = await Promise.all([
        api.get<GroupMember[]>(`/groups/${this.groupId}/members`),
        api.get<Category[]>('/categories'),
      ]);
      this._members = members;
      this._categories = categories.filter(category => category.group_id === this.groupId);

      if (!this._canManage(group)) {
        this._accessDenied = true;
        return;
      }

      if (group.type === 'household') {
        const [offers, balances] = await Promise.all([
          api.get<TaskOffer[]>(`/households/${this.groupId}/offers`),
          api.get<HouseholdBalance[]>(`/households/${this.groupId}/balances`),
        ]);
        this._offers = offers;
        this._balances = balances;
      }
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Laden mislukt: ${error.message}`);
    } finally {
      this._loading = false;
    }
  }

  private _goBack() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { page: 'groups' },
      bubbles: true,
      composed: true,
    }));
  }

  private _countByStatus(status: string): number {
    return this._offers.filter(offer => offer.status === status).length;
  }

  private _toggleStatus(status: string) {
    const next = new Set(this._selectedStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    this._selectedStatuses = next;
  }

  private _selectedCount(): number {
    return [...this._selectedStatuses].reduce((total, status) => total + this._countByStatus(status), 0);
  }

  private async _doPurgeOffers() {
    if (this._purging) return;
    this._purging = true;
    this._confirmPurge = false;
    try {
      const result = await purgeOffers(this.groupId, [...this._selectedStatuses]);
      this._offers = this._offers.filter(offer => !result.deleted_offer_ids.includes(offer.id));
      this._selectedStatuses = new Set();
      toast.success(`${result.deleted_offer_ids.length} aanbieding(en) verwijderd`);
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Verwijderen mislukt: ${error.message}`);
    } finally {
      this._purging = false;
    }
  }

  private async _doAdjust(member: GroupMember) {
    const rawDelta = this._pointDeltas[member.user_id] ?? '';
    const delta = parseInt(rawDelta, 10);
    if (isNaN(delta) || delta === 0) {
      toast.error('Voer een getal in dat niet nul is');
      return;
    }
    this._adjustingUserId = member.user_id;
    try {
      const note = this._pointNotes[member.user_id]?.trim() || null;
      await adjustBalance(this.groupId, member.user_id, delta, note);
      this._pointDeltas = { ...this._pointDeltas, [member.user_id]: '' };
      this._pointNotes = { ...this._pointNotes, [member.user_id]: '' };
      const balance = this._balances.find(balance => balance.user_id === member.user_id);
      if (balance) {
        this._balances = this._balances.map(balance =>
          balance.user_id === member.user_id
            ? { ...balance, balance: balance.balance + delta }
            : balance
        );
      }
      toast.success(`Saldo van ${member.name} bijgewerkt`);
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Aanpassen mislukt: ${error.message}`);
    } finally {
      this._adjustingUserId = '';
    }
  }

  private async _doResetOne(userId: string) {
    this._resettingUserId = userId;
    this._confirmResetUserId = '';
    try {
      await resetBalances(this.groupId, [userId]);
      this._balances = this._balances.map(balance =>
        balance.user_id === userId ? { ...balance, balance: 0 } : balance
      );
      const member = this._members.find(member => member.user_id === userId);
      toast.success(`Saldo van ${member?.name ?? 'lid'} gereset`);
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Reset mislukt: ${error.message}`);
    } finally {
      this._resettingUserId = '';
    }
  }

  private async _doResetAll() {
    this._resettingAll = true;
    this._confirmResetAll = false;
    try {
      await resetBalances(this.groupId, null);
      this._balances = this._balances.map(balance => ({ ...balance, balance: 0 }));
      toast.success('Alle saldi gereset naar nul');
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Reset mislukt: ${error.message}`);
    } finally {
      this._resettingAll = false;
    }
  }

  private _cycleColor(currentColor: string): string {
    const index = PROJECT_COLORS.indexOf(currentColor);
    return PROJECT_COLORS[(index + 1) % PROJECT_COLORS.length];
  }

  private async _createCategory(event: Event) {
    event.preventDefault();
    const name = this._newCategoryName.trim();
    if (!name || this._creatingCategory) return;
    this._creatingCategory = true;
    try {
      const created = await api.post<Category>('/categories', {
        name,
        color: this._newCategoryColor,
        group_id: this.groupId,
      });
      this._categories = [...this._categories, created];
      this._newCategoryName = '';
      toast.success(`Categorie "${created.name}" aangemaakt`);
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Aanmaken mislukt: ${error.message}`);
    } finally {
      this._creatingCategory = false;
    }
  }

  private _startEditCategory(category: Category) {
    this._editingCategoryId = category.id;
    this._editingCategoryName = category.name;
  }

  private _cancelEditCategory() {
    this._editingCategoryId = '';
    this._editingCategoryName = '';
  }

  private async _commitEditCategory(category: Category) {
    if (this._savingCategoryId) return;
    const name = this._editingCategoryName.trim();
    if (!name || name === category.name) {
      this._cancelEditCategory();
      return;
    }
    this._editingCategoryId = '';
    this._savingCategoryId = category.id;
    try {
      const updated = await api.put<Category>(`/categories/${category.id}`, { name, color: category.color });
      this._categories = this._categories.map(c => c.id === category.id ? updated : c);
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Hernoemen mislukt: ${error.message}`);
    } finally {
      this._savingCategoryId = '';
      this._editingCategoryName = '';
    }
  }

  private async _updateCategoryColor(category: Category) {
    const newColor = this._cycleColor(category.color);
    try {
      const updated = await api.put<Category>(`/categories/${category.id}`, { name: category.name, color: newColor });
      this._categories = this._categories.map(c => c.id === category.id ? updated : c);
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Kleur wijzigen mislukt: ${error.message}`);
    }
  }

  private async _deleteCategory(categoryId: string) {
    this._confirmDeleteCategoryId = '';
    this._deletingCategoryId = categoryId;
    try {
      await api.delete(`/categories/${categoryId}`);
      this._categories = this._categories.filter(category => category.id !== categoryId);
      toast.success('Categorie verwijderd');
    } catch (error) {
      if (error instanceof ApiError) toast.error(`Verwijderen mislukt: ${error.message}`);
    } finally {
      this._deletingCategoryId = '';
    }
  }

  // Offers handlers
  private _onStatusCheckboxClick = (e: Event) => {
    const status = (e.currentTarget as HTMLElement).dataset.status!;
    this._toggleStatus(status);
  };

  private _onConfirmPurge = () => { this._confirmPurge = true; };
  private _onCancelPurge = () => { this._confirmPurge = false; };
  private _onDoPurge = () => { void this._doPurgeOffers(); };

  // Points handlers
  private _onDeltaInput = (e: Event) => {
    const userId = (e.currentTarget as HTMLElement).dataset.userId!;
    this._pointDeltas = { ...this._pointDeltas, [userId]: inputValue(e) };
  };

  private _onNoteInput = (e: Event) => {
    const userId = (e.currentTarget as HTMLElement).dataset.userId!;
    this._pointNotes = { ...this._pointNotes, [userId]: inputValue(e) };
  };

  private _onAdjustClick = (e: Event) => {
    const userId = (e.currentTarget as HTMLElement).dataset.userId!;
    const member = this._members.find(m => m.user_id === userId);
    if (member) void this._doAdjust(member);
  };

  private _onConfirmResetOneClick = (e: Event) => {
    const userId = (e.currentTarget as HTMLElement).dataset.userId!;
    this._confirmResetUserId = userId;
  };

  private _onCancelResetOne = () => { this._confirmResetUserId = ''; };

  private _onDoResetOneClick = (e: Event) => {
    const userId = (e.currentTarget as HTMLElement).dataset.userId!;
    void this._doResetOne(userId);
  };

  private _onConfirmResetAll = () => { this._confirmResetAll = true; };
  private _onCancelResetAll = () => { this._confirmResetAll = false; };
  private _onDoResetAll = () => { void this._doResetAll(); };

  // Categories handlers
  private _onNewCategoryNameInput = (e: Event) => { this._newCategoryName = inputValue(e); };

  private _onNewCategoryColorClick = (e: Event) => {
    const color = (e.currentTarget as HTMLElement).dataset.color!;
    this._newCategoryColor = color;
  };

  private _onColorSwatchClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.categoryId!;
    const category = this._categories.find(c => c.id === id);
    if (category) void this._updateCategoryColor(category);
  };

  private _onEditCategoryNameInput = (e: Event) => { this._editingCategoryName = inputValue(e); };

  private _onEditCategoryKeydown = (e: KeyboardEvent) => {
    const id = (e.currentTarget as HTMLElement).dataset.categoryId!;
    const category = this._categories.find(c => c.id === id);
    if (!category) return;
    if (e.key === 'Enter') { e.preventDefault(); void this._commitEditCategory(category); }
    else if (e.key === 'Escape') { e.preventDefault(); this._cancelEditCategory(); }
  };

  private _onEditCategoryBlur = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.categoryId!;
    const category = this._categories.find(c => c.id === id);
    if (category) void this._commitEditCategory(category);
  };

  private _onStartEditCategoryClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.categoryId!;
    const category = this._categories.find(c => c.id === id);
    if (category) this._startEditCategory(category);
  };

  private _onConfirmDeleteCategoryClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.categoryId!;
    this._confirmDeleteCategoryId = id;
  };

  private _onCancelDeleteCategory = () => { this._confirmDeleteCategoryId = ''; };

  private _onDeleteCategoryClick = (e: Event) => {
    const id = (e.currentTarget as HTMLElement).dataset.categoryId!;
    void this._deleteCategory(id);
  };

  private _renderOffersCard() {
    const allStatuses = ['open', 'requested', 'approved', 'rejected', 'withdrawn', 'closed'];
    const selectedCount = this._selectedCount();
    const selectedStatuses = [...this._selectedStatuses].join(', ');

    return html`
      <div class="card">
        <div class="card-title">
          <i class="fa-solid fa-tag"></i>
          Aanbiedingen opschonen
        </div>

        <div class="section-label">Selecteer statussen om te verwijderen</div>
        <div class="status-grid">
          ${allStatuses.map(status => {
            const count = this._countByStatus(status);
            const selected = this._selectedStatuses.has(status);
            return html`
              <label class="status-check ${selected ? 'selected' : ''}">
                <input type="checkbox"
                  .checked=${selected}
                  data-status=${status}
                  @click=${this._onStatusCheckboxClick}
                />
                <span class="status-label">${OFFER_STATUS_LABELS[status]}</span>
                <span class="status-count">${count}</span>
              </label>
            `;
          })}
        </div>

        ${this._confirmPurge ? html`
          <div class="confirm-inline">
            <span>
              Verwijder ${selectedCount} aanbieding(en) met status: ${selectedStatuses}?
              Punt-transacties blijven bewaard.
            </span>
            <button class="btn btn-danger btn-sm"
              ?disabled=${this._purging}
              @click=${this._onDoPurge}>
              <i class="fa-solid fa-${this._purging ? 'spinner fa-spin' : 'trash'}"></i>
              Bevestigen
            </button>
            <button class="btn btn-outline btn-sm" @click=${this._onCancelPurge}>
              Annuleren
            </button>
          </div>
        ` : html`
          <button class="btn btn-danger"
            ?disabled=${selectedCount === 0 || this._purging}
            @click=${this._onConfirmPurge}>
            <i class="fa-solid fa-trash"></i>
            Verwijder ${selectedCount > 0 ? selectedCount : ''} aanbieding(en)
          </button>
        `}
      </div>
    `;
  }

  private _renderPointsCard() {
    const totalBalance = this._balances.reduce((sum, balance) => sum + balance.balance, 0);

    return html`
      <div class="card">
        <div class="card-title">
          <i class="fa-solid fa-star"></i>
          Punten corrigeren
        </div>

        <div class="balance-list">
          ${this._balances.map(balance => {
            const member = this._members.find(m => m.user_id === balance.user_id);
            if (!member) return '';
            const isAdjusting = this._adjustingUserId === member.user_id;
            const isResetting = this._resettingUserId === member.user_id;
            const delta = this._pointDeltas[member.user_id] ?? '';
            const note = this._pointNotes[member.user_id] ?? '';

            return html`
              <div class="balance-row">
                <span class="balance-name">${member.name}</span>
                <span class="balance-chip ${balance.balance < 0 ? 'negative' : ''}">
                  ${balance.balance >= 0 ? '+' : ''}${balance.balance} pt
                </span>
                <div class="adjust-controls">
                  <input type="number" placeholder="Δ"
                    .value=${delta}
                    data-user-id=${member.user_id}
                    @input=${this._onDeltaInput}
                  />
                  <input type="text" class="note-input" placeholder="Reden (optioneel)"
                    .value=${note}
                    data-user-id=${member.user_id}
                    @input=${this._onNoteInput}
                  />
                  <button class="btn btn-outline btn-sm"
                    ?disabled=${!delta || isAdjusting}
                    data-user-id=${member.user_id}
                    @click=${this._onAdjustClick}>
                    <i class="fa-solid fa-${isAdjusting ? 'spinner fa-spin' : 'check'}"></i>
                    Toepassen
                  </button>
                  ${this._confirmResetUserId === member.user_id ? html`
                    <button class="btn btn-danger btn-sm"
                      ?disabled=${isResetting}
                      data-user-id=${member.user_id}
                      @click=${this._onDoResetOneClick}>
                      <i class="fa-solid fa-${isResetting ? 'spinner fa-spin' : 'rotate-left'}"></i>
                      Bevestigen
                    </button>
                    <button class="btn btn-outline btn-sm"
                      @click=${this._onCancelResetOne}>
                      Annuleren
                    </button>
                  ` : html`
                    <button class="btn btn-outline btn-sm"
                      ?disabled=${isResetting}
                      title="Reset naar 0"
                      data-user-id=${member.user_id}
                      @click=${this._onConfirmResetOneClick}>
                      <i class="fa-solid fa-rotate-left"></i>
                    </button>
                  `}
                </div>
              </div>
            `;
          })}
          ${this._balances.length === 0 ? html`
            <div class="empty-state">Geen leden met punten gevonden.</div>
          ` : ''}
        </div>

        ${this._balances.length > 0 ? html`
          <div class="reset-all-row">
            ${this._confirmResetAll ? html`
              <div class="confirm-inline">
                <span>
                  Reset saldi naar nul voor alle ${this._balances.length} leden
                  (totaal ${totalBalance > 0 ? '+' : ''}${totalBalance} pt)?
                </span>
                <button class="btn btn-danger btn-sm"
                  ?disabled=${this._resettingAll}
                  @click=${this._onDoResetAll}>
                  <i class="fa-solid fa-${this._resettingAll ? 'spinner fa-spin' : 'rotate-left'}"></i>
                  Bevestigen
                </button>
                <button class="btn btn-outline btn-sm" @click=${this._onCancelResetAll}>
                  Annuleren
                </button>
              </div>
            ` : html`
              <button class="btn btn-danger"
                ?disabled=${this._resettingAll}
                @click=${this._onConfirmResetAll}>
                <i class="fa-solid fa-rotate-left"></i>
                Reset alle saldi naar nul
              </button>
            `}
          </div>
        ` : ''}
      </div>
    `;
  }

  private _renderCategoriesCard() {
    return html`
      <div class="card">
        <div class="card-title">
          <i class="fa-solid fa-folder"></i>
          Categorieën
        </div>

        <div class="section-label">Nieuwe categorie</div>
        <form class="new-category-form" @submit=${this._createCategory}>
          <input type="text" placeholder="Naam"
            .value=${this._newCategoryName}
            @input=${this._onNewCategoryNameInput}
          />
          <div class="color-row">
            ${PROJECT_COLORS.map(color => html`
              <div class="color-option ${this._newCategoryColor === color ? 'active' : ''}"
                style="background:${color}"
                data-color=${color}
                @click=${this._onNewCategoryColorClick}
                title="${color}"
              ></div>
            `)}
          </div>
          <button type="submit" class="btn btn-primary btn-sm"
            ?disabled=${this._creatingCategory || !this._newCategoryName.trim()}>
            <i class="fa-solid fa-${this._creatingCategory ? 'spinner fa-spin' : 'plus'}"></i>
            Aanmaken
          </button>
        </form>

        ${this._categories.length > 0 ? html`
          <div class="section-label" style="margin-top:16px">Bestaande categorieën</div>
          <div class="category-list">
            ${this._categories.map(category => {
              const isEditing = this._editingCategoryId === category.id;
              const isSaving = this._savingCategoryId === category.id;
              const isDeleting = this._deletingCategoryId === category.id;
              const confirmingDelete = this._confirmDeleteCategoryId === category.id;

              return html`
                <div class="category-row">
                  <div class="color-swatch"
                    style="background:${category.color}"
                    title="Klik om kleur te wijzigen"
                    data-category-id=${category.id}
                    @click=${this._onColorSwatchClick}
                  ></div>
                  ${isEditing ? html`
                    <input class="category-name-input" type="text"
                      .value=${this._editingCategoryName}
                      data-category-id=${category.id}
                      @input=${this._onEditCategoryNameInput}
                      @keydown=${this._onEditCategoryKeydown}
                      @blur=${this._onEditCategoryBlur}
                      autofocus
                    />
                  ` : html`
                    <span class="category-name">${category.name}</span>
                  `}
                  ${category.project_id ? html`<span class="category-scope">Project</span>` : ''}
                  ${!isEditing ? html`
                    <button class="icon-btn" title="Naam wijzigen"
                      ?disabled=${isSaving}
                      data-category-id=${category.id}
                      @click=${this._onStartEditCategoryClick}>
                      <i class="fa-solid fa-pen"></i>
                    </button>
                  ` : ''}
                  ${confirmingDelete ? html`
                    <button class="btn btn-danger btn-sm"
                      ?disabled=${isDeleting}
                      data-category-id=${category.id}
                      @click=${this._onDeleteCategoryClick}>
                      <i class="fa-solid fa-${isDeleting ? 'spinner fa-spin' : 'check'}"></i>
                      Bevestigen
                    </button>
                    <button class="btn btn-outline btn-sm"
                      @click=${this._onCancelDeleteCategory}>
                      Annuleren
                    </button>
                  ` : html`
                    <button class="icon-btn danger" title="Verwijderen"
                      ?disabled=${isDeleting}
                      data-category-id=${category.id}
                      @click=${this._onConfirmDeleteCategoryClick}>
                      <i class="fa-solid fa-${isDeleting ? 'spinner fa-spin' : 'trash'}"></i>
                    </button>
                  `}
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;
  }

  render() {
    if (this._loading) {
      return this._ptr.wrap(html`
        <button class="back-btn" @click=${this._goBack}>
          <i class="fa-solid fa-arrow-left"></i> Terug
        </button>
        <div class="sk"></div>
        <div class="sk"></div>
        <div class="sk"></div>
      `);
    }

    if (this._accessDenied || !this._group) {
      return this._ptr.wrap(html`
        <button class="back-btn" @click=${this._goBack}>
          <i class="fa-solid fa-arrow-left"></i> Terug
        </button>
        <div class="empty-state">Alleen beheerders hebben toegang tot groepsbeheer.</div>
      `);
    }

    const group = this._group;

    return this._ptr.wrap(html`
      <button class="back-btn" @click=${this._goBack}>
        <i class="fa-solid fa-arrow-left"></i> Groepen
      </button>

      <h1>${group.name}</h1>
      <p class="subtitle">Groepsbeheer — alleen zichtbaar voor beheerders</p>

      ${group.type === 'household' ? this._renderOffersCard() : ''}
      ${group.type === 'household' ? this._renderPointsCard() : ''}
      ${this._renderCategoriesCard()}
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-group-settings': PageGroupSettings; }
}
