// SmartBin ESP32 IoT Mobile Web Application Frontend Engine

const app = {
  currentUser: null,
  activeTab: 'dashboard',
  bins: [],
  alerts: [],
  admins: [],
  passwordRequests: [],
  audioCtx: null,
  isServerConnected: true,

  init() {
    // Initializing Local Data Storage Fallback
    this.initLocalStorage();

    // Check if user session exists in localStorage
    const savedUser = localStorage.getItem('smartbin_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.onLoginSuccess();
      } catch (e) {
        this.showAuthModal();
      }
    } else {
      this.showAuthModal();
    }

    // Attach event listener for logout
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());

    // Start live auto-polling every 3 seconds
    setInterval(() => {
      if (this.currentUser) {
        this.fetchBins();
        if (this.currentUser.role === 'superadmin') {
          this.fetchSuperadminData();
        }
      }
    }, 3000);
  },

  // Initialize offline / client-side storage defaults if server is offline
  initLocalStorage() {
    if (!localStorage.getItem('ls_users')) {
      const initialUsers = [
        { id: 'usr_super', username: 'superadmin', password: 'admin123password', role: 'superadmin', name: 'System Superadmin', email: 'superadmin@smartbin.io', status: 'approved', createdAt: new Date().toISOString() },
        { id: 'usr_admin1', username: 'admin_john', password: 'password123', role: 'admin', name: 'John Doe (City Ops)', email: 'john@smartbin.io', status: 'approved', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: 'usr_admin2', username: 'admin_sarah', password: 'password123', role: 'admin', name: 'Sarah Smith (Park Sector)', email: 'sarah@smartbin.io', status: 'pending_approval', createdAt: new Date(Date.now() - 3600000).toISOString() }
      ];
      localStorage.setItem('ls_users', JSON.stringify(initialUsers));
    }

    if (!localStorage.getItem('ls_bins')) {
      const initialBins = [
        { id: 'BIN-01', name: 'Central Park North Bin', location: 'Sector A - Main Entrance', fill_level: 84, battery: 92, last_updated: new Date().toISOString(), status: 'CRITICAL_ALERT' },
        { id: 'BIN-02', name: 'Market Street Hub Bin', location: 'Downtown Plaza #4', fill_level: 45, battery: 88, last_updated: new Date().toISOString(), status: 'NORMAL' },
        { id: 'BIN-03', name: 'University Library East Bin', location: 'Campus Walkway Gate 2', fill_level: 78, battery: 95, last_updated: new Date().toISOString(), status: 'WARNING' },
        { id: 'BIN-04', name: 'Metro Station West Bin', location: 'Subway Exit 3', fill_level: 89, battery: 74, last_updated: new Date().toISOString(), status: 'CRITICAL_ALERT' }
      ];
      localStorage.setItem('ls_bins', JSON.stringify(initialBins));
    }

    if (!localStorage.getItem('ls_alerts')) {
      const initialAlerts = [
        { id: 'alt_101', bin_id: 'BIN-01', bin_name: 'Central Park North Bin', fill_level: 84, timestamp: new Date(Date.now() - 900000).toISOString(), status: 'UNRESOLVED', message: 'ALERT: Bin level exceeded 82% threshold (84% Full)' },
        { id: 'alt_102', bin_id: 'BIN-04', bin_name: 'Metro Station West Bin', fill_level: 89, timestamp: new Date(Date.now() - 300000).toISOString(), status: 'UNRESOLVED', message: 'ALERT: Bin level exceeded 82% threshold (89% Full)' }
      ];
      localStorage.setItem('ls_alerts', JSON.stringify(initialAlerts));
    }

    if (!localStorage.getItem('ls_requests')) {
      const initialReqs = [
        { id: 'req_1', username: 'admin_sarah', userEmail: 'sarah@smartbin.io', requestDate: new Date(Date.now() - 1800000).toISOString(), status: 'pending', reason: 'Forgot password after mobile browser reset' }
      ];
      localStorage.setItem('ls_requests', JSON.stringify(initialReqs));
    }
  },

  // Audio Synthesizer Alarm Chime for 82%+ Fill Threshold Alerts
  playAlertSound() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5 note
      osc1.frequency.exponentialRampToValueAtTime(1200, this.audioCtx.currentTime + 0.3);

      osc2.frequency.setValueAtTime(440, this.audioCtx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(600, this.audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(this.audioCtx.currentTime + 0.4);
      osc2.stop(this.audioCtx.currentTime + 0.4);
    } catch (err) {
      console.log('Audio playback prevented or unsupported:', err);
    }
  },

  // AUTHENTICATION UI
  showAuthModal() {
    document.getElementById('auth-modal').classList.add('open');
  },

  hideAuthModal() {
    document.getElementById('auth-modal').classList.remove('open');
  },

  showAuthTab(tab) {
    document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('form-forgot').style.display = tab === 'forgot' ? 'block' : 'none';

    const titleMap = {
      login: '🔐 System Login',
      register: '📝 Register New Admin Account',
      forgot: '🔑 Admin Password Recovery'
    };
    document.getElementById('auth-modal-title').innerText = titleMap[tab];
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    // Try Server API first
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        localStorage.setItem('smartbin_user', JSON.stringify(data.user));
        this.hideAuthModal();
        this.onLoginSuccess();
        return;
      } else {
        const data = await res.json();
        alert(data.error || 'Login failed');
        return;
      }
    } catch (err) {
      // Offline / LocalStorage mode fallback
      const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

      if (!user || user.password !== password) {
        alert('Invalid username or password');
        return;
      }

      if (user.role === 'admin') {
        if (user.status === 'pending_approval') {
          alert('Your account is pending Superadmin approval. Please contact Superadmin to approve access.');
          return;
        }
        if (user.status === 'rejected') {
          alert('Account access rejected by Superadmin.');
          return;
        }
      }

      this.currentUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      };
      localStorage.setItem('smartbin_user', JSON.stringify(this.currentUser));
      this.hideAuthModal();
      this.onLoginSuccess();
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, username, password })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Registration submitted successfully!');
        this.showAuthTab('login');
        document.getElementById('login-username').value = username;
        return;
      } else {
        alert(data.error || 'Registration failed');
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
      if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        alert('Username already exists');
        return;
      }

      const newAdmin = {
        id: `usr_${Date.now()}`,
        username,
        password,
        role: 'admin',
        name,
        email,
        status: 'pending_approval',
        createdAt: new Date().toISOString()
      };

      users.push(newAdmin);
      localStorage.setItem('ls_users', JSON.stringify(users));

      alert('Registration submitted successfully! Your account is now pending Superadmin approval.');
      this.showAuthTab('login');
      document.getElementById('login-username').value = username;
    }
  },

  async handleForgotPassword(e) {
    e.preventDefault();
    const username = document.getElementById('forgot-username').value.trim();
    const reason = document.getElementById('forgot-reason').value.trim();

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, reason })
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        this.showAuthTab('login');
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        alert('Username not found in system');
        return;
      }

      const reqs = JSON.parse(localStorage.getItem('ls_requests') || '[]');
      reqs.unshift({
        id: `req_${Date.now()}`,
        username: user.username,
        userEmail: user.email,
        requestDate: new Date().toISOString(),
        status: 'pending',
        reason: reason || 'Password recovery requested'
      });
      localStorage.setItem('ls_requests', JSON.stringify(reqs));

      alert('Password recovery request sent to Superadmin profile! Superadmin will reset your password shortly.');
      this.showAuthTab('login');
    }
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('smartbin_user');
    this.showAuthModal();
    this.showAuthTab('login');
  },

  onLoginSuccess() {
    const isSuperadmin = this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin';
    const badge = document.getElementById('user-role-badge');
    badge.innerText = isSuperadmin ? '👑 Superadmin' : '🛡️ Admin';
    badge.className = `role-tag ${isSuperadmin ? 'superadmin' : 'admin'}`;

    const superadminTab = document.getElementById('nav-superadmin');
    if (isSuperadmin) {
      if (superadminTab) superadminTab.style.display = 'flex';
      this.fetchSuperadminData();
    } else {
      if (superadminTab) superadminTab.style.display = 'none';
      if (this.activeTab === 'superadmin') {
        this.switchTab('dashboard');
      }
    }

    this.fetchBins();
    this.fetchAlerts();
  },

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const isSuperadmin = this.currentUser.role && this.currentUser.role.toLowerCase() === 'superadmin';

    const targetView = document.getElementById(`view-${tabId}`);
    const targetNav = document.getElementById(`nav-${tabId}`);
    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    if (tabId === 'superadmin' && isSuperadmin) {
      this.fetchSuperadminData();
    } else if (tabId === 'dashboard') {
      this.fetchBins();
    } else if (tabId === 'alerts') {
      this.fetchAlerts();
    }
  },

  async fetchBins() {
    try {
      const res = await fetch('/api/bins');
      if (res.ok) {
        this.bins = await res.json();
        this.renderBins();
        this.checkThresholdAlerts();
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      this.bins = JSON.parse(localStorage.getItem('ls_bins') || '[]');
      this.renderBins();
      this.checkThresholdAlerts();
    }
  },

  renderBins() {
    const container = document.getElementById('bins-container');
    if (!this.bins || this.bins.length === 0) {
      container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">No smart bins active.</div>`;
      return;
    }

    container.innerHTML = this.bins.map(bin => {
      const isCritical = bin.fill_level >= 82;
      const isWarning = bin.fill_level >= 70 && !isCritical;
      
      let barColor = 'var(--success)';
      let statusLabel = 'NORMAL';
      let statusClass = 'normal';

      if (isCritical) {
        barColor = 'var(--danger)';
        statusLabel = 'CRITICAL ALERT (≥ 82%)';
        statusClass = 'critical';
      } else if (isWarning) {
        barColor = 'var(--warning)';
        statusLabel = 'HIGH FILL (≥ 70%)';
        statusClass = 'warning';
      }

      return `
        <div class="card ${isCritical ? 'critical-border' : ''}">
          <div class="bin-header">
            <div>
              <div class="bin-id-title">${bin.name || bin.binId}</div>
              <div class="bin-location">📍 ${bin.location} • ID: <code>${bin.binId || bin.id}</code></div>
            </div>
            <span class="bin-status-pill ${statusClass}">${statusLabel}</span>
          </div>

          <div class="gauge-container">
            <div class="gauge-label-row">
              <span>Capacity Level</span>
              <span style="color: ${barColor}; font-weight: 700;">${bin.fill_level || 0}%</span>
            </div>
            <div class="gauge-bar-bg">
              <div class="gauge-threshold-line"></div>
              <div class="gauge-bar-fill" style="width: ${bin.fill_level || 0}%; background-color: ${barColor};"></div>
            </div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; text-align: right;">
              Threshold Marker: <strong style="color: var(--danger);">82%</strong>
            </div>
          </div>

          <div class="bin-footer">
            <div>
              <span>🔋 Battery: <b>${bin.battery || 100}%</b></span> • 
              <span>🕒 ${new Date(bin.last_updated || bin.lastUpdated || Date.now()).toLocaleTimeString()}</span>
            </div>
            <div>
              ${isCritical 
                ? `<button class="btn btn-sm btn-danger" onclick="app.emptyBin('${bin.binId || bin.id}')">🧹 Mark Emptied</button>`
                : `<button class="btn btn-sm btn-outline" onclick="app.emptyBin('${bin.binId || bin.id}')">Reset Level</button>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  checkThresholdAlerts() {
    const criticalBins = this.bins.filter(b => b.fill_level >= 82);
    const banner = document.getElementById('alert-banner');
    const bannerText = document.getElementById('alert-banner-detail');

    if (criticalBins.length > 0) {
      const highest = criticalBins.sort((a, b) => b.fill_level - a.fill_level)[0];
      bannerText.innerText = `🚨 ${criticalBins.length} Bin(s) reached 82%+ capacity! Highest: ${highest.name || highest.binId} (${highest.fill_level}% Full)`;
      
      if (!banner.classList.contains('active')) {
        banner.classList.add('active');
        this.playAlertSound();
      }
    } else {
      banner.classList.remove('active');
    }
  },

  async emptyBin(binId) {
    try {
      const res = await fetch(`/api/bins/${binId}/empty`, { method: 'POST' });
      if (res.ok) {
        this.fetchBins();
        this.fetchAlerts();
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      const bins = JSON.parse(localStorage.getItem('ls_bins') || '[]');
      const bin = bins.find(b => b.id === binId || b.binId === binId);
      if (bin) {
        bin.fill_level = 0;
        bin.status = 'NORMAL';
        bin.last_updated = new Date().toISOString();
        localStorage.setItem('ls_bins', JSON.stringify(bins));
      }

      const alerts = JSON.parse(localStorage.getItem('ls_alerts') || '[]');
      alerts.forEach(a => {
        if (a.bin_id === binId && a.status === 'UNRESOLVED') {
          a.status = 'RESOLVED';
        }
      });
      localStorage.setItem('ls_alerts', JSON.stringify(alerts));

      this.fetchBins();
      this.fetchAlerts();
    }
  },

  async fetchSuperadminData() {
    try {
      const [adminsRes, reqsRes] = await Promise.all([
        fetch('/api/auth/admins'),
        fetch('/api/auth/password-requests')
      ]);

      if (adminsRes.ok && reqsRes.ok) {
        this.admins = await adminsRes.json();
        this.passwordRequests = await reqsRes.json();
        this.renderSuperadminPanel();
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
      this.admins = users.filter(u => u.role === 'admin' || u.role === 'Admin');
      this.passwordRequests = JSON.parse(localStorage.getItem('ls_requests') || '[]');
      this.renderSuperadminPanel();
    }
  },

  renderSuperadminPanel() {
    // 1. Pending Admins
    const pendingList = document.getElementById('pending-admins-list');
    const pendingAdmins = this.admins.filter(a => a.status === 'pending_approval');

    if (pendingAdmins.length === 0) {
      pendingList.innerHTML = `<div style="font-size: 12px; color: var(--text-muted);">No pending admin approvals. All accounts clear!</div>`;
    } else {
      pendingList.innerHTML = pendingAdmins.map(admin => {
        const id = admin._id || admin.id;
        const name = admin.fullName || admin.name || admin.username;
        return `
        <div class="admin-user-card">
          <div class="admin-info">
            <span class="admin-name">${name}</span>
            <span class="admin-username">@${admin.username} • ${admin.email}</span>
            <span style="font-size: 10px; color: var(--warning); margin-top: 2px;">Status: ${admin.status}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-success" onclick="app.approveAdmin('${id}')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="app.rejectAdmin('${id}')">Reject</button>
          </div>
        </div>
      `;
      }).join('');
    }

    // 2. Password Requests
    const reqsList = document.getElementById('password-requests-list');
    const pendingReqs = this.passwordRequests.filter(r => r.status === 'pending');

    if (pendingReqs.length === 0) {
      reqsList.innerHTML = `<div style="font-size: 12px; color: var(--text-muted);">No password reset requests pending.</div>`;
    } else {
      reqsList.innerHTML = pendingReqs.map(req => `
        <div class="admin-user-card" style="border-color: rgba(96, 165, 250, 0.4);">
          <div class="admin-info">
            <span class="admin-name">User: @${req.username}</span>
            <span class="admin-username">Reason: ${req.reason}</span>
            <span style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Requested: ${new Date(req.requestDate).toLocaleTimeString()}</span>
          </div>
          <button class="btn btn-sm btn-primary" onclick="app.openResetModal('${req.id}', '${req.username}')">🔑 Reset Password</button>
        </div>
      `).join('');
    }

    // 3. Approved Admins Directory
    const approvedList = document.getElementById('approved-admins-list');
    const approvedAdmins = this.admins.filter(a => a.status === 'approved');

    approvedList.innerHTML = approvedAdmins.map(admin => `
      <div class="admin-user-card">
        <div class="admin-info">
          <span class="admin-name">${admin.fullName || admin.name || admin.username}</span>
          <span class="admin-username">@${admin.username} • ${admin.email}</span>
        </div>
        <span class="status-badge approved">Approved</span>
      </div>
    `).join('');
  },

  async handleRegisterBin(e) {
    e.preventDefault();
    const binId = document.getElementById('new-bin-id').value.trim();
    const location = document.getElementById('new-bin-location').value.trim();
    const dry = document.getElementById('new-bin-dry').value;
    const wet = document.getElementById('new-bin-wet').value;
    const metal = document.getElementById('new-bin-metal').value;

    try {
      const res = await fetch('/api/bins/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ binId, location, dry, wet, metal })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Smart bin registered successfully in MongoDB!');
        document.getElementById('new-bin-id').value = '';
        document.getElementById('new-bin-location').value = '';
        this.fetchBins();
        return;
      } else {
        alert(data.error || 'Failed to register bin');
        return;
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  },

  async approveAdmin(adminId) {
    try {
      const res = await fetch(`/api/auth/admins/${adminId}/approve`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        this.fetchSuperadminData();
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
      const admin = users.find(u => u.id === adminId || u._id === adminId);
      if (admin) {
        admin.status = 'approved';
        localStorage.setItem('ls_users', JSON.stringify(users));
        alert(`Admin ${admin.username} approved successfully!`);
        this.fetchSuperadminData();
      }
    }
  },

  async rejectAdmin(adminId) {
    try {
      const res = await fetch(`/api/auth/admins/${adminId}/reject`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        this.fetchSuperadminData();
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
      const admin = users.find(u => u.id === adminId || u._id === adminId);
      if (admin) {
        admin.status = 'rejected';
        localStorage.setItem('ls_users', JSON.stringify(users));
        alert(`Admin ${admin.username} rejected.`);
        this.fetchSuperadminData();
      }
    }
  },

  openResetModal(requestId, username) {
    document.getElementById('reset-ticket-id').value = requestId;
    document.getElementById('reset-target-user').value = username;
    document.getElementById('reset-new-password').value = '';
    document.getElementById('reset-modal').classList.add('open');
  },

  async executeSuperadminReset(e) {
    e.preventDefault();
    const ticketId = document.getElementById('reset-ticket-id').value;
    const username = document.getElementById('reset-target-user').value;
    const newPassword = document.getElementById('reset-new-password').value;

    try {
      const res = await fetch(`/api/superadmin/password-requests/${ticketId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        document.getElementById('reset-modal').classList.remove('open');
        this.fetchSuperadminData();
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
      const admin = users.find(u => u.username === username);
      if (admin) {
        admin.password = newPassword;
        localStorage.setItem('ls_users', JSON.stringify(users));
      }

      const reqs = JSON.parse(localStorage.getItem('ls_requests') || '[]');
      const reqItem = reqs.find(r => r.id === ticketId);
      if (reqItem) {
        reqItem.status = 'resolved';
        localStorage.setItem('ls_requests', JSON.stringify(reqs));
      }

      alert(`Password for ${username} reset successfully to '${newPassword}'`);
      document.getElementById('reset-modal').classList.remove('open');
      this.fetchSuperadminData();
    }
  },

  async fetchAlerts() {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        this.alerts = await res.json();
        this.renderAlerts();
        return;
      }
    } catch (err) {
      // LocalStorage Fallback
      this.alerts = JSON.parse(localStorage.getItem('ls_alerts') || '[]');
      this.renderAlerts();
    }
  },

  renderAlerts() {
    const container = document.getElementById('alerts-container');
    if (!this.alerts || this.alerts.length === 0) {
      container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">No 82%+ threshold alerts recorded.</div>`;
      return;
    }

    container.innerHTML = this.alerts.map(alt => `
      <div class="card" style="border-left: 4px solid ${alt.status === 'UNRESOLVED' ? 'var(--danger)' : 'var(--success)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 700; font-size: 14px;">${alt.bin_name} (${alt.bin_id})</div>
            <div style="font-size: 12px; color: var(--danger); font-weight: 600; margin-top: 2px;">${alt.message}</div>
          </div>
          <span class="status-badge ${alt.status === 'UNRESOLVED' ? 'rejected' : 'approved'}">${alt.status}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
          🕒 ${new Date(alt.timestamp).toLocaleString()}
        </div>
      </div>
    `).join('');
  },

  async sendSimulatedTelemetry() {
    const bin_id = document.getElementById('sim-bin-select').value;
    const fill_level = Number(document.getElementById('sim-fill-slider').value);

    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bin_id, fill_level, battery: 95 })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.alert_triggered) this.playAlertSound();
        alert(data.message);
        this.fetchBins();
        this.fetchAlerts();
        return;
      }
    } catch (err) {
      // LocalStorage Fallback Simulation
      const bins = JSON.parse(localStorage.getItem('ls_bins') || '[]');
      let bin = bins.find(b => b.id === bin_id);
      if (bin) {
        bin.fill_level = fill_level;
        bin.last_updated = new Date().toISOString();
        if (fill_level >= 82) bin.status = 'CRITICAL_ALERT';
        else if (fill_level >= 70) bin.status = 'WARNING';
        else bin.status = 'NORMAL';
        localStorage.setItem('ls_bins', JSON.stringify(bins));
      }

      let isAlert = fill_level >= 82;
      if (isAlert) {
        const alerts = JSON.parse(localStorage.getItem('ls_alerts') || '[]');
        alerts.unshift({
          id: `alt_${Date.now()}`,
          bin_id: bin_id,
          bin_name: bin ? bin.name : bin_id,
          fill_level: fill_level,
          timestamp: new Date().toISOString(),
          status: 'UNRESOLVED',
          message: `ALERT: Bin level reached 82%+ threshold (${fill_level}% Full)`
        });
        localStorage.setItem('ls_alerts', JSON.stringify(alerts));
        this.playAlertSound();
        alert(`CRITICAL ALERT! Telemetry sent. Fill level is ${fill_level}% (>= 82% threshold). Notification triggered!`);
      } else {
        alert(`Telemetry sent. Fill level updated to ${fill_level}%`);
      }

      this.fetchBins();
      this.fetchAlerts();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
