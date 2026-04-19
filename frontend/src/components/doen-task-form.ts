import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Project, Task, TaskPriority } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from './doen-toast';

@customElement('doen-task-form')
export class DoenTaskForm extends LitElement {
  @property({ type: Object }) project!: Project;
  @state() private _title = '';
  @state() private _priority: TaskPriority = 'none';
  @state() private _dueDate = '';
  @state() private _submitting = false;

  static styles = css`
    :host { display: block; }

    form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .row {
      display: flex;
      gap: 8px;
    }

    input[type="text"] {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 9px 14px;
      color: #e8eaf0;
      font-size: 13px;
      outline: none;
      transition: border-color 120ms ease-out;
    }

    input[type="text"]:focus {
      border-color: #6366f1;
    }

    input[type="date"] {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 9px 12px;
      color: #e8eaf0;
      font-size: 12px;
      outline: none;
    }

    select {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 9px 12px;
      color: #e8eaf0;
      font-size: 12px;
      outline: none;
    }

    .btn-add {
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease-out, transform 120ms ease-out;
      white-space: nowrap;
    }

    .btn-add:hover:not(:disabled) {
      background: #818cf8;
    }

    .btn-add:active:not(:disabled) {
      transform: scale(0.97);
    }

    .btn-add:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  private async _submit(e: Event) {
    e.preventDefault();
    if (!this._title.trim() || this._submitting) return;
    this._submitting = true;

    try {
      const task = await api.post<Task>(`/projects/${this.project.id}/tasks`, {
        title: this._title.trim(),
        priority: this._priority,
        due_date: this._dueDate || undefined,
      });
      this._title = '';
      this._priority = 'none';
      this._dueDate = '';
      this.dispatchEvent(new CustomEvent<Task>('task-created', { detail: task, bubbles: true, composed: true }));
      toast.success('Taak aangemaakt! Nu nog uitvoeren... 😅');
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
            ${this._submitting ? '...' : '+ Toevoegen'}
          </button>
        </div>
        <div class="row">
          <select
            .value=${this._priority}
            @change=${(e: Event) => this._priority = (e.target as HTMLSelectElement).value as TaskPriority}
          >
            <option value="none">Geen prioriteit</option>
            <option value="low">Laag</option>
            <option value="medium">Middel</option>
            <option value="high">Hoog - brandweer erbij!</option>
          </select>
          <input
            type="date"
            .value=${this._dueDate}
            @input=${(e: Event) => this._dueDate = (e.target as HTMLInputElement).value}
          />
        </div>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'doen-task-form': DoenTaskForm;
  }
}
