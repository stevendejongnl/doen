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
import './ui/doen-prompt-dialog';
import type { DoenPromptDialog } from './ui/doen-prompt-dialog';

const DAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

function normalizeTime24(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function weekdaysToCsv(s: Set<number>): string | null {
  if (s.size === 0) return null;
  return [...s].sort((a, b) => a - b).join(',');
}

function describeDraft(
  unit: RecurrenceUnit,
  interval: number,
  weekdays: Set<number>,
  monthDay: number,
  timeOfDay: string,
  parity: RecurrenceParity,
): string {
  let base = '';
  if (unit === 'day') {
    base = interval > 1 ? `Elke ${interval} dagen` : 'Dagelijks';
  } else if (unit === 'week') {
    const days = [...weekdays].sort((a, b) => a - b).map(n => DAY_LABELS[n]).join(', ');
    const prefix = interval > 1 ? `Elke ${interval} weken` : 'Wekelijks';
    base = days ? `${prefix} op ${days}` : prefix;
  } else {
    base = interval > 1 ? `Elke ${interval} maanden op dag ${monthDay}` : `Maandelijks op dag ${monthDay}`;
  }
  let suffix = '';
  if (parity === 'odd') suffix = unit === 'week' ? ' · oneven weken' : ' · oneven';
  if (parity === 'even') suffix = unit === 'week' ? ' · even weken' : ' · even';
  return `${base}${suffix} · ${timeOfDay}`;
}

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

    input, select, textarea {
      font: inherit;
      color: var(--color-text);
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: var(--radius-btn);
      padding: 10px 14px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      transition: border-color var(--transition-fast), background var(--transition-fast);
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--color-accent);
      background: rgba(255,255,255,0.1);
    }

    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
    select option { background: var(--color-surface-solid); color: var(--color-text); }

    textarea {
      width: 100%;
      min-height: 72px;
      resize: vertical;
      box-sizing: border-box;
      font-size: 13px;
      line-height: 1.5;
    }

    .btn-add {
      background: var(--color-accent);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background var(--transition-fast), transform var(--transition-fast);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
    }

    .btn-add:hover:not(:disabled) { background: var(--color-accent-hover); }
    .btn-add:active:not(:disabled) { transform: scale(0.97); }
    .btn-add:disabled { opacity: 0.45; cursor: not-allowed; }

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
    .rb-row select, .rb-row input {
      font-size: 12px; padding: 5px 8px; border-radius: var(--radius-xs);
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

  private _onCategoryChange(value: string) {
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
            project_id: this.project.id,
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
    const next = new Set(this._weekdays);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    this._weekdays = next;
  }

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
          <input
            type="text"
            placeholder="Nieuwe taak toevoegen..."
            .value=${this._title}
            @input=${(e: Event) => this._title = (e.target as HTMLInputElement).value}
            ?disabled=${this._submitting}
          />
          <button class="btn-add" type="submit" ?disabled=${this._submitting || !this._title.trim()}>
            <i class="fa-solid fa-${this._submitting ? 'spinner fa-spin' : 'plus'}"></i>
            ${this._submitting ? 'Bezig...' : 'Toevoegen'}
          </button>
        </div>
        <div class="row">
          <select .value=${this._priority}
            @change=${(e: Event) => this._priority = (e.target as HTMLSelectElement).value as TaskPriority}>
            <option value="none">Geen prioriteit</option>
            <option value="low">Laag</option>
            <option value="medium">Middel</option>
            <option value="high">Hoog</option>
          </select>
          <input
            type="date"
            .value=${this._dueDate}
            @input=${(e: Event) => this._dueDate = (e.target as HTMLInputElement).value}
          />
          ${this._members.length > 1 ? html`
            <select .value=${this._assigneeId}
              @change=${(e: Event) => this._assigneeId = (e.target as HTMLSelectElement).value}>
              <option value="">Niemand toegewezen</option>
              ${this._members.map(m => html`
                <option value=${m.user_id}>${m.name}</option>
              `)}
            </select>
          ` : ''}
          <select .value=${this._categoryId}
            @change=${(e: Event) => this._onCategoryChange((e.target as HTMLSelectElement).value)}>
            <option value="">Geen categorie</option>
            ${this._categories.map(c => html`
              <option value=${c.id}>${c.name}</option>
            `)}
            <option value="__new__">+ Nieuwe categorie…</option>
          </select>
          <button type="button" class="btn-notes-toggle" @click=${() => this._showNotes = !this._showNotes}>
            <i class="fa-solid fa-${this._showNotes ? 'chevron-up' : 'plus'}"></i>
            ${this._showNotes ? 'Notitie verbergen' : 'Notitie toevoegen'}
          </button>
        </div>
        ${this._showNotes ? html`
          <textarea
            placeholder="Notities, context, links..."
            .value=${this._notes}
            @input=${(e: Event) => this._notes = (e.target as HTMLTextAreaElement).value}
            ?disabled=${this._submitting}
          ></textarea>
        ` : ''}
        <div class="row">
          <label class="recurring-toggle">
            <span class="toggle">
              <input type="checkbox"
                .checked=${this._recurring}
                @change=${(e: Event) => this._recurring = (e.target as HTMLInputElement).checked}
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
                @input=${(e: Event) => this._interval = Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 1)}
              />
              <select .value=${this._unit}
                @change=${(e: Event) => this._unit = (e.target as HTMLSelectElement).value as RecurrenceUnit}>
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
                      @click=${() => this._toggleWeekday(i)}>${label}</span>
                  `)}
                </div>
              </div>
            ` : ''}
            ${this._unit === 'month' ? html`
              <div class="rb-row">
                <span>Dag van de maand:</span>
                <input type="number" min="1" max="31"
                  .value=${String(this._monthDay)}
                  @input=${(e: Event) => this._monthDay = Math.max(1, Math.min(31, parseInt((e.target as HTMLInputElement).value, 10) || 1))}
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
                @input=${(e: Event) => {
                  const t = e.target as HTMLInputElement;
                  const next = normalizeTime24(t.value);
                  this._timeOfDay = next;
                  t.value = next;
                }}
                @blur=${(e: Event) => {
                  const t = e.target as HTMLInputElement;
                  if (!/^[0-2][0-9]:[0-5][0-9]$/.test(t.value)) this._timeOfDay = '08:00';
                }}
              />
              <span style="margin-left:8px">Alleen</span>
              <select .value=${this._parity}
                @change=${(e: Event) => this._parity = (e.target as HTMLSelectElement).value as RecurrenceParity}>
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
