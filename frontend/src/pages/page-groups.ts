import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Group, Project } from '../services/types';
import { api, ApiError } from '../services/api';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';

@customElement('page-groups')
export class PageGroups extends LitElement {
  @state() private _groups: Group[] = [];
  @state() private _loading = true;
  @state() private _creating = false;
  @state() private _newName = '';
  @state() private _newType: 'household' | 'custom' = 'household';
  @state() private _inviteGroupId = '';
  @state() private _inviteEmail = '';
  @state() private _inviting = false;
  @state() private _newProjectGroupId = '';
  @state() private _newProjectName = '';
  @state() private _creatingProject = false;

  static styles = [...sharedStyles, css`
    :host { display: block; overflow-y: auto; height: 100%; }

    h1 {
      font-size: 24px; font-weight: 800; color: #e8eaf0;
      margin-bottom: 4px; letter-spacing: -0.5px;
    }

    .subtitle { font-size: 13px; color: rgba(232,234,240,0.45); margin-bottom: 28px; }

    .card {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 18px;
      padding: 20px 22px;
      margin-bottom: 16px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .card-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
    }

    .group-icon {
      width: 38px; height: 38px; border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; color: white; flex-shrink: 0;
    }

    .group-name { font-size: 16px; font-weight: 700; color: #e8eaf0; }
    .group-type { font-size: 11px; color: rgba(232,234,240,0.45); text-transform: uppercase; letter-spacing: 0.6px; }

    .section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.7px; color: rgba(232,234,240,0.4); margin-bottom: 10px;
    }

    .invite-row { display: flex; gap: 8px; }

    input, select {
      font: inherit; color: #e8eaf0;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 9px; padding: 9px 14px;
      outline: none; -webkit-appearance: none; appearance: none;
      transition: border-color 120ms, background 120ms;
      width: 100%;
    }

    input:focus, select:focus { border-color: #6366f1; background: rgba(255,255,255,0.1); }
    select option { background: #1e2436; color: #e8eaf0; }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }

    .btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 9px 18px; border-radius: 9px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background 120ms, opacity 120ms;
      white-space: nowrap; flex-shrink: 0;
    }

    .btn-primary { background: #6366f1; color: white; border: none; }
    .btn-primary:hover { background: #818cf8; }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-outline {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.14);
      color: rgba(232,234,240,0.7);
    }
    .btn-outline:hover { background: rgba(255,255,255,0.1); color: #e8eaf0; }

    .create-form {
      display: flex; flex-direction: column; gap: 12px;
      margin-bottom: 24px;
    }

    .form-row { display: flex; gap: 10px; flex-wrap: wrap; }

    .empty-state {
      padding: 48px; text-align: center; color: rgba(232,234,240,0.3);
    }

    .empty-state i { font-size: 32px; opacity: 0.2; display: block; margin-bottom: 12px; }

    .sk {
      height: 100px; border-radius: 18px; margin-bottom: 16px;
      background: rgba(255,255,255,0.05);
      animation: shimmer 1.4s ease-in-out infinite;
      background-image: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
      background-size: 200% 100%;
    }

    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    @media (max-width: 768px) { h1 { font-size: 20px; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this._loading = true;
    try {
      this._groups = await api.get<Group[]>('/groups');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Laden mislukt: ${e.message}`);
    } finally {
      this._loading = false;
    }
  }

  private async _createGroup(e: Event) {
    e.preventDefault();
    if (!this._newName.trim() || this._creating) return;
    this._creating = true;
    try {
      const g = await api.post<Group>('/groups', { name: this._newName.trim(), type: this._newType });
      this._groups = [...this._groups, g];
      this._newName = '';
      toast.success(`Groep "${g.name}" aangemaakt!`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Aanmaken mislukt: ${e.message}`);
    } finally {
      this._creating = false;
    }
  }

  private async _invite(groupId: string, e: Event) {
    e.preventDefault();
    if (!this._inviteEmail.trim() || this._inviting) return;
    this._inviting = true;
    try {
      await api.post(`/groups/${groupId}/members`, { email: this._inviteEmail.trim() });
      this._inviteEmail = '';
      this._inviteGroupId = '';
      toast.success('Uitnodiging verstuurd!');
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Uitnodigen mislukt: ${e.message}`);
    } finally {
      this._inviting = false;
    }
  }

  private async _createProject(groupId: string, e: Event) {
    e.preventDefault();
    const name = this._newProjectName.trim();
    if (!name || this._creatingProject) return;
    this._creatingProject = true;
    try {
      const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      await api.post<Project>('/projects', { name, color, group_id: groupId });
      this._newProjectName = '';
      this._newProjectGroupId = '';
      this.dispatchEvent(new CustomEvent('project-created', { bubbles: true, composed: true }));
      toast.success(`Project "${name}" aangemaakt!`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Aanmaken mislukt: ${e.message}`);
    } finally {
      this._creatingProject = false;
    }
  }

  render() {
    return html`
      <h1>Groepen</h1>
      <p class="subtitle">Beheer gedeelde projecten met huisgenoten of anderen.</p>

      <div class="card">
        <div class="section-label">Nieuwe groep</div>
        <form class="create-form" @submit=${this._createGroup}>
          <div class="form-row">
            <input type="text" placeholder="Naam van de groep"
              .value=${this._newName}
              @input=${(e: Event) => this._newName = (e.target as HTMLInputElement).value}
              style="flex:1;min-width:160px"
            />
            <select .value=${this._newType}
              @change=${(e: Event) => this._newType = (e.target as HTMLSelectElement).value as 'household' | 'custom'}
              style="width:auto">
              <option value="household">Huishouden</option>
              <option value="custom">Aangepast</option>
            </select>
            <button type="submit" class="btn btn-primary" ?disabled=${this._creating || !this._newName.trim()}>
              <i class="fa-solid fa-${this._creating ? 'spinner fa-spin' : 'plus'}"></i>
              Aanmaken
            </button>
          </div>
        </form>
      </div>

      ${this._loading ? html`<div class="sk"></div><div class="sk"></div>` : ''}

      ${!this._loading && this._groups.length === 0 ? html`
        <div class="empty-state">
          <i class="fa-solid fa-people-group"></i>
          Nog geen groepen. Maak er een aan hierboven.
        </div>
      ` : ''}

      ${this._groups.map(g => html`
        <div class="card">
          <div class="card-header">
            <div class="group-icon"><i class="fa-solid fa-people-group"></i></div>
            <div>
              <div class="group-name">${g.name}</div>
              <div class="group-type">${g.type}</div>
            </div>
          </div>

          <div class="section-label" style="margin-top:14px">Nieuw project</div>
          <form class="invite-row" @submit=${(e: Event) => this._createProject(g.id, e)}>
            <input type="text" placeholder="Projectnaam"
              .value=${this._newProjectGroupId === g.id ? this._newProjectName : ''}
              @focus=${() => this._newProjectGroupId = g.id}
              @input=${(e: Event) => this._newProjectName = (e.target as HTMLInputElement).value}
            />
            <button type="submit" class="btn btn-primary"
              ?disabled=${this._creatingProject || this._newProjectGroupId !== g.id || !this._newProjectName.trim()}>
              <i class="fa-solid fa-${this._creatingProject && this._newProjectGroupId === g.id ? 'spinner fa-spin' : 'plus'}"></i>
              Aanmaken
            </button>
          </form>

          <div class="section-label" style="margin-top:14px">Lid uitnodigen</div>
          <form class="invite-row" @submit=${(e: Event) => this._invite(g.id, e)}>
            <input type="email" placeholder="e-mailadres"
              .value=${this._inviteGroupId === g.id ? this._inviteEmail : ''}
              @focus=${() => this._inviteGroupId = g.id}
              @input=${(e: Event) => this._inviteEmail = (e.target as HTMLInputElement).value}
            />
            <button type="submit" class="btn btn-primary"
              ?disabled=${this._inviting || this._inviteGroupId !== g.id || !this._inviteEmail.trim()}>
              <i class="fa-solid fa-user-plus"></i>
              Uitnodigen
            </button>
          </form>
        </div>
      `)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'page-groups': PageGroups; }
}
