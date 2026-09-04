// Binbot ESP32 IoT Enterprise Frontend Engine & Task Dispatch System

const app = {
  currentUser: null,
  activeTab: 'home',
  bins: [],
  alerts: [],
  admins: [],
  staff: [],
  tasks: [],
  auditLogs: [],
  socket: null,
  audioCtx: null,
  map: null,
  markers: [],

  // Custom Toast Notification System (Replaces browser native domain alerts)
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // Custom Corporate Confirmation Modal (Replaces browser native confirm domain header)
  showConfirmModal(message, onConfirm) {
    const msgEl = document.getElementById('confirm-modal-message');
    if (!msgEl) {
      onConfirm();
      return;
    }

    msgEl.innerText = message;
    const yesBtn = document.getElementById('btn-confirm-yes');
    
    // Replace element listener cleanly
    const newBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newBtn, yesBtn);
    
    newBtn.addEventListener('click', () => {
      this.closeConfirmModal();
      onConfirm();
    });

    document.getElementById('confirm-modal').classList.add('open');
  },

  closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('open');
  },

  init() {
    this.initSocket();

    // Check existing user session
    const savedUser = localStorage.getItem('smartbin_user');
    if (savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        // Check 30-minute inactivity session expiration (Story 3)
        if (userObj.sessionExpiresAt && Date.now() > userObj.sessionExpiresAt) {
          this.showToast('Session Expired: You have been logged out due to 30 minutes of inactivity.', 'error');
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
        this.fetchStaff();
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
        console.log('Connected to Socket.io real-time server with ID:', this.socket.id);
      });

      // Listen for urgent_bin_full threshold event (Story 8)
      this.socket.on('urgent_bin_full', (data) => {
        console.log('URGENT ALARM RECEIVED VIA SOCKET.IO:', data);
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
        this.showToast('Session Timeout: Logged out after 30 minutes of inactivity.', 'error');
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
        this.showToast(`Welcome, ${data.user.fullName || data.user.username}!`, 'success');
        return;
      } else {
        // Display "Credentials Invalid" error toast (Story 3)
        this.showToast(data.error || 'Credentials Invalid', 'error');
      }
    } catch (err) {
      this.showToast('Credentials Invalid: Unable to connect to authentication server', 'error');
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
    badge.innerText = isSuperadmin ? 'SUPERADMIN' : 'ADMIN';
    badge.className = `user-role-badge ${isSuperadmin ? 'superadmin' : 'admin'}`;

    // Role Scoping (Stories 10, 15, 17): Role separation between Superadmin and Admin
    const superadminGroup = document.getElementById('superadmin-nav-group');
    const quickAdminBtn = document.getElementById('btn-quick-admin-nav');
    const navAlerts = document.getElementById('nav-link-alerts');
    const quickAlertsBtn = document.getElementById('btn-quick-alerts-nav');

    if (isSuperadmin) {
      if (superadminGroup) superadminGroup.style.display = 'block';
      if (quickAdminBtn) quickAdminBtn.style.display = 'inline-flex';
      // Hide Alerts & Tasks from Superadmin Dashboard
      if (navAlerts) navAlerts.style.display = 'none';
      if (quickAlertsBtn) quickAlertsBtn.style.display = 'none';
      if (this.activeTab === 'alerts') this.switchTab('home');
      this.fetchSuperadminData();
    } else {
      if (superadminGroup) superadminGroup.style.display = 'none';
      if (quickAdminBtn) quickAdminBtn.style.display = 'none';
      if (navAlerts) navAlerts.style.display = 'flex';
      if (quickAlertsBtn) quickAlertsBtn.style.display = 'inline-flex';
      // If Admin tries to access Superadmin tab directly, redirect to Home (Story 17)
      if (this.activeTab === 'admin-management' || this.activeTab === 'bin-registration') {
        this.switchTab('home');
      }
    }

    this.refreshAll();
  },

  switchTab(tabId) {
    const isSuperadmin = this.currentUser && this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin';

    // Role Enforcement (Story 17): Prevent Superadmin from accessing Alerts & Tasks and Admins from Superadmin pages
    if (tabId === 'alerts' && isSuperadmin) {
      this.showToast('Access Denied: Alerts & Tasks management is for standard Admins.', 'error');
      this.switchTab('home');
      return;
    }

    if ((tabId === 'admin-management' || tabId === 'bin-registration') && !isSuperadmin) {
      this.showToast('Access Denied: You must be a Superadmin to access this page.', 'error');
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
      map: 'Google Map View & Geolocation Pins',
      alerts: 'Hardware Overflow Alerts & Task Assignments',
      staff: 'Waste Collection Staff Management',
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
    if (tabId === 'map') this.renderGoogleMap();
    if (tabId === 'alerts') this.fetchAlerts();
    if (tabId === 'staff') this.fetchStaff();
    if (tabId === 'admin-management' && isSuperadmin) this.fetchSuperadminData();
  },

  refreshAll() {
    this.fetchBins();
    this.fetchAlerts();
    this.fetchStaff();
    if (this.currentUser && this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin') {
      this.fetchSuperadminData();
    }
  },

  downloadPdfReport() {
    // Download PDF Report (Story 22)
    window.open('/api/reports/pdf', '_blank');
  },

  async fetchBins() {
    try {
      const res = await fetch('/api/bins');
      if (res.ok) {
        this.bins = await res.json();
        this.renderBins();
        this.updateHomeStats();
        if (this.activeTab === 'map') this.renderGoogleMap();
      }
    } catch (err) {
      console.warn('Error fetching bins:', err);
    }
  },

  updateHomeStats() {
    const totalBinsEl = document.getElementById('stat-total-bins');
    const urgentBinsEl = document.getElementById('stat-urgent-bins');
    const totalStaffEl = document.getElementById('stat-total-staff');

    if (totalBinsEl) totalBinsEl.innerText = this.bins.length;
    if (totalStaffEl) totalStaffEl.innerText = this.staff.length;

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
      container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted); grid-column: 1/-1;">No smart bins active in database.</div>`;
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
              <div class="bin-address">Address: ${bin.location}</div>
            </div>
            ${isUrgent 
              ? `<span class="user-role-badge" style="background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border);">80%+ OVERFLOW</span>`
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
            <span>Updated: ${new Date(bin.lastUpdated || bin.updatedAt || Date.now()).toLocaleTimeString()}</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-primary" onclick="app.openAssignTaskModal('${bin.binId}', 'dry')">Assign Task</button>
              <button class="btn btn-sm btn-outline" onclick="app.emptyBin('${bin.binId}')">Empty</button>
              ${this.currentUser && this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin'
                ? `<button class="btn btn-sm btn-danger" onclick="app.deleteBin('${bin.binId}')">Delete</button>`
                : ''
              }
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Live Interactive Map Engine (Story 23)
  renderGoogleMap() {
    const mapEl = document.getElementById('google-map');
    if (!mapEl) return;

    if (!window.L) {
      mapEl.innerHTML = `<div style="padding: 20px; text-align: center;">Loading interactive map engine...</div>`;
      return;
    }

    if (!this.map) {
      mapEl.innerHTML = '';
      this.map = L.map('google-map').setView([-33.8688, 151.2093], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);
    } else {
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 200);
    }

    // Clear existing markers
    if (this.markers) {
      this.markers.forEach(m => this.map.removeLayer(m));
    }
    this.markers = [];

    if (!this.bins || this.bins.length === 0) {
      return;
    }

    const bounds = [];

    this.bins.forEach(bin => {
      const lat = bin.latitude !== undefined ? Number(bin.latitude) : -33.8688;
      const lng = bin.longitude !== undefined ? Number(bin.longitude) : 151.2093;
      bounds.push([lat, lng]);

      const dry = bin.compartments?.dry || 0;
      const wet = bin.compartments?.wet || 0;
      const metal = bin.compartments?.metal || 0;
      const maxFill = Math.max(dry, wet, metal);
      const isUrgent = maxFill >= 80;

      // Create interactive marker (Orange marker for 80%+ capacity bins, Green for normal)
      const marker = L.circleMarker([lat, lng], {
        color: isUrgent ? '#ea580c' : '#059669',
        fillColor: isUrgent ? '#ea580c' : '#059669',
        fillOpacity: 0.85,
        radius: isUrgent ? 12 : 9
      }).addTo(this.map);

      const popupContent = `
        <div style="font-family: Inter, sans-serif; padding: 4px; width: 200px;">
          <div style="font-weight: 800; font-size: 14px; color: #0f172a; margin-bottom: 2px;">${bin.binId}</div>
          <div style="font-size: 11px; color: #64748b;">${bin.location}</div>
          <div style="margin-top: 6px; font-size: 12px; font-weight: 700; color: ${isUrgent ? '#ea580c' : '#059669'};">
            ${isUrgent ? 'ORANGE ALERT: ' + maxFill + '% Capacity' : 'NORMAL: ' + maxFill + '% Capacity'}
          </div>
          <button class="btn btn-sm btn-primary" style="margin-top: 8px; width: 100%;" onclick="app.openAssignTaskModal('${bin.binId}', 'dry')">Assign Task</button>
        </div>
      `;

      marker.bindPopup(popupContent);
      this.markers.push(marker);
    });

    if (bounds.length > 0) {
      this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  },

  // Trigger Red 100% Urgent Alert Popup Modal (Story 8, 21)
  triggerUrgentAlertModal(data) {
    document.getElementById('urgent-modal-location').innerText = data.location || 'Unknown Location';
    document.getElementById('urgent-modal-bin-id').innerText = data.binId || 'BIN';
    document.getElementById('urgent-modal-compartment').innerText = (data.compartment || 'Waste').toUpperCase();
    document.getElementById('urgent-modal-level').innerText = (data.fillLevel || 80) + '%';
    document.getElementById('urgent-modal-time').innerText = new Date(data.timestamp || Date.now()).toLocaleTimeString();

    // Store data on popup modal button
    const assignBtn = document.getElementById('btn-modal-assign-task');
    if (assignBtn) {
      assignBtn.setAttribute('data-bin-id', data.binId);
      assignBtn.setAttribute('data-compartment', data.compartment);
      assignBtn.setAttribute('data-alert-id', data.alertId || '');
    }

    document.getElementById('urgent-alert-modal').classList.add('open');
    this.playAlarmSound();
  },

  closeUrgentModal() {
    document.getElementById('urgent-alert-modal').classList.remove('open');
  },

  openAssignTaskModalFromUrgent() {
    const assignBtn = document.getElementById('btn-modal-assign-task');
    const binId = assignBtn.getAttribute('data-bin-id');
    const compartment = assignBtn.getAttribute('data-compartment');
    const alertId = assignBtn.getAttribute('data-alert-id');
    this.closeUrgentModal();
    this.openAssignTaskModal(binId, compartment, alertId);
  },

  // Open Task Assignment Modal (Stories 19, 20, 21)
  async openAssignTaskModal(binId, compartment, alertId = '') {
    document.getElementById('assign-target-bin-id').value = binId;
    document.getElementById('assign-target-compartment').value = compartment;
    document.getElementById('assign-target-alert-id').value = alertId;
    document.getElementById('assign-target-details').value = `Bin ${binId} (${(compartment || 'DRY').toUpperCase()} compartment)`;

    // Populate staff dropdown
    const select = document.getElementById('assign-staff-select');
    select.innerHTML = '<option value="">-- Select Staff Member --</option>';

    await this.fetchStaff();

    if (this.staff.length === 0) {
      select.innerHTML += '<option value="" disabled>No staff members registered. Please register staff in Staff Management tab.</option>';
    } else {
      this.staff.forEach(s => {
        select.innerHTML += `<option value="${s._id}">${s.fullName} (${s.phone}) - ${s.status}</option>`;
      });
    }

    document.getElementById('assign-task-modal').classList.add('open');
  },

  // Execute Task Assignment (Stories 20, 21)
  async executeAssignTask(e) {
    e.preventDefault();
    const staffId = document.getElementById('assign-staff-select').value;
    const binId = document.getElementById('assign-target-bin-id').value;
    const compartment = document.getElementById('assign-target-compartment').value;
    const alertId = document.getElementById('assign-target-alert-id').value;

    if (!staffId) {
      this.showToast('Please select a staff member to assign.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/tasks/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, binId, compartment, alertId })
      });

      const data = await res.json();
      if (res.ok) {
        this.showToast(data.message || 'Task Assigned Successfully', 'success');
        document.getElementById('assign-task-modal').classList.remove('open');
        this.fetchBins();
        this.fetchAlerts();
        this.fetchStaff();
      } else {
        this.showToast(data.error || 'Failed to assign task', 'error');
      }
    } catch (err) {
      this.showToast('Error connecting to task assignment server', 'error');
    }
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

  // STAFF MANAGEMENT (Story 18)
  async fetchStaff() {
    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        this.staff = await res.json();
        this.renderStaffTable();
        this.updateHomeStats();
      }
    } catch (err) {
      console.warn('Error fetching staff:', err);
    }
  },

  async handleRegisterStaff(e) {
    e.preventDefault();
    const firstName = document.getElementById('staff-first-name').value.trim();
    const lastName = document.getElementById('staff-last-name').value.trim();
    const rawPhone = document.getElementById('staff-phone').value.trim();

    if (!firstName || !lastName) {
      this.showToast('Please enter both First Name and Last Name.', 'error');
      return;
    }

    const digitsOnly = rawPhone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      this.showToast('Invalid Phone: Phone number must be exactly 10 digits (e.g. 0414972400).', 'error');
      return;
    }

    try {
      const res = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone: digitsOnly })
      });

      const data = await res.json();
      if (res.ok) {
        // Display custom toast notification (No browser domain title) (Story 18)
        this.showToast(data.message || 'Staff Member Registered Successfully', 'success');
        document.getElementById('staff-first-name').value = '';
        document.getElementById('staff-last-name').value = '';
        document.getElementById('staff-phone').value = '';
        this.fetchStaff();
      } else {
        this.showToast(data.error || 'Failed to register staff member', 'error');
      }
    } catch (err) {
      this.showToast('Error registering staff member', 'error');
    }
  },

  renderStaffTable() {
    const tbody = document.getElementById('staff-table-body');
    if (!tbody) return;

    if (!this.staff || this.staff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No staff members registered in database.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.staff.map(s => `
      <tr>
        <td><strong>${s.fullName || s.firstName + ' ' + s.lastName}</strong></td>
        <td><code>${s.phone}</code></td>
        <td><span class="user-role-badge admin">Staff</span></td>
        <td>
          <span class="user-role-badge" style="background: ${s.status === 'ASSIGNED' ? 'var(--warning-bg)' : 'var(--success-bg)'}; color: ${s.status === 'ASSIGNED' ? 'var(--warning)' : 'var(--success)'};">
            ${s.status}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="app.deleteStaff('${s._id}', '${s.fullName || s.firstName}')">Remove</button>
        </td>
      </tr>
    `).join('');
  },

  deleteStaff(staffId, name) {
    this.showConfirmModal(`Are you sure you want to remove staff member '${name}'?`, async () => {
      try {
        const res = await fetch(`/api/staff/${staffId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
          this.showToast(data.message || 'Staff member removed', 'success');
          this.fetchStaff();
        } else {
          this.showToast(data.error || 'Failed to remove staff member', 'error');
        }
      } catch (err) {
        this.showToast('Error removing staff member', 'error');
      }
    });
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
        // Display "Profile Successfully Created" success toast (Story 2)
        this.showToast('Profile Successfully Created', 'success');
        document.getElementById('form-add-admin').reset();
        this.fetchSuperadminData();
      } else {
        this.showToast(data.error || 'Failed to create admin profile', 'error');
      }
    } catch (err) {
      this.showToast('Error connecting to server', 'error');
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
            <button class="btn btn-sm btn-outline" onclick="app.openResetModal('${admin._id}', '${admin.username}')">Reset Password</button>
            <button class="btn btn-sm ${admin.isSuspended ? 'btn-success' : 'btn-warning'}" onclick="app.toggleSuspendAdmin('${admin._id}', '${admin.username}', ${admin.isSuspended})">
              ${admin.isSuspended ? 'Reactivate' : 'Suspend'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteAdmin('${admin._id}', '${admin.username}')">Delete</button>
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
        this.showToast(data.message, 'success');
        document.getElementById('reset-password-modal').classList.remove('open');
        this.fetchSuperadminData();
      } else {
        this.showToast(data.error || 'Failed to reset password', 'error');
      }
    } catch (err) {
      this.showToast('Error resetting password', 'error');
    }
  },

  toggleSuspendAdmin(userId, username, currentlySuspended) {
    this.showConfirmModal(`Are you sure you want to ${currentlySuspended ? 'reactivate' : 'suspend'} admin '@${username}'?`, async () => {
      try {
        const res = await fetch(`/api/auth/admins/${userId}/suspend`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          this.showToast(data.message, 'success');
          this.fetchSuperadminData();
        }
      } catch (err) {
        this.showToast('Error updating admin status', 'error');
      }
    });
  },

  deleteAdmin(userId, username) {
    this.showConfirmModal(`PERMANENT ACTION: Are you sure you want to DELETE admin '@${username}'? This cannot be undone.`, async () => {
      try {
        const res = await fetch(`/api/auth/admins/${userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
          this.showToast(data.message, 'success');
          this.fetchSuperadminData();
        }
      } catch (err) {
        this.showToast('Error deleting admin', 'error');
      }
    });
  },

  async handleRegisterBin(e) {
    e.preventDefault();
    const binId = document.getElementById('reg-bin-id').value.trim();
    const location = document.getElementById('reg-bin-location').value.trim();
    const latitude = document.getElementById('reg-bin-lat').value;
    const longitude = document.getElementById('reg-bin-lng').value;
    const dry = document.getElementById('reg-bin-dry').value;
    const wet = document.getElementById('reg-bin-wet').value;
    const metal = document.getElementById('reg-bin-metal').value;

    try {
      const res = await fetch('/api/bins/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ binId, location, latitude, longitude, dry, wet, metal })
      });
      const data = await res.json();
      if (res.ok) {
        this.showToast(data.message || 'Bin Registered Successfully', 'success');
        document.getElementById('reg-bin-id').value = '';
        document.getElementById('reg-bin-location').value = '';
        this.fetchBins();
      } else {
        this.showToast(data.error || 'Bin registration failed', 'error');
      }
    } catch (err) {
      this.showToast('Error registering bin', 'error');
    }
  },

  alertFilter: 'active', // 'active' | 'completed' | 'all'

  setAlertFilter(filter) {
    this.alertFilter = filter;
    
    // Update button visual styles
    const btnActive = document.getElementById('alert-filter-active');
    const btnCompleted = document.getElementById('alert-filter-completed');
    const btnAll = document.getElementById('alert-filter-all');
    
    if (btnActive) btnActive.className = filter === 'active' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
    if (btnCompleted) btnCompleted.className = filter === 'completed' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
    if (btnAll) btnAll.className = filter === 'all' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
    
    this.renderAlertsTable();
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

    if (!this.alerts) this.alerts = [];

    // Calculate Counts for Filter Badges
    const activeAlerts = this.alerts.filter(alt => alt.status !== 'RESOLVED' && alt.status !== 'COMPLETED');
    const completedAlerts = this.alerts.filter(alt => alt.status === 'RESOLVED' || alt.status === 'COMPLETED');
    const allAlerts = this.alerts;

    const countActiveEl = document.getElementById('count-active-alerts');
    const countCompletedEl = document.getElementById('count-completed-alerts');
    const countAllEl = document.getElementById('count-all-alerts');

    if (countActiveEl) countActiveEl.innerText = activeAlerts.length;
    if (countCompletedEl) countCompletedEl.innerText = completedAlerts.length;
    if (countAllEl) countAllEl.innerText = allAlerts.length;

    // Filter list according to current tab selection (Acceptance Criteria 7 & 8)
    let displayList = activeAlerts;
    if (this.alertFilter === 'completed') {
      displayList = completedAlerts;
    } else if (this.alertFilter === 'all') {
      displayList = allAlerts;
    }

    if (displayList.length === 0) {
      const msg = this.alertFilter === 'completed'
        ? 'No completed alerts found in history.'
        : (this.alertFilter === 'active'
            ? '✅ No active alerts. All collection tasks are completed and cleared.'
            : 'No alerts recorded in database.');
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">${msg}</td></tr>`;
      return;
    }

    tbody.innerHTML = displayList.map(alt => {
      const isCompleted = alt.status === 'COMPLETED' || alt.status === 'RESOLVED';
      const isAssigned = alt.isAssigned || alt.status === 'ASSIGNED';

      let statusBadge = '';
      if (isCompleted) {
        statusBadge = `
          <div>
            <span class="user-role-badge" style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
              ✓ COMPLETED
            </span>
            ${alt.completedAt ? `<div style="font-size: 10px; color: #64748b; margin-top: 3px;">By: ${alt.completedBy || 'Admin'}<br>${new Date(alt.completedAt).toLocaleString()}</div>` : ''}
          </div>
        `;
      } else if (isAssigned) {
        statusBadge = `<span class="user-role-badge" style="background: var(--primary-light); color: var(--primary); font-weight: 600;">ASSIGNED: ${alt.assignedStaffName || 'Staff'}</span>`;
      } else if (alt.status === 'ACKNOWLEDGED') {
        statusBadge = `<span class="user-role-badge" style="background: var(--warning-bg); color: var(--warning);">ACKNOWLEDGED</span>`;
      } else {
        statusBadge = `<span class="user-role-badge" style="background: var(--danger-bg); color: var(--danger); font-weight: 700;">UNRESOLVED</span>`;
      }

      let actionButtons = '';
      if (isCompleted) {
        actionButtons = `<span style="font-size: 11px; color: #059669; font-weight: 700;">✓ Archived</span>`;
      } else if (isAssigned) {
        actionButtons = `
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn btn-sm btn-outline" style="background: #f1f5f9; color: #475569; border-color: #cbd5e1; cursor: default;" disabled>Assigned</button>
            <button class="btn btn-sm" style="background: #10b981; color: #ffffff; border: none; font-weight: 700; border-radius: 6px; padding: 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" onclick="app.confirmCompleteAlert('${alt._id}', '${alt.taskId || ''}', '${alt.binId}', '${alt.compartment}')">
              ✓ Completed
            </button>
          </div>
        `;
      } else {
        actionButtons = `
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="btn btn-sm btn-primary" onclick="app.openAssignTaskModal('${alt.binId}', '${alt.compartment}', '${alt._id}')">Assign Task</button>
            ${alt.status === 'UNRESOLVED' ? `<button class="btn btn-sm btn-outline" onclick="app.acknowledgeAlert('${alt._id}')">Acknowledge</button>` : ''}
          </div>
        `;
      }

      return `
        <tr style="${isCompleted ? 'background: rgba(240, 253, 244, 0.4);' : ''}">
          <td>${new Date(alt.createdAt).toLocaleString()}</td>
          <td><code>${alt.binId}</code></td>
          <td>${alt.location}</td>
          <td><strong style="text-transform: uppercase;">${alt.compartment}</strong></td>
          <td><span style="color: ${isCompleted ? '#059669' : 'var(--danger)'}; font-weight: 700;">${isCompleted ? '0% (Cleared)' : alt.fillLevel + '%'}</span></td>
          <td>${statusBadge}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    }).join('');
  },

  // Confirmation dialog before completing (Acceptance Criteria 5)
  confirmCompleteAlert(alertId, taskId, binId, compartment) {
    const binLabel = `Bin ${binId} (${(compartment || 'Waste').toUpperCase()} compartment)`;
    this.showConfirmModal(`Are you sure you want to mark this alert for ${binLabel} as completed?`, async () => {
      await this.executeCompleteTask({ alertId, taskId, binId, compartment });
    });
  },

  // Execute Task and Alert Completion (Acceptance Criteria 3, 4, 9)
  async executeCompleteTask({ alertId, taskId, binId, compartment }) {
    try {
      const adminName = this.currentUser ? (this.currentUser.fullName || this.currentUser.username) : 'Admin';
      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, taskId, binId, compartment, completedBy: adminName, adminName })
      });

      const data = await res.json();
      if (res.ok) {
        this.showToast(data.message || 'Alert and task marked as COMPLETED!', 'success');
        this.fetchAlerts();
        this.fetchBins();
        this.fetchStaff();
        if (this.activeTab === 'map') this.renderGoogleMap();
      } else {
        this.showToast(data.error || 'Failed to complete task', 'error');
      }
    } catch (err) {
      this.showToast('Error connecting to server', 'error');
    }
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
      this.showToast('Error acknowledging alert', 'error');
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
      this.showToast('Error resetting bin level', 'error');
    }
  },

  deleteBin(binId) {
    this.showConfirmModal(`Are you sure you want to DELETE bin '${binId}' from the database?`, async () => {
      try {
        const res = await fetch(`/api/bins/${binId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
          this.showToast(data.message, 'success');
          this.fetchBins();
          this.fetchAlerts();
        } else {
          this.showToast(data.error || 'Failed to delete bin', 'error');
        }
      } catch (err) {
        this.showToast('Error deleting bin', 'error');
      }
    });
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
      this.showToast(data.message, 'success');
      this.fetchBins();
      this.fetchAlerts();
    } catch (err) {
      this.showToast('Error sending hardware telemetry', 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
