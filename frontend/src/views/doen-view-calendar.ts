import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Task } from '../services/types';
import { sharedStyles } from '../styles/shared-styles';
import '../components/doen-task';

type Range = 'day' | 'week' | 'month';

const DAY_LABELS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

function startOfWeek(d: Date): Date {
  // Week starts Monday (NL convention)
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

@customElement('doen-view-calendar')
export class DoenViewCalendar extends LitElement {
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: String }) range: Range = 'week';
  @property({ type: Object }) anchor: Date = new Date();
  @state() private _openTaskId: string | null = null;

  static styles = [...sharedStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .range-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 10px;
      text-transform: capitalize;
    }

    .grid {
      flex: 1;
      min-height: 0;
      display: grid;
      gap: 6px;
      overflow: auto;
    }
    .grid.week { grid-template-columns: repeat(7, 1fr); grid-auto-rows: 1fr; }
    .grid.month { grid-template-columns: repeat(7, 1fr); grid-auto-rows: minmax(100px, 1fr); }
    .grid.day { grid-template-columns: 1fr; }

    .cell {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 10px 10px 8px;
      min-height: 70px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      overflow: hidden;
    }
    .cell.today {
      border-color: rgba(99,102,241,0.55);
      background: rgba(99,102,241,0.07);
    }
    .cell.outside { opacity: 0.4; }
    .cell.day-view { min-height: 0; flex: 1; }

    .cell-head {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 11px;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }
    .cell-head .dow {
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 600;
    }
    .cell-head .dom {
      font-size: 15px;
      font-weight: 700;
      color: var(--color-text);
    }
    .cell.today .cell-head .dom { color: var(--color-accent); }

    .cell-pills {
      display: flex;
      flex-direction: column;
      gap: 3px;
      overflow: hidden;
    }

    .pill {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 7px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      font-size: 11px;
      color: var(--color-text);
      cursor: pointer;
      overflow: hidden;
      line-height: 1.25;
      transition: background 120ms, border-color 120ms;
    }
    .pill:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
    .pill.done { opacity: 0.45; text-decoration: line-through; }
    .pill .dot {
      width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    }
    .pill .dot.p-none { background: rgba(255,255,255,0.25); }
    .pill .dot.p-low { background: var(--color-priority-low); }
    .pill .dot.p-medium { background: var(--color-priority-medium); }
    .pill .dot.p-high { background: var(--color-priority-high); }
    .pill .pill-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pill .pill-time {
      font-size: 10px;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .more {
      font-size: 10px;
      color: var(--color-text-muted);
      padding: 2px 4px;
      cursor: pointer;
    }
    .more:hover { color: var(--color-text); }

    /* Day view — a richer list, no cell overflow */
    .day-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    /* Unscheduled drawer */
    .unscheduled {
      margin-top: 10px;
      padding: 10px 12px;
      background: rgba(255,255,255,0.03);
      border: 1px dashed rgba(255,255,255,0.12);
      border-radius: 10px;
      flex-shrink: 0;
      max-height: 35%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .unscheduled-head {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .unscheduled-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow-y: auto;
    }

    /* Mobile: week becomes a vertical day list; month shrinks cells */
    @media (max-width: 640px) {
      .grid.week {
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
      }
      .grid.week .cell {
        min-height: 64px;
        padding: 10px 12px;
      }
      .grid.week .cell-head {
        font-size: 12px;
      }
      .grid.week .cell-head .dom {
        font-size: 16px;
      }
      .grid.month {
        grid-auto-rows: minmax(68px, auto);
        gap: 4px;
      }
      .grid.month .cell {
        min-height: 68px;
        padding: 6px 6px 5px;
        gap: 3px;
      }
      .grid.month .cell-head .dom { font-size: 13px; }
      .grid.month .cell-head .dow { display: none; }
      .grid.month .pill { padding: 2px 5px; font-size: 10px; }
      .grid.month .pill .pill-time { display: none; }

      .unscheduled { max-height: 45%; }
    }
  `];

  private _cellsForWeek(start: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    });
  }

  private _cellsForMonth(anchor: Date): Date[] {
    const first = startOfMonth(anchor);
    const start = startOfWeek(first);
    // 6 weeks × 7 days = 42 cells — covers every month layout
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    });
  }

  private _tasksOn(day: Date): Task[] {
    return this.tasks
      .filter(t => t.due_date && sameDay(new Date(t.due_date), day))
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }

  private _unscheduled(): Task[] {
    return this.tasks.filter(t => !t.due_date && t.status !== 'done');
  }

  private _formatTime(iso: string): string {
    const d = new Date(iso);
    if (d.getHours() === 0 && d.getMinutes() === 0) return '';
    return d.toTimeString().slice(0, 5);
  }

  private _rangeLabel(): string {
    if (this.range === 'day') {
      return this.anchor.toLocaleDateString('nl-NL', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    }
    if (this.range === 'week') {
      const start = startOfWeek(this.anchor);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      const sm = start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
      const em = end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${sm} – ${em}`;
    }
    return this.anchor.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  }

  private _openPill(id: string) {
    this._openTaskId = id;
  }

  private _closePill = () => {
    this._openTaskId = null;
  };

  private _renderPill(t: Task) {
    const timeLabel = t.due_date ? this._formatTime(t.due_date) : '';
    return html`
      <div class="pill ${t.status === 'done' ? 'done' : ''}" @click=${() => this._openPill(t.id)}>
        <span class="dot p-${t.priority}"></span>
        <span class="pill-title">${t.title}</span>
        ${timeLabel ? html`<span class="pill-time">${timeLabel}</span>` : ''}
      </div>
    `;
  }

  private _renderCell(day: Date, monthAnchor?: Date) {
    const today = startOfDay(new Date());
    const isToday = sameDay(day, today);
    const outside = monthAnchor ? day.getMonth() !== monthAnchor.getMonth() : false;
    const dayTasks = this._tasksOn(day);
    const maxVisible = this.range === 'month' ? 3 : 8;
    const visible = dayTasks.slice(0, maxVisible);
    const hidden = dayTasks.length - visible.length;

    return html`
      <div class="cell ${isToday ? 'today' : ''} ${outside ? 'outside' : ''}">
        <div class="cell-head">
          <span class="dow">${DAY_LABELS[(day.getDay() + 6) % 7]}</span>
          <span class="dom">${day.getDate()}</span>
        </div>
        <div class="cell-pills">
          ${visible.map(t => this._renderPill(t))}
          ${hidden > 0 ? html`<span class="more">+${hidden} meer</span>` : ''}
        </div>
      </div>
    `;
  }

  private _renderDayView() {
    const tasks = this._tasksOn(this.anchor);
    return html`
      <div class="grid day">
        <div class="cell day-view ${sameDay(this.anchor, new Date()) ? 'today' : ''}">
          <div class="cell-head">
            <span class="dow">${DAY_LABELS[(this.anchor.getDay() + 6) % 7]}</span>
            <span class="dom">${this.anchor.getDate()}</span>
          </div>
          <div class="day-list">
            ${tasks.length === 0
              ? html`<div style="color:var(--color-text-muted);font-size:13px;padding:12px 0">
                  Geen taken op deze dag.
                </div>`
              : tasks.map(t => html`<doen-task .task=${t}></doen-task>`)}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const unscheduled = this._unscheduled();

    let body;
    if (this.range === 'day') {
      body = this._renderDayView();
    } else if (this.range === 'week') {
      const start = startOfWeek(this.anchor);
      body = html`
        <div class="grid week">
          ${this._cellsForWeek(start).map(d => this._renderCell(d))}
        </div>
      `;
    } else {
      const cells = this._cellsForMonth(this.anchor);
      body = html`
        <div class="grid month">
          ${cells.map(d => this._renderCell(d, this.anchor))}
        </div>
      `;
    }

    const openTask = this._openTaskId
      ? this.tasks.find(t => t.id === this._openTaskId)
      : null;

    return html`
      <div class="range-label">${this._rangeLabel()}</div>
      ${body}
      ${unscheduled.length ? html`
        <div class="unscheduled">
          <div class="unscheduled-head">
            <i class="fa-solid fa-inbox"></i>
            Niet ingepland (${unscheduled.length})
          </div>
          <div class="unscheduled-list">
            ${unscheduled.map(t => html`<doen-task .task=${t}></doen-task>`)}
          </div>
        </div>
      ` : ''}
      ${openTask ? html`
        <doen-task
          .task=${openTask}
          .hideRow=${true}
          .autoOpen=${true}
          @modal-closed=${this._closePill}
          @task-deleted=${this._closePill}
        ></doen-task>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'doen-view-calendar': DoenViewCalendar; }
}
