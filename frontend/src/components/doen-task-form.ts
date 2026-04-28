import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  Category,
  GroupMember,
  Project,
  Task,
  TaskPriority,
  RecurrenceUnit,
  RecurrenceParity,
  RecurringRule,
} from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from './doen-toast';
import { sharedStyles } from '../styles/shared-styles';
import './ui/doen-input';
import './ui/doen-select';
import type { SelectOption } from './ui/doen-select';
import './ui/doen-textarea';
import './ui/doen-button';
import './ui/doen-prompt-dialog';
import type { DoenPromptDialog } from './ui/doen-prompt-dialog';
import {
  toggleWeekday, weekdaysToCsv, describeDraft,
  DAY_LABELS,
} from '../utils/recurrence';
import {
  checkboxChecked, selectValue, clampedInt,
  normalizeTime24, isValidTime24, customInputValue,
} from '../utils/form';

@customElement('doen-task-form')
export class DoenTaskForm extends LitElement {
  @property({ type: Object }) project!: Project;
  @state() private _title = '';
  @state() private _priority: TaskPriority = 'none';
  @state() private _dueDate = '';
  @state() private _notes = '';
  @state() private _showNotes = false;
  @state() private _submitting = false;
  @state() private _assigneeId = '';
  @state() private _members: GroupMember[] = [];
  @state() private _categoryId = '';
  @state() private _categories: Category[] = [];

  private _loadedForGroup: string | null = null;
  private _loadedCategoriesFor: string | null = null;

  @state() private _recurring = false;
  @state() private _unit: RecurrenceUnit = 'week';
  @state() private _interval = 1;
  @state() private _weekdays: Set<number> = new Set([0]);
  @state() private _monthDay = 1;
  @state() private _timeOfDay = '08:00';
  @state() private _parity: RecurrenceParity = 'any';

  static styles = [...sharedStyles, css`
    :host { display: block; }

    form { display: flex; flex-direction: column; gap: 10px; }

    .row { display: flex; gap: 8px; flex-wrap: wrap; }

    .recurrence-builder input,
    .recurrence-builder select {
      font: inherit;
      color: var(--color-text);
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: var(--radius-xs);
      padding: 5px 8px;
      font-size: 12px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      transition: border-color var(--transition-fast), background var(--transition-fast);
      box-sizing: border-box;
    }

    .recurrence-builder input:focus-visible,
    .recurrence-builder select:focus-visible {
      border-color: var(--color-accent);
      background: rgba(255,255,255,0.1);
    }

    .recurrence-builder select option {
      background: var(--color-surface-solid);
      color: var(--color-text);
    }

    .btn-notes-toggle {
      background: none;
      border: none;
      color: var(--color-text-muted);
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: color var(--transition-fast);
    }
    .btn-notes-toggle:hover { color: var(--color-text-muted-strong); }

    /* Recurring toggle + builder (mirrors doen-task.ts edit form) */
    .recurring-toggle {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: var(--color-text-muted);
      cursor: pointer; user-select: none;
      min-height: 44px;
    }
    .recurring-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .toggle {
      position: relative; width: 32px; height: 18px; flex-shrink: 0;
    }
    .toggle-track {
      position: absolute; inset: 0;
      background: rgba(255,255,255,0.12);
      border-radius: 9px; transition: background 150ms; cursor: pointer;
    }
    .recurring-toggle input:checked ~ .toggle-track { background: var(--color-accent); }
    .toggle-thumb {
      position: absolute; top: 3px; left: 3px;
      width: 12px; height: 12px; background: white; border-radius: 50%;
      transition: transform 150ms; pointer-events: none;
    }
    .recurring-toggle input:checked ~ .toggle-thumb { transform: translateX(14px); }

    .recurrence-builder {
      width: 100%;
      display: flex; flex-direction: column; gap: 10px;
      padding: 10px 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
    }
    .rb-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      font-size: 12px; color: var(--color-text-muted-strong);
    }
    .rb-row input[type="number"] { width: 56px; }
    .rb-row input[type="time"] { width: 90px; }

    .weekday-picker { display: flex; gap: 4px; flex-wrap: wrap; }
    .weekday-chip {
      padding: 10px 12px;
      min-height: 36px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.14);
      color: var(--color-text-muted-strong);
      cursor: pointer; user-select: none;
      transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
    }
    .weekday-chip.active {
      background: rgba(99,102,241,0.28);
      border-color: var(--color-accent);
      color: var(--color-text);
    }
    .weekday-chip:hover { border-color: rgba(255,255,255,0.28); }

    .rb-preview {
      font-size: 11px; color: var(--color-text-muted-strong);
      font-style: italic;
    }
  `];

