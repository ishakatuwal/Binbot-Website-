/* ==========================================================================
   EcoPulse Smart Waste Management System - Admin Fleet Monitoring Module
   ========================================================================== */

import { store } from './mockData.js';
import { wsService } from './websocketService.js';
import { notificationManager } from './notifications.js';

export class AdminDashboardModule {
  constructor() {
    this.currentViewMode = 'grid'; // 'grid' or 'table'
    this.searchQuery = '';
    this.selectedZone = 'all';
    this.selectedStatus = 'all';

    this.initControls();
    this.renderFleet();
    this.subscribeToUpdates();
  }

  initControls() {
    // Search input listener
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderFleet();
      });
    }

    // Zone filter listener
    const zoneSelect = document.getElementById('filter-zone');
    if (zoneSelect) {
      zoneSelect.addEventListener('change', (e) => {
        this.selectedZone = e.target.value;
        this.renderFleet();
      });
    }

    // Status filter listener
    const statusSelect = document.getElementById('filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.selectedStatus = e.target.value;
        this.renderFleet();
      });
    }

    // View Mode Toggle (Grid vs Table)
    const gridBtn = document.getElementById('btn-view-grid');
    const tableBtn = document.getElementById('btn-view-table');

    if (gridBtn && tableBtn) {
      gridBtn.addEventListener('click', () => {
        this.currentViewMode = 'grid';
        gridBtn.classList.add('active');
        tableBtn.classList.remove('active');
        document.getElementById('bins-grid-container').classList.remove('hidden');
        document.getElementById('bins-table-container').classList.add('hidden');
        this.renderFleet();
      });

      tableBtn.addEventListener('click', () => {
        this.currentViewMode = 'table';
        tableBtn.classList.add('active');
        gridBtn.classList.remove('active');
        document.getElementById('bins-grid-container').classList.add('hidden');
        document.getElementById('bins-table-container').classList.remove('hidden');
        this.renderFleet();
      });
    }
  }

  subscribeToUpdates() {
    // Re-render fleet whenever store state updates or WebSocket emits telemetry
    store.subscribe(() => this.renderFleet());
    
    wsService.onEvent((event) => {
      if (event.type === 'BIN_UPDATE' || event.type === 'FULL_BIN_ALERT') {
        this.renderFleet();
      }
    });
  }

  // Filter logic for registered bins
  getFilteredBins() {
    return store.bins.filter(bin => {
      // 1. Search Query
      const matchesSearch = !this.searchQuery || 
        bin.serial.toLowerCase().includes(this.searchQuery) ||
        bin.location.toLowerCase().includes(this.searchQuery) ||
        bin.zone.toLowerCase().includes(this.searchQuery);

      // 2. Zone Filter
      const matchesZone = this.selectedZone === 'all' || bin.zone === this.selectedZone;

      // 3. Status Filter (highest compartment fill determines status)
      const maxFill = Math.max(bin.fillLevels.dry || 0, bin.fillLevels.wet || 0, bin.fillLevels.metal || 0);
      let status = 'normal';
      if (maxFill >= 90) status = 'urgent';
      else if (maxFill >= 70) status = 'warning';

      const matchesStatus = this.selectedStatus === 'all' || this.selectedStatus === status;

      return matchesSearch && matchesZone && matchesStatus;
    });
  }

  renderFleet() {
    const bins = this.getFilteredBins();
    this.updateFleetSummaryStats();

    if (this.currentViewMode === 'grid') {
      this.renderGrid(bins);
    } else {
      this.renderTable(bins);
    }
  }

  updateFleetSummaryStats() {
    let normalCount = 0;
    let warningCount = 0;
    let urgentCount = 0;

    store.bins.forEach(bin => {
      const maxFill = Math.max(bin.fillLevels.dry || 0, bin.fillLevels.wet || 0, bin.fillLevels.metal || 0);
      if (maxFill >= 90) urgentCount++;
      else if (maxFill >= 70) warningCount++;
      else normalCount++;
    });

    const normalEl = document.getElementById('stat-normal-bins');
    const warningEl = document.getElementById('stat-warning-bins');
    const urgentEl = document.getElementById('stat-urgent-bins');

    if (normalEl) normalEl.textContent = normalCount;
    if (warningEl) warningEl.textContent = warningCount;
    if (urgentEl) urgentEl.textContent = urgentCount;
  }

  renderGrid(bins) {
    const container = document.getElementById('bins-grid-container');
    if (!container) return;

    if (bins.length === 0) {
      container.innerHTML = `
        <div class="card glass-card text-center" style="grid-column: 1 / -1; padding: 3rem;">
          <h3 class="text-muted">No smart bins match your filter criteria.</h3>
          <p class="card-subtitle">Try adjusting your search keyword or sector filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = bins.map(bin => {
      const maxFill = Math.max(bin.fillLevels.dry || 0, bin.fillLevels.wet || 0, bin.fillLevels.metal || 0);
      const isUrgent = maxFill >= 90;
      const isWarning = maxFill >= 70 && maxFill < 90;

      const cardClass = isUrgent ? 'bin-card status-urgent' : 'bin-card';
      const statusBadge = isUrgent 
        ? '<span class="status-badge urgent">🔴 URGENT FULL</span>' 
        : isWarning 
          ? '<span class="status-badge pending">🟡 WARNING</span>' 
          : '<span class="status-badge active">🟢 NORMAL</span>';

      return `
        <div class="card glass-card ${cardClass}" id="card-${bin.id}">
          <div class="bin-card-top">
            <span class="bin-serial">${bin.serial}</span>
            ${statusBadge}
          </div>

          <div class="bin-zone-badge">📍 ${bin.zone}</div>

          <div class="bin-location-box">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${bin.location}</span>
          </div>

          <!-- Multi-Compartment Visual Fill Meters (Dry, Wet, Metal) -->
          <div class="compartments-container">
            ${this.renderCompartmentMeter('DRY', bin.fillLevels.dry || 0, 'dry')}
            ${this.renderCompartmentMeter('WET', bin.fillLevels.wet || 0, 'wet')}
            ${this.renderCompartmentMeter('METAL', bin.fillLevels.metal || 0, 'metal')}
          </div>

          <div class="bin-card-footer">
            <span class="text-muted font-mono">Ping: ${bin.lastUpdated}</span>
            <div class="bin-actions">
              ${isUrgent ? `
                <button class="btn btn-danger btn-sm" onclick="window.app.triggerUrgentModalForBin('${bin.id}')">
                  ⚠️ Alert Detail
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.app.emptyBin('${bin.id}')">
                🗑️ Discharge / Empty
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderCompartmentMeter(label, fillLevel, type) {
    const isUrgent = fillLevel >= 90;
    const pctClass = isUrgent ? 'meter-pct urgent' : 'meter-pct';
    const fillClass = isUrgent ? `meter-fill ${type} urgent` : `meter-fill ${type}`;

    return `
      <div class="comp-meter-row">
        <div class="meter-header">
          <span class="meter-tag ${type}">${label} COMPARTMENT</span>
          <span class="${pctClass}">${fillLevel}%</span>
        </div>
        <div class="meter-track">
          <div class="${fillClass}" style="width: ${fillLevel}%;"></div>
        </div>
      </div>
    `;
  }

  renderTable(bins) {
    const tbody = document.getElementById('bins-table-body');
    if (!tbody) return;

    if (bins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No smart bins matching current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = bins.map(bin => {
      const maxFill = Math.max(bin.fillLevels.dry || 0, bin.fillLevels.wet || 0, bin.fillLevels.metal || 0);
      const isUrgent = maxFill >= 90;
      const statusBadge = isUrgent 
        ? '<span class="status-badge urgent">URGENT</span>' 
        : maxFill >= 70 
          ? '<span class="status-badge pending">WARNING</span>' 
          : '<span class="status-badge active">NORMAL</span>';

      return `
        <tr>
          <td>
            <strong>${bin.serial}</strong>
            <div class="text-muted font-size-xs">${bin.zone}</div>
          </td>
          <td>${bin.location}</td>
          <td><span class="${bin.fillLevels.dry >= 90 ? 'font-strictly-red font-bold' : ''}">${bin.fillLevels.dry}%</span></td>
          <td><span class="${bin.fillLevels.wet >= 90 ? 'font-strictly-red font-bold' : ''}">${bin.fillLevels.wet}%</span></td>
          <td><span class="${bin.fillLevels.metal >= 90 ? 'font-strictly-red font-bold' : ''}">${bin.fillLevels.metal}%</span></td>
          <td>${statusBadge}</td>
          <td class="font-mono text-muted">${bin.lastUpdated}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.app.emptyBin('${bin.id}')">
              Empty
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}
