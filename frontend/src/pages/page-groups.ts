import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Group, GroupMember, Project } from '../services/types';
import { api, ApiError } from '../services/api';
import { getMe, type Me } from '../services/auth';
import { toast } from '../components/doen-toast';
import { sharedStyles } from '../styles/shared-styles';

@customElement('page-groups')
export class PageGroups extends LitElement {
  @state() private _groups: Group[] = [];
  @state() private _members: Record<string, GroupMember[]> = {};
  @state() private _me: Me | null = null;
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
  @state() private _removingUserId = '';
  @state() private _editingGroupId = '';
  @state() private _editingGroupName = '';
  @state() private _savingRename = false;

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

    .group-title-row {
      display: flex; align-items: center; gap: 8px;
    }

    .rename-btn {
      background: transparent; border: none;
      color: rgba(232,234,240,0.35);
      width: 26px; height: 26px; border-radius: 6px;
      cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      font-size: 11px;
      opacity: 0;
      transition: background 120ms, color 120ms, opacity 120ms;
    }
    .card-header:hover .rename-btn { opacity: 1; }
    .rename-btn:hover { background: rgba(255,255,255,0.08); color: #e8eaf0; }

    .group-name-input {
      font-size: 16px; font-weight: 700; color: #e8eaf0;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(99,102,241,0.5);
      border-radius: 7px; padding: 4px 10px;
      outline: none;
      min-width: 160px;
    }
    .group-name-input:focus { border-color: #6366f1; background: rgba(255,255,255,0.1); }

    .section-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.7px; color: rgba(232,234,240,0.4); margin-bottom: 10px;
    }

    .invite-row { display: flex; gap: 8px; }

    .member-list { display: flex; flex-direction: column; gap: 6px; }
    .member-row {
      display: flex; align-items: center; gap: 12px;
      padding: 9px 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
    }
    .member-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .member-info { flex: 1; min-width: 0; }
    .member-name {
      font-size: 13px; font-weight: 600; color: #e8eaf0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .member-email {
      font-size: 11px; color: rgba(232,234,240,0.45);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .member-badge {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.6px; padding: 3px 7px; border-radius: 6px;
      background: rgba(99,102,241,0.18); color: #a5b4fc;
      flex-shrink: 0;
    }
    .member-badge.owner { background: rgba(245,158,11,0.18); color: #fcd34d; }
    .member-badge.self { background: rgba(16,185,129,0.18); color: #6ee7b7; }

    .remove-btn {
      background: transparent; border: none;
      color: rgba(232,234,240,0.4);
      width: 28px; height: 28px; border-radius: 7px;
      cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      transition: background 120ms, color 120ms;
      flex-shrink: 0;
    }
    .remove-btn:hover { background: rgba(239,68,68,0.15); color: #f87171; }
    .remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .member-empty {
      font-size: 12px; color: rgba(232,234,240,0.3);
      padding: 12px 0;
    }

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
      const [groups, me] = await Promise.all([
        api.get<Group[]>('/groups'),
        getMe(),
      ]);
      this._groups = groups;
      this._me = me;
      await this._loadAllMembers();
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Laden mislukt: ${e.message}`);
    } finally {
      this._loading = false;
    }
  }

  private async _loadAllMembers() {
    const entries = await Promise.all(
      this._groups.map(async g => {
        try {
          const m = await api.get<GroupMember[]>(`/groups/${g.id}/members`);
          return [g.id, m] as const;
        } catch {
          return [g.id, [] as GroupMember[]] as const;
        }
      }),
    );
    this._members = Object.fromEntries(entries);
  }

  private _canManage(group: Group): boolean {
    if (!this._me) return false;
    if (group.owner_id === this._me.id) return true;
    const members = this._members[group.id] ?? [];
    const self = members.find(m => m.user_id === this._me!.id);
    return self?.role === 'admin';
  }

  private async _removeMember(group: Group, member: GroupMember) {
    if (!confirm(`${member.name} uit "${group.name}" verwijderen?`)) return;
    this._removingUserId = member.user_id;
    try {
      await api.delete(`/groups/${group.id}/members/${member.user_id}`);
      this._members = {
        ...this._members,
        [group.id]: (this._members[group.id] ?? []).filter(m => m.user_id !== member.user_id),
      };
      toast.success(`${member.name} verwijderd`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Verwijderen mislukt: ${e.message}`);
    } finally {
      this._removingUserId = '';
    }
  }

  private _initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0]!.toUpperCase())
      .join('');
  }

  private async _createGroup(e: Event) {
    e.preventDefault();
    if (!this._newName.trim() || this._creating) return;
    this._creating = true;
    try {
      const g = await api.post<Group>('/groups', { name: this._newName.trim(), type: this._newType });
      this._groups = [...this._groups, g];
      this._members = { ...this._members, [g.id]: [] };
      try {
        const m = await api.get<GroupMember[]>(`/groups/${g.id}/members`);
        this._members = { ...this._members, [g.id]: m };
      } catch { /* non-fatal */ }
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
    const email = this._inviteEmail.trim();
    if (!email || this._inviting) return;
    this._inviting = true;
    try {
      const res = await api.post<{ status: 'added' | 'invited'; email: string }>(
        `/groups/${groupId}/members`,
        { email },
      );
      this._inviteEmail = '';
      this._inviteGroupId = '';
      toast.success(
        res.status === 'added'
          ? `${res.email} toegevoegd aan de groep`
          : `Uitnodiging verstuurd naar ${res.email}`,
      );
      if (res.status === 'added') {
        try {
          const m = await api.get<GroupMember[]>(`/groups/${groupId}/members`);
          this._members = { ...this._members, [groupId]: m };
        } catch { /* non-fatal */ }
      }
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

  private _startRename(g: Group) {
    this._editingGroupId = g.id;
    this._editingGroupName = g.name;
  }

  private _cancelRename() {
    this._editingGroupId = '';
    this._editingGroupName = '';
  }

  private async _commitRename(g: Group) {
    if (this._savingRename) return;
    const name = this._editingGroupName.trim();
    if (!name || name === g.name) {
      this._cancelRename();
      return;
    }
    this._editingGroupId = '';
    this._savingRename = true;
    try {
      const updated = await api.put<Group>(`/groups/${g.id}`, { name });
      this._groups = this._groups.map(x => x.id === g.id ? updated : x);
      this.dispatchEvent(new CustomEvent('project-created', { bubbles: true, composed: true }));
      toast.success(`Groep hernoemd naar "${updated.name}"`);
    } catch (e) {
      if (e instanceof ApiError) toast.error(`Hernoemen mislukt: ${e.message}`);
    } finally {
      this._savingRename = false;
      this._editingGroupName = '';
    }
  }

  private _onRenameKeydown(e: KeyboardEvent, g: Group) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void this._commitRename(g);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._cancelRename();
    }
  }

  private _renderGroupName(g: Group) {
    const canManage = this._canManage(g);
    if (this._editingGroupId === g.id) {
      return html`
        <input
          class="group-name-input"
          type="text"
          .value=${this._editingGroupName}
          @input=${(e: Event) => this._editingGroupName = (e.target as HTMLInputElement).value}
          @keydown=${(e: KeyboardEvent) => this._onRenameKeydown(e, g)}
          @blur=${() => this._commitRename(g)}
          autofocus
        />
      `;
    }
    return html`
      <div class="group-title-row">
        <div class="group-name">${g.name}</div>
        ${canManage ? html`
          <button class="rename-btn" title="Naam wijzigen"
            @click=${() => this._startRename(g)}>
            <i class="fa-solid fa-pen"></i>
          </button>
        ` : ''}
      </div>
    `;
  }

  private _renderMembers(g: Group) {
    const members = this._members[g.id];
    if (!members) return html`<div class="member-empty">Leden laden...</div>`;
    if (members.length === 0) return html`<div class="member-empty">Nog geen leden.</div>`;

    const canManage = this._canManage(g);
    const meId = this._me?.id;

    return html`
      <div class="member-list">
        ${members.map(m => {
          const isOwner = m.user_id === g.owner_id;
          const isSelf = m.user_id === meId;
          const showRemove = canManage && !isOwner && !isSelf;
          return html`
            <div class="member-row">
              <div class="member-avatar">${this._initials(m.name)}</div>
              <div class="member-info">
                <div class="member-name">${m.name}</div>
                <div class="member-email">${m.email}</div>
              </div>
              ${isOwner ? html`<span class="member-badge owner">Eigenaar</span>` : ''}
              ${isSelf && !isOwner ? html`<span class="member-badge self">Jij</span>` : ''}
              ${!isOwner && !isSelf && m.role === 'admin' ? html`<span class="member-badge">Admin</span>` : ''}
              ${showRemove ? html`
                <button class="remove-btn" title="Verwijderen"
                  ?disabled=${this._removingUserId === m.user_id}
                  @click=${() => this._removeMember(g, m)}>
                  <i class="fa-solid fa-${this._removingUserId === m.user_id ? 'spinner fa-spin' : 'xmark'}"></i>
                </button>
              ` : ''}
            </div>
          `;
        })}
      </div>
    `;
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
              ${this._renderGroupName(g)}
              <div class="group-type">${g.type}</div>
            </div>
          </div>

          <div class="section-label" style="margin-top:4px">Leden</div>
          ${this._renderMembers(g)}

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