  private _onCategoriesChanged = () => {
    this._loadedCategoriesFor = null;
    void this._maybeLoadCategories();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('doen:categories-changed', this._onCategoriesChanged);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('doen:categories-changed', this._onCategoriesChanged);
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('project')) {
      this._maybeLoadMembers();
      this._maybeLoadCategories();
    }
  }

  private async _maybeLoadMembers() {
    const groupId = this.project?.group_id ?? null;
    if (!groupId) { this._members = []; this._loadedForGroup = null; return; }
    if (this._loadedForGroup === groupId) return;
    this._loadedForGroup = groupId;
    try {
      this._members = await api.get<GroupMember[]>(`/groups/${groupId}/members`);
    } catch {
      this._members = [];
    }
  }

  private async _maybeLoadCategories() {
    const projectId = this.project?.id ?? null;
    if (!projectId) return;
    if (this._loadedCategoriesFor === projectId) return;
    this._loadedCategoriesFor = projectId;
    try {
      const all = await api.get<Category[]>('/categories');
      // Relevant = project-scoped to this project, group-scoped to this project's group, or unscoped.
      const gid = this.project.group_id ?? null;
      this._categories = all.filter(c =>
        (c.project_id === projectId) ||
        (c.project_id == null && c.group_id === gid) ||
        (c.project_id == null && c.group_id == null)
      );
    } catch {
      this._categories = [];
    }
  }

  private _onCategoryChange_impl(value: string) {
    if (value === '__new__') {
      const dialog = document.createElement('doen-prompt-dialog') as DoenPromptDialog;
      dialog.message = 'Naam van de categorie?';
      dialog.addEventListener('doen-submit', async (e: Event) => {
        const name = (e as CustomEvent<string>).detail;
        dialog.remove();
        try {
          const created = await api.post<Category>('/categories', {
            name: name,
            color: '#a855f7',
            ...(this.project.group_id ? { group_id: this.project.group_id } : {}),
          });
          this._categories = [...this._categories, created];
          this._categoryId = created.id;
        } catch (err) {
          if (err instanceof ApiError) toast.error(`Aanmaken mislukt: ${err.message}`);
          this._categoryId = '';
        }
      }, { once: true });
      dialog.addEventListener('doen-cancel', () => {
        dialog.remove();
        this._categoryId = '';
      }, { once: true });
      document.body.appendChild(dialog);
    } else {
      this._categoryId = value;
    }
  }

  private _toggleWeekday(n: number) {
    this._weekdays = toggleWeekday(this._weekdays, n);
  }

  private _onPriorityChange = (e: CustomEvent<{ value: string }>) => {
    this._priority = (e as CustomEvent<{ value: string }>).detail.value as TaskPriority;
  };
  private _onDueDateChange = (e: Event) => { this._dueDate = customInputValue(e); };
  private _onAssigneeChange = (e: Event) => { this._assigneeId = customInputValue(e); };
  private _onNotesInput = (e: Event) => { this._notes = customInputValue(e); };
  private _onRecurringChange = (e: Event) => { this._recurring = checkboxChecked(e); };
  private _onIntervalInput = (e: Event) => { this._interval = clampedInt(e, 1, 365); };
  private _onUnitChange = (e: Event) => { this._unit = selectValue(e) as RecurrenceUnit; };
  private _onMonthDayInput = (e: Event) => { this._monthDay = clampedInt(e, 1, 31); };
  private _onParityChange = (e: Event) => { this._parity = selectValue(e) as RecurrenceParity; };
  private _onToggleNotes = () => { this._showNotes = !this._showNotes; };

  private _onWeekdayChipClick = (e: Event) => {
    const n = Number((e.currentTarget as HTMLElement).dataset.weekday);
    this._toggleWeekday(n);
  };

  private _onTitleInput = (e: Event) => { this._title = customInputValue(e); };

  private _onTimeInput = (e: Event) => {
    const t = e.target as HTMLInputElement;
    const next = normalizeTime24(t.value);
    this._timeOfDay = next;
    t.value = next;
  };

  private _onTimeBlur = (e: Event) => {
    const t = e.target as HTMLInputElement;
    if (!isValidTime24(t.value)) this._timeOfDay = '08:00';
  };

  private _onCategoryChange = (e: Event) => {
    this._onCategoryChange_impl(customInputValue(e));
  };

  private async _submit(e: Event) {
    e.preventDefault();
    if (!this._title.trim() || this._submitting) return;
    this._submitting = true;
    try {
      const task = await api.post<Task>(`/projects/${this.project.id}/tasks`, {
        title: this._title.trim(),
        priority: this._priority,
        due_date: this._dueDate || undefined,
        notes: this._notes.trim() || undefined,
        assignee_id: this._assigneeId || undefined,
        category_id: this._categoryId || undefined,
      });

      let finalTask = task;
      if (this._recurring) {
        await api.post<RecurringRule>(`/tasks/${task.id}/recurring`, {
          unit: this._unit,
          interval: Math.max(1, this._interval),
          weekdays: this._unit === 'week' ? weekdaysToCsv(this._weekdays) : null,
          month_day: this._unit === 'month' ? this._monthDay : null,
          time_of_day: this._timeOfDay,
          parity: this._parity,
          notify_on_spawn: false,
        });
        finalTask = await api.get<Task>(`/tasks/${task.id}`);
      }

      this._title = '';
      this._priority = 'none';
      this._dueDate = '';
      this._notes = '';
      this._showNotes = false;
      this._assigneeId = '';
      this._categoryId = '';
      this._recurring = false;
      this._unit = 'week';
      this._interval = 1;
      this._weekdays = new Set([0]);
      this._monthDay = 1;
      this._timeOfDay = '08:00';
      this._parity = 'any';
      this.dispatchEvent(new CustomEvent<Task>('task-created', { detail: finalTask, bubbles: true, composed: true }));
      toast.success('Taak aangemaakt!');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Aanmaken mislukt: ${e.message}`);
    } finally {
      this._submitting = false;
    }
  }

  render() {
    return html`
      <form @submit=${this._submit}>
        <div class="row">
          <doen-input
            aria-label="Nieuwe taak toevoegen"
            placeholder="Nieuwe taak toevoegen..."
            style="flex:1"
            .value=${this._title}
            @doen-input=${this._onTitleInput}
            ?disabled=${this._submitting}
          ></doen-input>
          <doen-button
            variant="primary"
            ?disabled=${this._submitting || !this._title.trim()}
            ?loading=${this._submitting}
            @click=${this._submit}
          >
            ${this._submitting ? '' : html`<i class="fa-solid fa-plus"></i>`}
            ${this._submitting ? 'Bezig...' : 'Toevoegen'}
          </doen-button>
        </div>
        <div class="row">
          <doen-select
            aria-label="Prioriteit"
            .value=${this._priority}
            .options=${[
              { value: 'none', label: 'Geen prioriteit' } as SelectOption,
              { value: 'low', label: 'Laag' },
              { value: 'medium', label: 'Middel' },
              { value: 'high', label: 'Hoog' },
            ]}
            @doen-change=${this._onPriorityChange}
          ></doen-select>
          <doen-input
            type="date"
            aria-label="Deadline"
            .value=${this._dueDate}
            @doen-change=${this._onDueDateChange}
          ></doen-input>
          ${this._members.length > 1 ? html`
            <doen-select
              aria-label="Toegewezen aan"
              .value=${this._assigneeId}
              .options=${[
                { value: '', label: 'Niemand toegewezen' } as SelectOption,
                ...this._members.map((member): SelectOption => ({ value: member.user_id, label: member.name })),
              ]}
              @doen-change=${this._onAssigneeChange}
            ></doen-select>
          ` : ''}
          <doen-select
            aria-label="Categorie"
            .value=${this._categoryId}
            .options=${[
              { value: '', label: 'Geen categorie' } as SelectOption,
              ...this._categories.map((category): SelectOption => ({ value: category.id, label: category.name })),
              { value: '__new__', label: '+ Nieuwe categorie…' },
            ]}
            @doen-change=${this._onCategoryChange}
          ></doen-select>
          <button type="button" class="btn-notes-toggle" @click=${this._onToggleNotes}>
            <i class="fa-solid fa-${this._showNotes ? 'chevron-up' : 'plus'}"></i>
            ${this._showNotes ? 'Notitie verbergen' : 'Notitie toevoegen'}
          </button>
        </div>
        ${this._showNotes ? html`
          <doen-textarea
            placeholder="Notities, context, links..."
            aria-label="Notities"
            .value=${this._notes}
            @doen-input=${this._onNotesInput}
            ?disabled=${this._submitting}
          ></doen-textarea>
        ` : ''}
        <div class="row">
          <label class="recurring-toggle">
            <span class="toggle">
              <input type="checkbox"
                .checked=${this._recurring}
                @change=${this._onRecurringChange}
              />
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </span>
            <i class="fa-solid fa-repeat" style="font-size:11px;opacity:0.6"></i>
            Herhalen
          </label>
        </div>
        ${this._recurring ? html`
          <div class="recurrence-builder">
            <div class="rb-row">
              <span>Elke</span>
              <input type="number" min="1" max="365"
                .value=${String(this._interval)}
                @input=${this._onIntervalInput}
              />
              <select .value=${this._unit} @change=${this._onUnitChange}>
                <option value="day">dag(en)</option>
                <option value="week">we(e)k(en)</option>
                <option value="month">maand(en)</option>
              </select>
            </div>
            ${this._unit === 'week' ? html`
              <div class="rb-row">
                <span>Op:</span>
                <div class="weekday-picker">
                  ${DAY_LABELS.map((label, i) => html`
                    <span class="weekday-chip ${this._weekdays.has(i) ? 'active' : ''}"
                      data-weekday=${i}
                      @click=${this._onWeekdayChipClick}>${label}</span>
                  `)}
                </div>
              </div>
            ` : ''}
            ${this._unit === 'month' ? html`
              <div class="rb-row">
                <span>Dag van de maand:</span>
                <input type="number" min="1" max="31"
                  .value=${String(this._monthDay)}
                  @input=${this._onMonthDayInput}
                />
              </div>
            ` : ''}
            <div class="rb-row">
              <span>Om:</span>
              <input type="text"
                inputmode="numeric"
                pattern="[0-2][0-9]:[0-5][0-9]"
                maxlength="5"
                placeholder="08:00"
                aria-label="Tijd in 24-uurs notatie"
                .value=${this._timeOfDay}
                @input=${this._onTimeInput}
                @blur=${this._onTimeBlur}
              />
              <span style="margin-left:8px">Alleen</span>
              <select .value=${this._parity} @change=${this._onParityChange}>
                <option value="any">alle</option>
                <option value="odd">oneven</option>
                <option value="even">even</option>
              </select>
              <span>${this._unit === 'week' ? 'weken' : this._unit === 'month' ? 'maanden' : 'dagen'}</span>
            </div>
            <div class="rb-preview">
              ${describeDraft(this._unit, this._interval, this._weekdays, this._monthDay, this._timeOfDay, this._parity)}
            </div>
          </div>
        ` : ''}
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-task-form': DoenTaskForm; }
}
