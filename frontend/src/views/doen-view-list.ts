import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Task } from '../services/types';
import { sharedStyles } from '../styles/shared-styles';
import '../components/doen-task';

@customElement('doen-view-list')
export class DoenViewList extends LitElement {
  @property({ type: Array }) tasks: Task[] = [];

  static styles = [...sharedStyles, css`
    :host {
      display: block;
      overflow-y: auto;
      height: 100%;
    }

    .section { margin-bottom: 24px; }
    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      background: var(--color-danger);
      color: white;
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 10px;
      font-weight: 700;
    }
    .task-list { display: flex; flex-direction: column; gap: 5px; }

    .empty-state {
      margin-top: 60px;
      text-align: center;
      color: var(--color-text-muted);
    }
    .empty-state i {
      font-size: 36px;
      opacity: 0.25;
      display: block;
      margin-bottom: 14px;
    }
    .empty-state p { font-size: 14px; }
    .empty-state small { font-size: 12px; opacity: 0.6; }
  `];

  private _today() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const tom = new Date(now); tom.setDate(tom.getDate() + 1);
    return this.tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      const d = new Date(t.due_date);
      return d >= now && d < tom;
    });
  }

  private _overdue() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return this.tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < now;
    });
  }

  private _upcoming() {
    const tom = new Date(); tom.setHours(0, 0, 0, 0); tom.setDate(tom.getDate() + 1);
    return this.tasks
      .filter(t => {
        if (!t.due_date || t.status === 'done') return false;
        return new Date(t.due_date) >= tom;
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }

  render() {
    const today = this._today();
    const overdue = this._overdue();
    const upcoming = this._upcoming();

    if (!today.length && !overdue.length && !upcoming.length) {
      return html`
        <div class="empty-state">
          <i class="fa-solid fa-circle-check"></i>
          <p>Niets te doen.</p>
          <small>Óf je bent super productief, óf je bent alles vergeten in te plannen.</small>
        </div>
      `;
    }

    return html`
      ${overdue.length ? html`
        <div class="section">
          <div class="section-label">
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--color-danger)"></i>
            Achterstallig <span class="badge">${overdue.length}</span>
          </div>
          <div class="task-list">
            ${overdue.map(t => html`<doen-task .task=${t}></doen-task>`)}
          </div>
        </div>
      ` : ''}
      ${today.length ? html`
        <div class="section">
          <div class="section-label">
            <i class="fa-solid fa-sun" style="color:var(--color-warning)"></i>
            Voor vandaag
          </div>
          <div class="task-list">
            ${today.map(t => html`<doen-task .task=${t}></doen-task>`)}
          </div>
        </div>
      ` : ''}
      ${upcoming.length ? html`
        <div class="section">
          <div class="section-label">
            <i class="fa-solid fa-calendar-day" style="color:var(--color-accent)"></i>
            Binnenkort
          </div>
          <div class="task-list">
            ${upcoming.map(t => html`<doen-task .task=${t}></doen-task>`)}
          </div>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-view-list': DoenViewList; }
}
