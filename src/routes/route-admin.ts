import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { checkAuth, isAdmin } from '../lib/auth'
import '../elements/feedboard-header'

interface User {
  id: number
  username: string
  role: string
  created_at: string
}

interface StreamKey {
  id: number
  key: string
  type: string
  path_pattern: string
  owner_name: string
  note: string
  created_at: string
}

interface Permission {
  id: number
  path_pattern: string
  is_public: boolean
  allowed_roles: string
}

/**
 * Admin route - user/key/permission management
 */
@customElement('route-admin')
export class RouteAdmin extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #0a0a0a;
      color: #fff;
    }
    .admin-tabs {
      display: flex;
      gap: 0.25rem;
      padding: 0.75rem 2rem;
      background: #0d0d0d;
      border-bottom: 1px solid #1e1e1e;
    }
    .admin-tabs a {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      color: #888;
      font-size: 0.8rem;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s;
    }
    .admin-tabs a:hover {
      background: #1a1a1a;
      color: #ccc;
    }
    .admin-tabs a.active {
      background: #1e3a5f;
      color: #60a5fa;
    }
    .admin-content {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }
    .admin-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .admin-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    .table th, .table td {
      text-align: left;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #1e1e1e;
    }
    .table th {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #555;
    }
    .table td {
      font-size: 0.8rem;
    }
    .table tbody tr:hover {
      background: #111;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn {
      padding: 0.5rem 1rem;
      background: #1e3a5f;
      border: 1px solid #2563eb;
      border-radius: 6px;
      color: #60a5fa;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn:hover {
      background: #234876;
    }
    .btn-danger {
      background: #3f1212;
      border-color: #7f1d1d;
      color: #f87171;
    }
    .btn-danger:hover {
      background: #521515;
    }
    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.65rem;
    }
    .badge {
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 500;
    }
    .badge-admin { background: #7f1d1d; color: #fca5a5; }
    .badge-publisher { background: #1e3a5f; color: #93c5fd; }
    .badge-viewer { background: #1a1a1a; color: #888; }
    .badge-publish { background: #14532d; color: #86efac; }
    .badge-playback { background: #1e3a5f; color: #93c5fd; }
    .mono {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.75rem;
    }
    .text-muted {
      color: #666;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #555;
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      background: #111;
      border: 1px solid #1e1e1e;
      border-radius: 12px;
      padding: 1.5rem;
      width: 100%;
      max-width: 400px;
    }
    .modal-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 1rem 0;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: #888;
      margin-bottom: 0.5rem;
    }
    .form-input, .form-select {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #161616;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      color: #fff;
      font-size: 0.875rem;
      box-sizing: border-box;
    }
    .form-input:focus, .form-select:focus {
      outline: none;
      border-color: #2563eb;
    }
    .form-checkbox {
      margin-right: 0.5rem;
    }
    .modal-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
    .key-display {
      background: #0a0a0a;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
    }
    .key-display code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
      color: #4ade80;
      word-break: break-all;
    }
    .key-display small {
      display: block;
      margin-top: 0.5rem;
      color: #666;
      font-size: 0.7rem;
    }
    .copy-btn {
      margin-left: 0.5rem;
    }
    .modal-wide {
      max-width: 600px;
    }
    .connection-field {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .connection-field input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      background: #0a0a0a;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      color: #4ade80;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.75rem;
    }
    .connection-field input:focus {
      outline: none;
      border-color: #2563eb;
    }
    .connection-group {
      margin-bottom: 1.25rem;
    }
    .connection-group h4 {
      margin: 0 0 0.5rem 0;
      font-size: 0.8rem;
      font-weight: 600;
      color: #888;
    }
    .connection-note {
      font-size: 0.7rem;
      color: #666;
      margin-top: 0.25rem;
    }
    .key-row-clickable {
      cursor: pointer;
    }
    .key-row-clickable:hover {
      background: #1a1a1a;
    }
    .key-info-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .key-info-header h2 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }
  `

  @state() private activeTab = 'users'
  @state() private users: User[] = []
  @state() private keys: StreamKey[] = []
  @state() private permissions: Permission[] = []
  @state() private showAddUserModal = false
  @state() private showAddKeyModal = false
  @state() private showAddPermissionModal = false
  @state() private showKeyInfoModal = false
  @state() private selectedKey: StreamKey | null = null
  @state() private loading = true

  async connectedCallback() {
    super.connectedCallback()

    // Check auth
    const user = await checkAuth()
    if (!user) {
      window.location.href = '/login?redirect=/admin'
      return
    }
    if (user.role !== 'admin') {
      window.location.href = '/'
      return
    }

    // Handle hash navigation
    if (location.hash) {
      this.activeTab = location.hash.slice(1)
    }

    await this.loadData()
    this.loading = false
  }

  private async loadData() {
    await Promise.all([
      this.loadUsers(),
      this.loadKeys(),
      this.loadPermissions(),
    ])
  }

  private async api<T>(method: string, path: string, body?: object): Promise<T | null> {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : null,
      credentials: 'same-origin',
    })
    if (!res.ok) throw new Error(await res.text())
    if (res.status === 204) return null
    return res.json()
  }

  private async loadUsers() {
    try {
      this.users = await this.api<User[]>('GET', '/api/users') || []
    } catch (e) {
      console.error('Failed to load users:', e)
    }
  }

  private async loadKeys() {
    try {
      this.keys = await this.api<StreamKey[]>('GET', '/api/keys') || []
    } catch (e) {
      console.error('Failed to load keys:', e)
    }
  }

  private async loadPermissions() {
    try {
      this.permissions = await this.api<Permission[]>('GET', '/api/permissions') || []
    } catch (e) {
      console.error('Failed to load permissions:', e)
    }
  }

  private switchTab(tab: string) {
    this.activeTab = tab
    location.hash = tab
  }

  private async handleAddUser(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    try {
      await this.api('POST', '/api/users', {
        username: data.get('username'),
        password: data.get('password'),
        role: data.get('role'),
      })
      form.reset()
      this.showAddUserModal = false
      await this.loadUsers()
    } catch (err: any) {
      alert('Failed to create user: ' + err.message)
    }
  }

  private async handleAddKey(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    try {
      const newKey = await this.api<StreamKey>('POST', '/api/keys', {
        type: data.get('type'),
        path_pattern: data.get('path_pattern'),
        note: data.get('note'),
      })
      form.reset()
      this.showAddKeyModal = false
      await this.loadKeys()
      if (newKey) {
        this.showKeyInfo(newKey)
      }
    } catch (err: any) {
      alert('Failed to create key: ' + err.message)
    }
  }

  private async handleAddPermission(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    try {
      await this.api('POST', '/api/permissions', {
        path_pattern: data.get('path_pattern'),
        is_public: data.get('is_public') === 'on',
        allowed_roles: data.get('allowed_roles'),
      })
      form.reset()
      this.showAddPermissionModal = false
      await this.loadPermissions()
    } catch (err: any) {
      alert('Failed to set permission: ' + err.message)
    }
  }

  private async deleteUser(id: number) {
    if (!confirm('Delete this user?')) return
    try {
      await this.api('DELETE', `/api/users/${id}`)
      await this.loadUsers()
    } catch (err: any) {
      alert('Failed to delete user: ' + err.message)
    }
  }

  private async deleteKey(id: number) {
    if (!confirm('Delete this stream key?')) return
    try {
      await this.api('DELETE', `/api/keys/${id}`)
      await this.loadKeys()
    } catch (err: any) {
      alert('Failed to delete key: ' + err.message)
    }
  }

  private async deletePermission(id: number) {
    if (!confirm('Delete this permission rule?')) return
    try {
      await this.api('DELETE', `/api/permissions/${id}`)
      await this.loadPermissions()
    } catch (err: any) {
      alert('Failed to delete permission: ' + err.message)
    }
  }

  private showKeyInfo(key: StreamKey) {
    this.selectedKey = key
    this.showKeyInfoModal = true
  }

  private copyToClipboard(text: string, button: HTMLButtonElement) {
    navigator.clipboard.writeText(text)
    const original = button.textContent
    button.textContent = 'Copied!'
    setTimeout(() => { button.textContent = original }, 1500)
  }

  private getHost(): string {
    return window.location.hostname
  }

  render() {
    if (this.loading) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;">Loading...</div>`
    }

    return html`
      <feedboard-header page="admin"></feedboard-header>
      <nav class="admin-tabs">
        <a class=${this.activeTab === 'users' ? 'active' : ''} @click=${() => this.switchTab('users')}>Users</a>
        <a class=${this.activeTab === 'keys' ? 'active' : ''} @click=${() => this.switchTab('keys')}>Stream Keys</a>
        <a class=${this.activeTab === 'permissions' ? 'active' : ''} @click=${() => this.switchTab('permissions')}>Permissions</a>
      </nav>

      <main class="admin-content">
        ${this.activeTab === 'users' ? this.renderUsersTab() : ''}
        ${this.activeTab === 'keys' ? this.renderKeysTab() : ''}
        ${this.activeTab === 'permissions' ? this.renderPermissionsTab() : ''}
      </main>

      ${this.showAddUserModal ? this.renderAddUserModal() : ''}
      ${this.showAddKeyModal ? this.renderAddKeyModal() : ''}
      ${this.showAddPermissionModal ? this.renderAddPermissionModal() : ''}
      ${this.showKeyInfoModal ? this.renderKeyInfoModal() : ''}
    `
  }

  private renderUsersTab() {
    return html`
      <div class="admin-header">
        <h1 class="admin-title">Users</h1>
        <button class="btn" @click=${() => this.showAddUserModal = true}>Add User</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.users.length === 0
            ? html`<tr><td colspan="4" class="empty-state">No users found</td></tr>`
            : this.users.map(u => html`
                <tr>
                  <td>${u.username}</td>
                  <td><span class="badge badge-${u.role}">${u.role}</span></td>
                  <td class="text-muted">${new Date(u.created_at).toLocaleDateString()}</td>
                  <td class="actions">
                    <button class="btn btn-danger btn-sm" @click=${() => this.deleteUser(u.id)}>Delete</button>
                  </td>
                </tr>
              `)}
        </tbody>
      </table>
    `
  }

  private renderKeysTab() {
    return html`
      <div class="admin-header">
        <h1 class="admin-title">Stream Keys</h1>
        <button class="btn" @click=${() => this.showAddKeyModal = true}>Create Key</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Path</th>
            <th>Owner</th>
            <th>Note</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.keys.length === 0
            ? html`<tr><td colspan="7" class="empty-state">No stream keys found</td></tr>`
            : this.keys.map(k => html`
                <tr class="key-row-clickable" @click=${() => this.showKeyInfo(k)}>
                  <td class="mono">${k.key.slice(0, 12)}...</td>
                  <td><span class="badge badge-${k.type}">${k.type}</span></td>
                  <td class="mono">${k.path_pattern}</td>
                  <td>${k.owner_name}</td>
                  <td class="text-muted">${k.note || '-'}</td>
                  <td class="text-muted">${new Date(k.created_at).toLocaleDateString()}</td>
                  <td class="actions">
                    <button class="btn btn-sm" @click=${(e: Event) => { e.stopPropagation(); this.showKeyInfo(k) }}>Info</button>
                    <button class="btn btn-danger btn-sm" @click=${(e: Event) => { e.stopPropagation(); this.deleteKey(k.id) }}>Delete</button>
                  </td>
                </tr>
              `)}
        </tbody>
      </table>
    `
  }

  private renderPermissionsTab() {
    return html`
      <div class="admin-header">
        <h1 class="admin-title">Stream Permissions</h1>
        <button class="btn" @click=${() => this.showAddPermissionModal = true}>Add Rule</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Path Pattern</th>
            <th>Public</th>
            <th>Allowed Roles</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.permissions.length === 0
            ? html`<tr><td colspan="4" class="empty-state">No permission rules. All streams require auth by default.</td></tr>`
            : this.permissions.map(p => html`
                <tr>
                  <td class="mono">${p.path_pattern}</td>
                  <td>${p.is_public ? 'Yes' : 'No'}</td>
                  <td>${p.allowed_roles}</td>
                  <td class="actions">
                    <button class="btn btn-danger btn-sm" @click=${() => this.deletePermission(p.id)}>Delete</button>
                  </td>
                </tr>
              `)}
        </tbody>
      </table>
    `
  }

  private renderAddUserModal() {
    return html`
      <div class="modal-overlay" @click=${(e: Event) => e.target === e.currentTarget && (this.showAddUserModal = false)}>
        <div class="modal">
          <h2 class="modal-title">Add User</h2>
          <form @submit=${this.handleAddUser}>
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" name="username" class="form-input" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" name="password" class="form-input" required minlength="8">
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select name="role" class="form-select">
                <option value="viewer">Viewer</option>
                <option value="publisher">Publisher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn" @click=${() => this.showAddUserModal = false}>Cancel</button>
              <button type="submit" class="btn">Create User</button>
            </div>
          </form>
        </div>
      </div>
    `
  }

  private renderAddKeyModal() {
    return html`
      <div class="modal-overlay" @click=${(e: Event) => e.target === e.currentTarget && (this.showAddKeyModal = false)}>
        <div class="modal">
          <h2 class="modal-title">Create Stream Key</h2>
          <form @submit=${this.handleAddKey}>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select name="type" class="form-select">
                <option value="publish">Publish (for OBS/encoders)</option>
                <option value="playback">Playback (for embeds)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Path Pattern</label>
              <input type="text" name="path_pattern" class="form-input" placeholder="cam1, studio/*, *" required>
            </div>
            <div class="form-group">
              <label class="form-label">Note</label>
              <input type="text" name="note" class="form-input" placeholder="OBS Studio, Client embed, etc.">
            </div>
            <div class="modal-actions">
              <button type="button" class="btn" @click=${() => this.showAddKeyModal = false}>Cancel</button>
              <button type="submit" class="btn">Create Key</button>
            </div>
          </form>
        </div>
      </div>
    `
  }

  private renderAddPermissionModal() {
    return html`
      <div class="modal-overlay" @click=${(e: Event) => e.target === e.currentTarget && (this.showAddPermissionModal = false)}>
        <div class="modal">
          <h2 class="modal-title">Add Permission Rule</h2>
          <form @submit=${this.handleAddPermission}>
            <div class="form-group">
              <label class="form-label">Path Pattern</label>
              <input type="text" name="path_pattern" class="form-input" placeholder="cam1, studio/*, *" required>
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" name="is_public" class="form-checkbox"> Public (no auth required for viewing)
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">Allowed Roles (comma-separated)</label>
              <input type="text" name="allowed_roles" class="form-input" placeholder="viewer,publisher,admin" value="viewer,publisher,admin">
            </div>
            <div class="modal-actions">
              <button type="button" class="btn" @click=${() => this.showAddPermissionModal = false}>Cancel</button>
              <button type="submit" class="btn">Save Rule</button>
            </div>
          </form>
        </div>
      </div>
    `
  }

  private renderKeyInfoModal() {
    const k = this.selectedKey
    if (!k) return ''

    const host = this.getHost()
    const path = k.path_pattern === '*' ? 'your-stream-name' : k.path_pattern.replace('/*', '/your-stream-name').replace('*', 'your-stream-name')

    // Publish URLs
    const rtmpServer = `rtmp://${host}:1935`
    const rtmpStreamKey = `${path}?key=${k.key}`
    const srtUrl = `srt://${host}:8890?streamid=publish:${path}:stream:${k.key}`
    const whipUrl = `https://${host}/${path}/whip`
    const whipUrlLegacy = `https://${host}/${path}/whip?key=${k.key}`

    // Playback URLs
    const whepUrl = `https://${host}/${path}/whep`
    const whepUrlLegacy = `https://${host}/${path}/whep?token=${k.key}`
    const hlsUrl = `https://${host}/${path}/index.m3u8?token=${k.key}`
    const rtspPlayUrl = `rtsp://stream:${k.key}@${host}:8554/${path}`
    const srtReadUrl = `srt://${host}:8890?streamid=read:${path}:stream:${k.key}`

    return html`
      <div class="modal-overlay" @click=${(e: Event) => e.target === e.currentTarget && (this.showKeyInfoModal = false)}>
        <div class="modal modal-wide">
          <div class="key-info-header">
            <h2>Connection Info</h2>
            <span class="badge badge-${k.type}">${k.type}</span>
          </div>

          <div class="connection-group">
            <h4>Stream Key</h4>
            <div class="connection-field">
              <input type="text" readonly .value=${k.key}>
              <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(k.key, e.target as HTMLButtonElement)}>Copy</button>
            </div>
            <p class="connection-note">
              Path: <code class="mono">${k.path_pattern}</code>
              ${k.note ? html` &nbsp;|&nbsp; ${k.note}` : ''}
            </p>
          </div>

          ${k.type === 'publish' ? html`
            <div class="connection-group">
              <h4>RTMP (OBS, Streamlabs)</h4>
              <div class="connection-field">
                <input type="text" readonly .value=${rtmpServer}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(rtmpServer, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">Server URL</p>
              <div class="connection-field">
                <input type="text" readonly .value=${rtmpStreamKey}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(rtmpStreamKey, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">Stream Key</p>
            </div>

            <div class="connection-group">
              <h4>SRT (Low latency)</h4>
              <div class="connection-field">
                <input type="text" readonly .value=${srtUrl}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(srtUrl, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">Custom server URL for OBS</p>
            </div>

            <div class="connection-group">
              <h4>WHIP (WebRTC publish - OBS 30+)</h4>
              <div class="connection-field">
                <input type="text" readonly .value=${whipUrl}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(whipUrl, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">Server URL</p>
              <div class="connection-field">
                <input type="text" readonly .value=${k.key}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(k.key, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">Bearer Token (paste in OBS "Bearer Token" field)</p>
              <details style="margin-top: 0.5rem;">
                <summary style="font-size: 0.7rem; color: #555; cursor: pointer;">Legacy URL (with key in query string)</summary>
                <div class="connection-field" style="margin-top: 0.5rem;">
                  <input type="text" readonly .value=${whipUrlLegacy}>
                  <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(whipUrlLegacy, e.target as HTMLButtonElement)}>Copy</button>
                </div>
              </details>
            </div>
          ` : html`
            <div class="connection-group">
              <h4>WHEP (WebRTC playback)</h4>
              <div class="connection-field">
                <input type="text" readonly .value=${whepUrl}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(whepUrl, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">Endpoint URL</p>
              <div class="connection-field">
                <input type="text" readonly .value=${k.key}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(k.key, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">Bearer Token (for Authorization header)</p>
              <details style="margin-top: 0.5rem;">
                <summary style="font-size: 0.7rem; color: #555; cursor: pointer;">Legacy URL (with token in query string)</summary>
                <div class="connection-field" style="margin-top: 0.5rem;">
                  <input type="text" readonly .value=${whepUrlLegacy}>
                  <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(whepUrlLegacy, e.target as HTMLButtonElement)}>Copy</button>
                </div>
              </details>
            </div>

            <div class="connection-group">
              <h4>SRT (Low latency)</h4>
              <div class="connection-field">
                <input type="text" readonly .value=${srtReadUrl}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(srtReadUrl, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">ffplay, VLC, mpv</p>
            </div>

            <div class="connection-group">
              <h4>HLS</h4>
              <div class="connection-field">
                <input type="text" readonly .value=${hlsUrl}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(hlsUrl, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">Compatible with most players</p>
            </div>

            <div class="connection-group">
              <h4>RTSP</h4>
              <div class="connection-field">
                <input type="text" readonly .value=${rtspPlayUrl}>
                <button class="btn btn-sm" @click=${(e: Event) => this.copyToClipboard(rtspPlayUrl, e.target as HTMLButtonElement)}>Copy</button>
              </div>
              <p class="connection-note">VLC, ffplay, etc.</p>
            </div>
          `}

          <div class="modal-actions">
            <button class="btn" @click=${() => this.showKeyInfoModal = false}>Close</button>
          </div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'route-admin': RouteAdmin
  }
}
