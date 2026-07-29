// SmartBin ESP32 IoT Mobile Web Application Frontend Engine

const app = {
  currentUser: null,
  activeTab: 'home',
  bins: [],
  alerts: [],
  admins: [],
  auditLogs: [],
  socket: null,
  audioCtx: null,

  init() {
    this.initSocket();

    // Check existing user session
    const savedUser = localStorage.getItem('smartbin_user');
    if (savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        // Check 30-minute inactivity session expiration (Story 3)
        if (userObj.sessionExpiresAt && Date.now() > userObj.sessionExpiresAt) {
          alert('Session Expired: You have been logged out due to 30 minutes of inactivity.');
          this.logout();
          return;
        }
        this.currentUser = userObj;
        this.onLoginSuccess();
      } catch (e) {
        this.showAuthModal();
      }
    } else {
      this.showAuthModal();
    }

    // Restore sidebar state
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
      document.getElementById('sidebar').classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
    }

    // Live auto-polling every 3 seconds
    setInterval(() => {
      if (this.currentUser) {
        this.checkSessionTimeout();
        this.fetchBins();
        if (this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin') {
          this.fetchSuperadminData();
        }
      }
    }, 3000);
  },

  // Initialize Socket.io for instant hardware alerts (Story 8, 14, 16)
  initSocket() {
    try {
      this.socket = io();
      this.socket.on('connect', () => {
        console.log('🔌 Connected to Socket.io real-time server with ID:', this.socket.id);
      });

      // Listen for urgent_bin_full threshold event (Story 8)
      this.socket.on('urgent_bin_full', (data) => {
        console.log('🚨 URGENT ALARM RECEIVED VIA SOCKET.IO:', data);
        this.triggerUrgentAlertModal(data);
        this.fetchBins();
        this.fetchAlerts();
      });
    } catch (err) {
      console.warn('Socket.io connection warning:', err);
    }
  },

  // 30-Minute Inactivity Session Timeout Check (Story 3)
  checkSessionTimeout() {
    if (this.currentUser && this.currentUser.sessionExpiresAt) {
      if (Date.now() > this.currentUser.sessionExpiresAt) {
        alert('Session Timeout: Logged out after 30 minutes of inactivity.');
        this.logout();
      }
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed);
  },

  showAuthModal() {
    document.getElementById('auth-modal').classList.add('open');
  },

  hideAuthModal() {
    document.getElementById('auth-modal').classList.remove('open');
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok) {
        this.currentUser = data.user;
        localStorage.setItem('smartbin_user', JSON.stringify(data.user));
        this.hideAuthModal();
        this.onLoginSuccess();
        return;
      } else {
        // Display "Credentials Invalid" error message (Story 3)
        alert(data.error || 'Credentials Invalid');
      }
    } catch (err) {
      alert('Credentials Invalid: Unable to connect to authentication server');
    }
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('smartbin_user');
    this.showAuthModal();
  },

  onLoginSuccess() {
    const isSuperadmin = this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin';
    const badge = document.getElementById('user-role-badge');
    badge.innerText = isSuperadmin ? '👑 Superadmin' : '🛡️ Admin';
    badge.className = `user-role-badge ${isSuperadmin ? 'superadmin' : 'admin'}`;

    // Role Scoping (Stories 10, 15, 17): Hide Superadmin sections from standard Admins
    const superadminGroup = document.getElementById('superadmin-nav-group');
    const quickAdminBtn = document.getElementById('btn-quick-admin-nav');

    if (isSuperadmin) {
      if (superadminGroup) superadminGroup.style.display = 'block';
      if (quickAdminBtn) quickAdminBtn.style.display = 'inline-flex';
      this.fetchSuperadminData();
    } else {
      if (superadminGroup) superadminGroup.style.display = 'none';
      if (quickAdminBtn) quickAdminBtn.style.display = 'none';
      // If Admin tries to access Superadmin tab directly, redirect to Home (Story 17)
      if (this.activeTab === 'admin-management' || this.activeTab === 'bin-registration') {
        this.switchTab('home');
      }
    }

    this.refreshAll();
  },

  switchTab(tabId) {
    const isSuperadmin = this.currentUser && this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin';

    // Strict Role Enforcement (Story 17): Rejects standard admins from superadmin pages
    if ((tabId === 'admin-management' || tabId === 'bin-registration') && !isSuperadmin) {
      alert('Access Denied: You must be a Superadmin to access this page.');
      this.switchTab('home');
      return;
    }

    this.activeTab = tabId;

    // Toggle view active class
    document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const targetView = document.getElementById(`view-${tabId}`);
    const targetLink = document.getElementById(`nav-link-${tabId}`);
    if (targetView) targetView.classList.add('active');
    if (targetLink) targetLink.classList.add('active');

    // Update Header Back to Home Button (Story 12)
    const btnBackHome = document.getElementById('btn-back-home');
    const breadcrumb = document.getElementById('current-page-breadcrumb');

    const breadcrumbMap = {
      home: 'Home Dashboard',
      bins: 'Live Smart Bins & Capacity Levels',
      alerts: 'Hardware Overflow Alert History',
      'admin-management': 'Superadmin Admin Management',
      'bin-registration': 'Register New Smart Bin',
      simulator: 'ESP32 Telemetry Simulator'
    };

    if (breadcrumb) breadcrumb.innerText = breadcrumbMap[tabId] || 'Dashboard';

    if (tabId === 'home') {
      if (btnBackHome) btnBackHome.style.display = 'none';
    } else {
      if (btnBackHome) btnBackHome.style.display = 'inline-flex';
    }

    // Refresh tab data
    if (tabId === 'bins' || tabId === 'home') this.fetchBins();
    if (tabId === 'alerts') this.fetchAlerts();
    if (tabId === 'admin-management' && isSuperadmin) this.fetchSuperadminData();
  },

  refreshAll() {
    this.fetchBins();
    this.fetchAlerts();
    if (this.currentUser && this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin') {
      this.fetchSuperadminData();
    }
  },

  async fetchBins() {
    try {
      const res = await fetch('/api/bins');
      if (res.ok) {
        this.bins = await res.json();
        this.renderBins();
        this.updateHomeStats();
      }
    } catch (err) {
      console.warn('Error fetching bins:', err);
    }
  },

  updateHomeStats() {
    const totalBinsEl = document.getElementById('stat-total-bins');
    const urgentBinsEl = document.getElementById('stat-urgent-bins');

    if (totalBinsEl) totalBinsEl.innerText = this.bins.length;

    let urgentCount = 0;
    this.bins.forEach(b => {
      const dry = b.compartments ? b.compartments.dry || 0 : b.dry || 0;
      const wet = b.compartments ? b.compartments.wet || 0 : b.wet || 0;
      const metal = b.compartments ? b.compartments.metal || 0 : b.metal || 0;
      if (dry >= 80 || wet >= 80 || metal >= 80) urgentCount++;
    });

    if (urgentBinsEl) urgentBinsEl.innerText = urgentCount;
  },

  renderBins() {
    const container = document.getElementById('bins-container');
    if (!container) return;

    if (!this.bins || this.bins.length === 0) {
      container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted); grid-column: 1/-1;">No smart bins active in system database.</div>`;
      return;
    }

    container.innerHTML = this.bins.map(bin => {
      const dry = bin.compartments ? bin.compartments.dry || 0 : bin.dry || 0;
      const wet = bin.compartments ? bin.compartments.wet || 0 : bin.wet || 0;
      const metal = bin.compartments ? bin.compartments.metal || 0 : bin.metal || 0;

      const isUrgent = dry >= 80 || wet >= 80 || metal >= 80;

      const getBarClass = (val) => val >= 80 ? 'danger' : (val >= 60 ? 'warning' : 'normal');

      return `
        <div class="bin-card ${isUrgent ? 'urgent-border' : ''}">
          <div class="bin-card-header">
            <div>
              <div class="bin-id">${bin.binId}</div>
              <div class="bin-address">📍 ${bin.location}</div>
            </div>
            ${isUrgent 
              ? `<span class="user-role-badge" style="background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border);">🚨 80%+ URGENT</span>`
              : `<span class="user-role-badge" style="background: var(--success-bg); color: var(--success); border: 1px solid var(--success-border);">NORMAL</span>`
            }
          </div>

          <!-- Dry Waste Compartment (Story 1) -->
          <div class="compartment-row">
            <div class="compartment-label">
              <span>Dry Waste</span>
              <span style="font-weight: 700;">${dry}%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${getBarClass(dry)}" style="width: ${dry}%;"></div>
            </div>
          </div>

          <!-- Wet Waste Compartment (Story 5) -->
          <div class="compartment-row">
            <div class="compartment-label">
              <span>Wet Waste</span>
              <span style="font-weight: 700;">${wet}%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${getBarClass(wet)}" style="width: ${wet}%;"></div>
            </div>
          </div>

          <!-- Metal Waste Compartment (Story 6) -->
          <div class="compartment-row">
            <div class="compartment-label">
              <span>Metal Waste</span>
              <span style="font-weight: 700;">${metal}%</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${getBarClass(metal)}" style="width: ${metal}%;"></div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 11px; color: var(--text-muted);">
            <span>🕒 Updated: ${new Date(bin.lastUpdated || bin.updatedAt || Date.now()).toLocaleTimeString()}</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-outline" onclick="app.emptyBin('${bin.binId}')">🧹 Empty</button>
              ${this.currentUser && this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin'
                ? `<button class="btn btn-sm btn-danger" onclick="app.deleteBin('${bin.binId}')">🗑️ Delete</button>`
                : ''
              }
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Trigger Red Urgent Alert Popup Modal (Story 8)
  triggerUrgentAlertModal(data) {
    document.getElementById('urgent-modal-location').innerText = data.location || 'Unknown Location';
    document.getElementById('urgent-modal-bin-id').innerText = data.binId || 'BIN';
    document.getElementById('urgent-modal-compartment').innerText = (data.compartment || 'Waste').toUpperCase();
    document.getElementById('urgent-modal-level').innerText = (data.fillLevel || 80) + '%';
    document.getElementById('urgent-modal-time').innerText = new Date(data.timestamp || Date.now()).toLocaleTimeString();

    document.getElementById('urgent-alert-modal').classList.add('open');
    this.playAlarmSound();
  },

  closeUrgentModal() {
    document.getElementById('urgent-alert-modal').classList.remove('open');
  },

  playAlarmSound() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, this.audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.4);
    } catch (e) {}
  },

  // SUPERADMIN: Create New Admin (Story 2)
  async handleCreateAdmin(e) {
    e.preventDefault();
    const firstName = document.getElementById('admin-first-name').value.trim();
    const lastName = document.getElementById('admin-last-name').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password })
      });

      const data = await res.json();
      if (res.ok) {
        // Display "Profile Successfully Created" message (Story 2)
        alert('Profile Successfully Created');
        document.getElementById('form-add-admin').reset();
        this.fetchSuperadminData();
      } else {
        alert(data.error || 'Failed to create admin profile');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  },

  async fetchSuperadminData() {
    try {
      const [adminsRes, logsRes] = await Promise.all([
        fetch('/api/auth/admins'),
        fetch('/api/auth/audit-logs')
      ]);

      if (adminsRes.ok) {
        this.admins = await adminsRes.json();
        this.renderAdminsTable();
      }
      if (logsRes.ok) {
        this.auditLogs = await logsRes.json();
        this.renderAuditLogsTable();
      }
    } catch (err) {
      console.warn('Superadmin data fetch warning:', err);
    }
  },

  renderAdminsTable() {
    const tbody = document.getElementById('admins-table-body');
    if (!tbody) return;

    if (!this.admins || this.admins.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No standard admins created yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.admins.map(admin => `
      <tr>
        <td><strong>${admin.fullName || admin.firstName + ' ' + admin.lastName}</strong></td>
        <td>${admin.email}</td>
        <td><code>@${admin.username}</code></td>
        <td>
          ${admin.isSuspended 
            ? `<span class="user-role-badge" style="background: var(--danger-bg); color: var(--danger);">SUSPENDED</span>`
            : `<span class="user-role-badge" style="background: var(--success-bg); color: var(--success);">ACTIVE</span>`
          }
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-outline" onclick="app.openResetModal('${admin._id}', '${admin.username}')">🔑 Password</button>
            <button class="btn btn-sm ${admin.isSuspended ? 'btn-success' : 'btn-warning'}" onclick="app.toggleSuspendAdmin('${admin._id}', '${admin.username}', ${admin.isSuspended})">
              ${admin.isSuspended ? 'Reactivate' : 'Suspend'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteAdmin('${admin._id}', '${admin.username}')">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderAuditLogsTable() {
    const tbody = document.getElementById('audit-logs-table-body');
    if (!tbody) return;

    if (!this.auditLogs || this.auditLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No audit log entries recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.auditLogs.map(log => `
      <tr>
        <td>${new Date(log.createdAt).toLocaleString()}</td>
        <td><strong style="color: var(--primary);">${log.action}</strong></td>
        <td><code>${log.targetItem}</code></td>
        <td>${log.details}</td>
      </tr>
    `).join('');
  },

  openResetModal(userId, username) {
    document.getElementById('reset-target-user-id').value = userId;
    document.getElementById('reset-target-username').value = username;
    document.getElementById('reset-new-pass').value = '';
    document.getElementById('reset-password-modal').classList.add('open');
  },

  async executePasswordReset(e) {
    e.preventDefault();
    const userId = document.getElementById('reset-target-user-id').value;
    const username = document.getElementById('reset-target-username').value;
    const newPassword = document.getElementById('reset-new-pass').value;

    try {
      const res = await fetch(`/api/auth/admins/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        document.getElementById('reset-password-modal').classList.remove('open');
        this.fetchSuperadminData();
      } else {
        alert(data.error || 'Failed to reset password');
      }
    } catch (err) {
      alert('Error resetting password');
    }
  },

  async toggleSuspendAdmin(userId, username, currentlySuspended) {
    const confirmAction = confirm(`Are you sure you want to ${currentlySuspended ? 'reactivate' : 'suspend'} admin '@${username}'?`);
    if (!confirmAction) return;

    try {
      const res = await fetch(`/api/auth/admins/${userId}/suspend`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        this.fetchSuperadminData();
      }
    } catch (err) {
      alert('Error updating admin status');
    }
  },

  async deleteAdmin(userId, username) {
    const confirmAction = confirm(`⚠️ PERMANENT ACTION: Are you sure you want to DELETE admin '@${username}'? This cannot be undone.`);
    if (!confirmAction) return;

    try {
      const res = await fetch(`/api/auth/admins/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        this.fetchSuperadminData();
      }
    } catch (err) {
      alert('Error deleting admin');
    }
  },

  // SUPERADMIN: Register New Bin (Story 4)
  async handleRegisterBin(e) {
    e.preventDefault();
    const binId = document.getElementById('reg-bin-id').value.trim();
    const location = document.getElementById('reg-bin-location').value.trim();
    const dry = document.getElementById('reg-bin-dry').value;
    const wet = document.getElementById('reg-bin-wet').value;
    const metal = document.getElementById('reg-bin-metal').value;

    try {
      const res = await fetch('/api/bins/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ binId, location, dry, wet, metal })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Bin Registered Successfully');
        document.getElementById('reg-bin-id').value = '';
        document.getElementById('reg-bin-location').value = '';
        this.fetchBins();
      } else {
        alert(data.error || 'Bin registration failed');
      }
    } catch (err) {
      alert('Error registering bin');
    }
  },

  async fetchAlerts() {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        this.alerts = await res.json();
        this.renderAlertsTable();
      }
    } catch (err) {
      console.warn('Error fetching alerts:', err);
    }
  },

  renderAlertsTable() {
    const tbody = document.getElementById('alerts-table-body');
    if (!tbody) return;

    if (!this.alerts || this.alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No 80%+ threshold alerts recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.alerts.map(alt => `
      <tr>
        <td>${new Date(alt.createdAt).toLocaleString()}</td>
        <td><code>${alt.binId}</code></td>
        <td>${alt.location}</td>
        <td><strong style="text-transform: uppercase;">${alt.compartment}</strong></td>
        <td><span style="color: var(--danger); font-weight: 700;">${alt.fillLevel}%</span></td>
        <td>
          ${alt.status === 'UNRESOLVED' 
            ? `<span class="user-role-badge" style="background: var(--danger-bg); color: var(--danger);">UNRESOLVED</span>`
            : (alt.status === 'ACKNOWLEDGED'
                ? `<span class="user-role-badge" style="background: var(--warning-bg); color: var(--warning);">ACKNOWLEDGED</span>`
                : `<span class="user-role-badge" style="background: var(--success-bg); color: var(--success);">RESOLVED</span>`)
          }
        </td>
        <td>
          ${alt.status === 'UNRESOLVED' 
            ? `<button class="btn btn-sm btn-outline" onclick="app.acknowledgeAlert('${alt._id}')">✓ Acknowledge</button>`
            : `<span>—</span>`
          }
        </td>
      </tr>
    `).join('');
  },

  async acknowledgeAlert(alertId) {
    try {
      const operatorName = this.currentUser ? this.currentUser.fullName || this.currentUser.username : 'Operator';
      const res = await fetch(`/api/bins/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName })
      });
      if (res.ok) {
        this.fetchAlerts();
      }
    } catch (err) {
      alert('Error acknowledging alert');
    }
  },

  async emptyBin(binId) {
    try {
      const res = await fetch(`/api/bins/${binId}/empty`, { method: 'POST' });
      if (res.ok) {
        this.fetchBins();
        this.fetchAlerts();
      }
    } catch (err) {
      alert('Error resetting bin level');
    }
  },

  async deleteBin(binId) {
    const confirmAction = confirm(`⚠️ Are you sure you want to DELETE bin '${binId}' from the database?`);
    if (!confirmAction) return;

    try {
      const res = await fetch(`/api/bins/${binId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        this.fetchBins();
        this.fetchAlerts();
      } else {
        alert(data.error || 'Failed to delete bin');
      }
    } catch (err) {
      alert('Error deleting bin');
    }
  },

  async sendSimulatedTelemetry() {
    const binId = document.getElementById('sim-bin-id').value.trim();
    const dry = Number(document.getElementById('sim-dry').value);
    const wet = Number(document.getElementById('sim-wet').value);
    const metal = Number(document.getElementById('sim-metal').value);

    try {
      const res = await fetch('/api/bins/esp32-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ binId, dry, wet, metal })
      });
      const data = await res.json();
      alert(data.message);
      this.fetchBins();
      this.fetchAlerts();
    } catch (err) {
      alert('Error sending hardware telemetry');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
