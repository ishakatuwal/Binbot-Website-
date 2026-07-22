/* ==========================================================================
   EcoPulse Smart Waste Management System - Main Entry Point & App Controller
   ========================================================================== */

import { store } from './mockData.js';
import { wsService } from './websocketService.js';
import { notificationManager } from './notifications.js';
import { SuperadminModule } from './superadmin.js';
import { AdminDashboardModule } from './adminDashboard.js';

class WasteManagementApp {
  constructor() {
    this.currentRole = 'superadmin'; // 'superadmin' or 'admin'
    this.superadminModule = null;
    this.adminModule = null;

    this.initRoleNavigation();
    this.initWebSocketSimulator();
    this.initModules();
    this.subscribeToEvents();
  }

  // Header role navigation (Superadmin Portal <-> Admin Dashboard)
  initRoleNavigation() {
    const navSuperadminBtn = document.getElementById('nav-superadmin');
    const navAdminBtn = document.getElementById('nav-admin');

    const viewSuperadmin = document.getElementById('view-superadmin');
    const viewAdmin = document.getElementById('view-admin');

    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-display-name');
    const userRole = document.getElementById('user-role-label');

    if (navSuperadminBtn && navAdminBtn) {
      navSuperadminBtn.addEventListener('click', () => {
        this.currentRole = 'superadmin';
        navSuperadminBtn.classList.add('active');
        navAdminBtn.classList.remove('active');

        viewSuperadmin.classList.add('active');
        viewAdmin.classList.remove('active');

        if (userAvatar) userAvatar.textContent = 'SA';
        if (userName) userName.textContent = 'Chief Administrator';
        if (userRole) userRole.textContent = 'Superadmin';
      });

      navAdminBtn.addEventListener('click', () => {
        this.currentRole = 'admin';
        navAdminBtn.classList.add('active');
        navSuperadminBtn.classList.remove('active');

        viewAdmin.classList.add('active');
        viewSuperadmin.classList.remove('active');

        if (userAvatar) userAvatar.textContent = 'AD';
        if (userName) userName.textContent = 'Sarah Jenkins';
        if (userRole) userRole.textContent = 'District Fleet Admin';
      });
    }
  }

  initModules() {
    this.superadminModule = new SuperadminModule();
    this.adminModule = new AdminDashboardModule();

    // Populate WebSocket Simulator Bin Selector
    this.populateSimulatorBinsDropdown();

    // Auto-connect simulation WS on startup
    wsService.connect();
  }

  /* ==========================================================================
     WebSocket Simulator Toolbar Controller
     ========================================================================== */
  initWebSocketSimulator() {
    const toggleWsBtn = document.getElementById('sim-ws-toggle');
    const triggerFullBtn = document.getElementById('sim-trigger-full-btn');
    const randomEventBtn = document.getElementById('sim-random-event-btn');

    // WS Connection Status Badge updates
    wsService.onStatusChange((status, isSimulating) => {
      const badge = document.getElementById('ws-status-badge');
      const statusText = document.getElementById('ws-status-text');

      if (badge && statusText) {
        if (status === 'connected') {
          badge.className = 'ws-badge connected';
          statusText.textContent = isSimulating ? 'WS Live (Simulated)' : 'WS Connected';
          if (toggleWsBtn) {
            toggleWsBtn.innerHTML = '<span class="dot-icon red"></span> Disconnect WS';
            toggleWsBtn.className = 'btn btn-danger btn-sm';
          }
        } else {
          badge.className = 'ws-badge disconnected';
          statusText.textContent = 'WS Offline';
          if (toggleWsBtn) {
            toggleWsBtn.innerHTML = '<span class="dot-icon green"></span> Connect WS';
            toggleWsBtn.className = 'btn btn-secondary btn-sm';
          }
        }
      }
    });

    if (toggleWsBtn) {
      toggleWsBtn.addEventListener('click', () => {
        wsService.toggleConnection();
      });
    }

    // Trigger Full-Bin Alert for Selected Bin & Compartment
    if (triggerFullBtn) {
      triggerFullBtn.addEventListener('click', () => {
        const binSelect = document.getElementById('sim-select-bin');
        const compSelect = document.getElementById('sim-select-compartment');

        const selectedBinId = binSelect ? binSelect.value : '';
        const selectedComp = compSelect ? compSelect.value : 'dry';

        if (!selectedBinId) {
          notificationManager.showToast('Please select a smart bin from the dropdown to trigger alert.', 'warning');
          return;
        }

        // Trigger real-time alert!
        const alertData = wsService.triggerFullBinAlert(selectedBinId, selectedComp, 96);
        if (alertData) {
          notificationManager.showToast(`🚨 Full-bin event pushed via WebSocket for ${alertData.bin.serial}!`, 'error');
        }
      });
    }

    // Trigger Random Event
    if (randomEventBtn) {
      randomEventBtn.addEventListener('click', () => {
        if (store.bins.length === 0) return;
        const randomBin = store.bins[Math.floor(Math.random() * store.bins.length)];
        const comps = ['dry', 'wet', 'metal'];
        const randomComp = comps[Math.floor(Math.random() * comps.length)];

        wsService.triggerFullBinAlert(randomBin.id, randomComp, 98);
      });
    }
  }

  populateSimulatorBinsDropdown() {
    const select = document.getElementById('sim-select-bin');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select Bin to Trigger Alert --</option>' +
      store.bins.map(b => `<option value="${b.id}">${b.serial} - ${b.location.substring(0, 30)}...</option>`).join('');
  }

  subscribeToEvents() {
    // Listen for WebSocket Full-Bin Alerts
    wsService.onEvent((event) => {
      if (event.type === 'FULL_BIN_ALERT') {
        notificationManager.addAlert(event.data);
      }
    });

    // Re-populate sim dropdown when bins are added
    store.subscribe(() => {
      this.populateSimulatorBinsDropdown();
    });
  }

  // Global window action handlers
  emptyBin(binId) {
    const updatedBin = store.emptyBin(binId);
    if (updatedBin) {
      notificationManager.showToast(`✨ Smart Bin ${updatedBin.serial} emptied and reset to 10%.`, 'success');
    }
  }

  triggerUrgentModalForBin(binId) {
    const targetBin = store.bins.find(b => b.id === binId || b.serial === binId);
    if (!targetBin) return;

    // Find highest compartment
    let highestComp = 'dry';
    let highestVal = targetBin.fillLevels.dry || 0;

    if ((targetBin.fillLevels.wet || 0) > highestVal) {
      highestComp = 'wet';
      highestVal = targetBin.fillLevels.wet;
    }
    if ((targetBin.fillLevels.metal || 0) > highestVal) {
      highestComp = 'metal';
      highestVal = targetBin.fillLevels.metal;
    }

    notificationManager.openUrgentModal({
      bin: targetBin,
      location: targetBin.location,
      compartment: highestComp,
      fillLevel: highestVal,
      timestamp: new Date().toLocaleTimeString()
    });
  }
}

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new WasteManagementApp();
});
