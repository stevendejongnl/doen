import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Project, Task, TaskPriority } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from './doen-toast';
import { sharedStyles } from '../styles/shared-styles';

@customElement('doen-task-form')
export class DoenTaskForm extends LitElement {
  @property({ type: Object }) project!: Project;
  @state() private _title = '';
  @state() private _priority: TaskPriority = 'none';
  @state() private _dueDate = '';
  @state() private _notes = '';
  @state() private _showNotes = false;
  @state() private _submitting = false;

  static styles = [...sharedStyles, css`
    :host { display: block; }

    form { display: flex; flex-direction: column; gap: 10px; }

    .row { display: flex; gap: 8px; flex-wrap: wrap; }

    input, select, textarea {
      font: inherit;
      color: #e8eaf0;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px;
      padding: 10px 14px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      transition: border-color 120ms, background 120ms;
    }

    input:focus, select:focus, textarea:focus {
      border-color: #6366f1;
      background: rgba(255,255,255,0.1);
    }

    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
    select option { background: #1e2436; color: #e8eaf0; }

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
      color: rgba(232,234,240,0.4);
      font-size: 12px;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: color 120ms;
    }
    .btn-notes-toggle:hover { color: rgba(232,234,240,0.7); }
  `];

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
      });
      this._title = '';
      this._priority = 'none';
      this._dueDate = '';
      this._notes = '';
      this._showNotes = false;
      this.dispatchEvent(new CustomEvent<Task>('task-created', { detail: task, bubbles: true, composed: true }));
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
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-task-form': DoenTaskForm; }
}
