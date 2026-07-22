/* ==========================================================================
   EcoPulse Smart Waste Management System - Superadmin Portal Module
   ========================================================================== */

import { store } from './mockData.js';
import { notificationManager } from './notifications.js';

export class SuperadminModule {
  constructor() {
    this.initSubtabNavigation();
    this.initAdminRegistrationForm();
    this.initBinRegistrationForm();
    this.initPasswordRecoveryGateway();
    this.initAdminDirectory();
  }

  // Subtab switching inside Superadmin Portal (Admin Reg, Bin Reg, Pwd Recovery, Admin List)
  initSubtabNavigation() {
    const subtabs = document.querySelectorAll('.subnav-tabs .subtab');
    subtabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.subtab;
        
        // Active tab highlight
        subtabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show target content pane
        document.querySelectorAll('.subtab-content').forEach(pane => {
          pane.classList.remove('active');
        });

        const targetPane = document.getElementById(`subtab-${targetTab}`);
        if (targetPane) {
          targetPane.classList.add('active');
        }
      });
    });
  }

  /* ==========================================================================
     1. Admin Registration Form
     ========================================================================== */
  initAdminRegistrationForm() {
    const form = document.getElementById('admin-registration-form');
    const pwdInput = document.getElementById('admin-password');
    const pwdBar = document.getElementById('pwd-strength-bar');

    if (pwdInput && pwdBar) {
      pwdInput.addEventListener('input', () => {
        const val = pwdInput.value;
        pwdBar.className = 'strength-bar';
        if (val.length === 0) return;
        if (val.length < 6) {
          pwdBar.classList.add('weak');
        } else if (val.length < 10 || !/\d/.test(val)) {
          pwdBar.classList.add('medium');
        } else {
          pwdBar.classList.add('strong');
        }
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Clear previous error messages
        this.clearErrors(['admin-fullname', 'admin-email', 'admin-role', 'admin-zone', 'admin-password', 'admin-confirm-pwd']);

        const name = document.getElementById('admin-fullname').value.trim();
        const email = document.getElementById('admin-email').value.trim();
        const role = document.getElementById('admin-role').value;
        const zone = document.getElementById('admin-zone').value;
        const pwd = document.getElementById('admin-password').value;
        const confirmPwd = document.getElementById('admin-confirm-pwd').value;

        let valid = true;

        if (!name) {
          this.setError('admin-fullname', 'Full name is required.');
          valid = false;
        }

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
          this.setError('admin-email', 'Please enter a valid email address.');
          valid = false;
        }

        if (!role) {
          this.setError('admin-role', 'Please select an operational role.');
          valid = false;
        }

        if (!zone) {
          this.setError('admin-zone', 'Please assign a sector zone.');
          valid = false;
        }

        if (!pwd || pwd.length < 8) {
          this.setError('admin-password', 'Password must be at least 8 characters long.');
          valid = false;
        }

        if (pwd !== confirmPwd) {
          this.setError('admin-confirm-pwd', 'Passwords do not match.');
          valid = false;
        }

        if (!valid) return;

        // Create Admin in store
        const newAdmin = store.addAdmin({
          name,
          email,
          role,
          zone
        });

        notificationManager.showToast(`✅ Administrator ${newAdmin.name} registered successfully!`, 'success');
        form.reset();
        if (pwdBar) pwdBar.className = 'strength-bar';

        // Refresh admin directory table & quick stats
        this.renderAdminDirectory();
        this.updateSuperadminStats();
      });
    }
  }

  /* ==========================================================================
     2. Smart Bin Registration Form
     ========================================================================== */
  initBinRegistrationForm() {
    const form = document.getElementById('bin-registration-form');

    // Range Sliders Sync
    ['dry', 'wet', 'metal'].forEach(comp => {
      const slider = document.getElementById(`bin-fill-${comp}`);
      const valDisplay = document.getElementById(`val-${comp}`);
      if (slider && valDisplay) {
        slider.addEventListener('input', () => {
          valDisplay.textContent = slider.value;
        });
      }
    });

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.clearErrors(['bin-serial', 'bin-location', 'bin-zone', 'bin-coords']);

        const serial = document.getElementById('bin-serial').value.trim();
        const location = document.getElementById('bin-location').value.trim();
        const zone = document.getElementById('bin-zone').value;
        const coords = document.getElementById('bin-coords').value.trim();

        const capDry = parseInt(document.getElementById('bin-cap-dry').value) || 120;
        const capWet = parseInt(document.getElementById('bin-cap-wet').value) || 100;
        const capMetal = parseInt(document.getElementById('bin-cap-metal').value) || 80;

        const fillDry = parseInt(document.getElementById('bin-fill-dry').value) || 0;
        const fillWet = parseInt(document.getElementById('bin-fill-wet').value) || 0;
        const fillMetal = parseInt(document.getElementById('bin-fill-metal').value) || 0;

        let valid = true;

        if (!serial) {
          this.setError('bin-serial', 'Bin Hardware ID is required.');
          valid = false;
        }

        if (!location) {
          this.setError('bin-location', 'Location address is required.');
          valid = false;
        }

        if (!zone) {
          this.setError('bin-zone', 'Please select a sector zone.');
          valid = false;
        }

        if (!coords) {
          this.setError('bin-coords', 'GPS Coordinates are required.');
          valid = false;
        }

        if (!valid) return;

        // Register Bin in Store
        const newBin = store.addBin({
          serial,
          location,
          zone,
          coords,
          capacities: { dry: capDry, wet: capWet, metal: capMetal },
          fillLevels: { dry: fillDry, wet: fillWet, metal: fillMetal }
        });

        notificationManager.showToast(`✅ Smart Bin Unit ${newBin.serial} deployed successfully!`, 'success');
        form.reset();

        // Reset range value displays
        document.getElementById('val-dry').textContent = '25';
        document.getElementById('val-wet').textContent = '40';
        document.getElementById('val-metal').textContent = '15';

        this.updateSuperadminStats();
      });
    }
  }

  /* ==========================================================================
     3. Password Recovery Gateway
     ========================================================================== */
  initPasswordRecoveryGateway() {
    const step1Form = document.getElementById('recovery-step1-form');
    const step2Form = document.getElementById('recovery-step2-form');
    const step3Form = document.getElementById('recovery-step3-form');
    const successPane = document.getElementById('recovery-success-pane');

    const node1 = document.getElementById('step-node-1');
    const node2 = document.getElementById('step-node-2');
    const node3 = document.getElementById('step-node-3');

    let targetEmail = '';

    // Step 1: Submit Email
    if (step1Form) {
      step1Form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.clearErrors(['rec-email']);
        const email = document.getElementById('rec-email').value.trim();

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
          this.setError('rec-email', 'Enter a valid administrator email.');
          return;
        }

        targetEmail = email;
        document.getElementById('display-target-email').textContent = email;

        // Transition to Step 2
        step1Form.classList.remove('active');
        step2Form.classList.add('active');
        node1.classList.remove('active');
        node2.classList.add('active');

        notificationManager.showToast(`🔑 Verification OTP sent to ${email} (Demo: 884920)`, 'info');
      });
    }

    // OTP Input auto-focus logic
    const otpInputs = document.querySelectorAll('.otp-inputs .otp-digit');
    otpInputs.forEach((input, index) => {
      input.addEventListener('input', () => {
        if (input.value && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          otpInputs[index - 1].focus();
        }
      });
    });

    // Step 2: Verify OTP Code
    if (step2Form) {
      step2Form.addEventListener('submit', (e) => {
        e.preventDefault();
        const errSpan = document.getElementById('err-rec-otp');
        errSpan.textContent = '';

        const enteredOtp = Array.from(otpInputs).map(i => i.value).join('');

        if (enteredOtp !== '884920' && enteredOtp.length !== 6) {
          errSpan.textContent = 'Invalid OTP security code. Please use demo code 884920.';
          return;
        }

        // Transition to Step 3
        step2Form.classList.remove('active');
        step3Form.classList.add('active');
        node2.classList.remove('active');
        node3.classList.add('active');
      });
    }

    // Back to Step 1
    const backBtn = document.getElementById('btn-back-step1');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        step2Form.classList.remove('active');
        step1Form.classList.add('active');
        node2.classList.remove('active');
        node1.classList.add('active');
      });
    }

    // Step 3: Reset Password
    if (step3Form) {
      step3Form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.clearErrors(['rec-new-pwd', 'rec-confirm-pwd']);

        const newPwd = document.getElementById('rec-new-pwd').value;
        const confirmPwd = document.getElementById('rec-confirm-pwd').value;

        if (!newPwd || newPwd.length < 8) {
          this.setError('rec-new-pwd', 'New password must be at least 8 characters.');
          return;
        }

        if (newPwd !== confirmPwd) {
          this.setError('rec-confirm-pwd', 'Passwords do not match.');
          return;
        }

        // Transition to Success
        step3Form.classList.remove('active');
        successPane.classList.add('active');

        notificationManager.showToast('🎉 Password reset successfully completed!', 'success');
      });
    }

    // Reset Gateway Workflow
    const resetGatewayBtn = document.getElementById('btn-reset-gateway');
    if (resetGatewayBtn) {
      resetGatewayBtn.addEventListener('click', () => {
        successPane.classList.remove('active');
        step1Form.classList.add('active');
        node3.classList.remove('active');
        node1.classList.add('active');
        step1Form.reset();
        step2Form.reset();
        step3Form.reset();
      });
    }
  }

  /* ==========================================================================
     4. Admin Directory Table Rendering
     ========================================================================== */
  initAdminDirectory() {
    this.renderAdminDirectory();
    this.updateSuperadminStats();

    const refreshBtn = document.getElementById('refresh-admins-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.renderAdminDirectory();
        this.updateSuperadminStats();
        notificationManager.showToast('Administrator directory refreshed.', 'info');
      });
    }
  }

  renderAdminDirectory() {
    const tbody = document.getElementById('admins-table-body');
    if (!tbody) return;

    tbody.innerHTML = store.admins.map(admin => `
      <tr>
        <td><strong>${admin.name}</strong></td>
        <td class="text-muted">${admin.email}</td>
        <td><span class="spec-label">${admin.role}</span></td>
        <td>${admin.zone}</td>
        <td><span class="status-badge active">${admin.status}</span></td>
        <td class="font-mono text-muted">${admin.registeredAt}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="alert('Admin privileges active for ${admin.name}')">
            Manage
          </button>
        </td>
      </tr>
    `).join('');
  }

  updateSuperadminStats() {
    const totalAdminsEl = document.getElementById('stat-total-admins');
    const totalBinsEl = document.getElementById('stat-total-bins');

    if (totalAdminsEl) totalAdminsEl.textContent = store.admins.length;
    if (totalBinsEl) totalBinsEl.textContent = store.bins.length;
  }

  // Error Utilities
  setError(inputId, message) {
    const errorSpan = document.getElementById(`err-${inputId}`);
    const input = document.getElementById(inputId);
    if (errorSpan) errorSpan.textContent = message;
    if (input) input.classList.add('error');
  }

  clearErrors(inputIds) {
    inputIds.forEach(id => {
      const errorSpan = document.getElementById(`err-${id}`);
      const input = document.getElementById(id);
      if (errorSpan) errorSpan.textContent = '';
      if (input) input.classList.remove('error');
    });
  }
}
