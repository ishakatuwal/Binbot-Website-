/* ==========================================================================
   EcoPulse Smart Waste Management System - Notifications & Urgent Red Modal
   ========================================================================== */

import { store } from './mockData.js';

class NotificationManager {
  constructor() {
    this.alerts = [];
    this.activeModalAlert = null;
    this.audioCtx = null;
    
    // DOM Cache
    this.bellBtn = document.getElementById('notification-bell-btn');
    this.bellBadge = document.getElementById('notification-count');
    this.dropdown = document.getElementById('notification-dropdown');
    this.dropdownList = document.getElementById('dropdown-alert-list');
    this.clearAllBtn = document.getElementById('clear-all-alerts-btn');

    // Modal DOM Cache
    this.modal = document.getElementById('urgent-alert-modal');
    this.modalCloseX = document.getElementById('modal-close-x');
    this.modalTitle = document.getElementById('urgent-modal-title');
    this.modalBinSerial = document.getElementById('urgent-bin-serial');
    this.modalLocation = document.getElementById('urgent-bin-location');
    this.modalCompartment = document.getElementById('urgent-bin-compartment');
    this.modalFillLevel = document.getElementById('urgent-bin-fill-level');
    this.modalTimestamp = document.getElementById('urgent-bin-timestamp');
    this.modalDispatchBtn = document.getElementById('urgent-dispatch-btn');
    this.modalAckBtn = document.getElementById('urgent-acknowledge-btn');

    this.initEvents();
  }

  initEvents() {
    // Bell click opens dropdown or active modal
    if (this.bellBtn) {
      this.bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.alerts.length > 0) {
          // If alerts exist, display urgent modal for latest alert
          this.openUrgentModal(this.alerts[0]);
        } else {
          // Toggle dropdown if empty
          this.toggleDropdown();
        }
      });
    }

    // Clear all alerts
    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', () => {
        this.clearAllAlerts();
      });
    }

    // Close Modal Controls
    if (this.modalCloseX) {
      this.modalCloseX.addEventListener('click', () => this.closeModal());
    }

    if (this.modalAckBtn) {
      this.modalAckBtn.addEventListener('click', () => {
        this.closeModal();
        this.showToast('Alert acknowledged by supervisor.', 'info');
      });
    }

    if (this.modalDispatchBtn) {
      this.modalDispatchBtn.addEventListener('click', () => {
        if (this.activeModalAlert) {
          // Empty bin upon dispatch
          store.emptyBin(this.activeModalAlert.bin.id);
          this.showToast(`🚛 Dispatch truck assigned to ${this.activeModalAlert.location}!`, 'success');
          this.removeAlert(this.activeModalAlert.id);
          this.closeModal();
        }
      });
    }

    // Close modal when clicking backdrop
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.dropdown && !this.dropdown.classList.contains('hidden')) {
        if (!this.dropdown.contains(e.target) && !this.bellBtn.contains(e.target)) {
          this.dropdown.classList.add('hidden');
        }
      }
    });
  }

  // Handle incoming Full-Bin Alert from WebSocket
  addAlert(alertPayload) {
    const alertItem = {
      id: `ALT-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      bin: alertPayload.bin,
      location: alertPayload.location || alertPayload.bin.location,
      compartment: (alertPayload.compartment || 'dry').toLowerCase(), // 'dry', 'wet', or 'metal'
      fillLevel: alertPayload.fillLevel || 95,
      timestamp: alertPayload.timestamp || new Date().toLocaleTimeString(),
      read: false
    };

    // Unshift to top of alerts list
    this.alerts.unshift(alertItem);

    // Update UI badge & bell animation
    this.updateBellUI();

    // Play alert chime audio
    this.playAudioAlert();

    // Show toast message
    this.showToast(`🚨 Urgent: ${alertItem.compartment.toUpperCase()} compartment full at ${alertItem.location}!`, 'error');

    // Automatically pop open urgent alert modal popup!
    this.openUrgentModal(alertItem);
  }

  updateBellUI() {
    const unreadCount = this.alerts.length;
    
    if (unreadCount > 0) {
      this.bellBadge.textContent = unreadCount;
      this.bellBadge.classList.remove('hidden');
      this.bellBtn.classList.add('ringing');
    } else {
      this.bellBadge.classList.add('hidden');
      this.bellBtn.classList.remove('ringing');
    }

    this.renderDropdownList();
  }

  toggleDropdown() {
    if (this.dropdown) {
      this.dropdown.classList.toggle('hidden');
    }
  }

  renderDropdownList() {
    if (!this.dropdownList) return;

    if (this.alerts.length === 0) {
      this.dropdownList.innerHTML = '<div class="empty-alerts">No active urgent alerts. System normal.</div>';
      return;
    }

    this.dropdownList.innerHTML = this.alerts.map(alt => `
      <div class="dropdown-item urgent" data-id="${alt.id}">
        <!-- STRICT RED FONT MESSAGE IN DROPDOWN TOO -->
        <div class="item-msg font-strictly-red">Urgent Bin is filled and need to be collected</div>
        <div class="item-meta">
          <span>📍 ${alt.location}</span>
          <span class="compartment-pill ${alt.compartment}">${alt.compartment.toUpperCase()}</span>
        </div>
      </div>
    `).join('');

    // Attach click listeners to items
    this.dropdownList.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const targetAlert = this.alerts.find(a => a.id === id);
        if (targetAlert) {
          this.dropdown.classList.add('hidden');
          this.openUrgentModal(targetAlert);
        }
      });
    });
  }

  /* ==========================================================================
     STRICT REQUIREMENT IMPLEMENTATION:
     Opens Popup Modal reading "Urgent Bin is filled and need to be collected"
     in strictly red font, explicitly displaying the bin's location and specific compartment.
     ========================================================================== */
  openUrgentModal(alertData) {
    this.activeModalAlert = alertData;

    // 1. Ensure modal title has STRICTLY RED FONT class and exact text
    this.modalTitle.className = 'urgent-alert-message font-strictly-red';
    this.modalTitle.textContent = 'Urgent Bin is filled and need to be collected';

    // 2. Explicit Bin Serial
    this.modalBinSerial.textContent = alertData.bin.serial || alertData.bin.id;

    // 3. Explicit Bin Location
    this.modalLocation.textContent = alertData.location;

    // 4. Explicit Specific Compartment (dry, wet, or metal)
    const compName = (alertData.compartment || 'dry').toUpperCase();
    this.modalCompartment.className = `detail-value compartment-pill ${alertData.compartment.toLowerCase()}`;
    this.modalCompartment.textContent = `${compName} COMPARTMENT`;

    // 5. Fill level and timestamp
    this.modalFillLevel.textContent = `${alertData.fillLevel}% Capacity`;
    this.modalTimestamp.textContent = alertData.timestamp;

    // Show modal
    this.modal.classList.remove('hidden');
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }

  removeAlert(alertId) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.updateBellUI();
  }

  clearAllAlerts() {
    this.alerts = [];
    this.updateBellUI();
    this.showToast('All alert notifications cleared.', 'info');
  }

  // Synthesize soft warning audio beep using Web Audio API
  playAudioAlert() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, this.audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio playback blocked by browser autoplay policy
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'error' ? '🚨' : type === 'success' ? '✅' : 'ℹ️'}</span>
      <div>${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

export const notificationManager = new NotificationManager();
