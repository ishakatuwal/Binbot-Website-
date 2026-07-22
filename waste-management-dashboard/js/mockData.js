/* ==========================================================================
   EcoPulse Smart Waste Management System - Mock Data & State Store
   ========================================================================== */

export const INITIAL_ADMINS = [
  {
    id: 'ADM-101',
    name: 'Sarah Jenkins',
    email: 's.jenkins@ecopulse.gov',
    role: 'District Fleet Admin',
    zone: 'Sector 1 - Central Business District',
    status: 'active',
    registeredAt: '2026-01-15'
  },
  {
    id: 'ADM-102',
    name: 'Marcus Vance',
    email: 'm.vance@ecopulse.gov',
    role: 'Zone Dispatch Supervisor',
    zone: 'Sector 2 - North Park & Civic Plaza',
    status: 'active',
    registeredAt: '2026-02-10'
  },
  {
    id: 'ADM-103',
    name: 'Elena Rostova',
    email: 'e.rostova@ecopulse.gov',
    role: 'Regional Environmental Officer',
    zone: 'Sector 3 - Industrial Tech Hub',
    status: 'active',
    registeredAt: '2026-03-04'
  },
  {
    id: 'ADM-104',
    name: 'David Chen',
    email: 'd.chen@ecopulse.gov',
    role: 'Maintenance Technician',
    zone: 'Sector 4 - South Waterfront District',
    status: 'active',
    registeredAt: '2026-04-18'
  }
];

export const INITIAL_BINS = [
  {
    id: 'BIN-2026-101',
    serial: 'BIN-2026-101',
    location: 'Sector 1 - 5th Ave & 42nd St Crossing',
    zone: 'Sector 1 - Central Business District',
    coords: '40.7580, -73.9855',
    capacities: { dry: 120, wet: 100, metal: 80 },
    fillLevels: { dry: 45, wet: 62, metal: 18 },
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-01-10'
  },
  {
    id: 'BIN-2026-102',
    serial: 'BIN-2026-102',
    location: 'Sector 1 - Times Square Metro Gate B',
    zone: 'Sector 1 - Central Business District',
    coords: '40.7589, -73.9851',
    capacities: { dry: 150, wet: 120, metal: 100 },
    fillLevels: { dry: 78, wet: 40, metal: 25 },
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-01-12'
  },
  {
    id: 'BIN-2026-103',
    serial: 'BIN-2026-103',
    location: 'Sector 2 - Central Park North Pond Entrance',
    zone: 'Sector 2 - North Park & Civic Plaza',
    coords: '40.7969, -73.9546',
    capacities: { dry: 120, wet: 100, metal: 80 },
    fillLevels: { dry: 30, wet: 55, metal: 88 },
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-02-01'
  },
  {
    id: 'BIN-2026-104',
    serial: 'BIN-2026-104',
    location: 'Sector 2 - City Hall Amphitheater South',
    zone: 'Sector 2 - North Park & Civic Plaza',
    coords: '40.7128, -74.0060',
    capacities: { dry: 140, wet: 110, metal: 90 },
    fillLevels: { dry: 92, wet: 45, metal: 35 }, // Dry is Urgent Full!
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-02-14'
  },
  {
    id: 'BIN-2026-105',
    serial: 'BIN-2026-105',
    location: 'Sector 3 - Innovation Way & Tech Hub Bay 4',
    zone: 'Sector 3 - Industrial Tech Hub',
    coords: '40.7484, -73.9857',
    capacities: { dry: 200, wet: 150, metal: 120 },
    fillLevels: { dry: 20, wet: 35, metal: 12 },
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-03-01'
  },
  {
    id: 'BIN-2026-106',
    serial: 'BIN-2026-106',
    location: 'Sector 3 - Robotics Lab Loading Dock',
    zone: 'Sector 3 - Industrial Tech Hub',
    coords: '40.7490, -73.9860',
    capacities: { dry: 180, wet: 120, metal: 150 },
    fillLevels: { dry: 50, wet: 94, metal: 60 }, // Wet is Urgent Full!
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-03-10'
  },
  {
    id: 'BIN-2026-107',
    serial: 'BIN-2026-107',
    location: 'Sector 4 - Pier 17 Boardwalk West',
    zone: 'Sector 4 - South Waterfront District',
    coords: '40.7061, -74.0031',
    capacities: { dry: 120, wet: 120, metal: 80 },
    fillLevels: { dry: 65, wet: 70, metal: 40 },
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-04-02'
  },
  {
    id: 'BIN-2026-108',
    serial: 'BIN-2026-108',
    location: 'Sector 4 - Ferry Terminal Gate 3',
    zone: 'Sector 4 - South Waterfront District',
    coords: '40.7012, -74.0135',
    capacities: { dry: 160, wet: 140, metal: 100 },
    fillLevels: { dry: 15, wet: 22, metal: 91 }, // Metal is Urgent Full!
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-04-11'
  },
  {
    id: 'BIN-2026-109',
    serial: 'BIN-2026-109',
    location: 'Sector 5 - Grand Avenue Residential Complex',
    zone: 'Sector 5 - East Residential Heights',
    coords: '40.7282, -73.9792',
    capacities: { dry: 120, wet: 100, metal: 80 },
    fillLevels: { dry: 40, wet: 50, metal: 30 },
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-05-01'
  },
  {
    id: 'BIN-2026-110',
    serial: 'BIN-2026-110',
    location: 'Sector 5 - Heights Community Center',
    zone: 'Sector 5 - East Residential Heights',
    coords: '40.7310, -73.9780',
    capacities: { dry: 140, wet: 120, metal: 90 },
    fillLevels: { dry: 85, wet: 42, metal: 19 },
    lastUpdated: new Date().toLocaleTimeString(),
    installedAt: '2026-05-15'
  }
];

class StateManager {
  constructor() {
    this.admins = this.loadAdmins();
    this.bins = this.loadBins();
    this.alerts = [];
    this.listeners = [];
  }

  loadAdmins() {
    const saved = localStorage.getItem('ecopulse_admins');
    return saved ? JSON.parse(saved) : INITIAL_ADMINS;
  }

  saveAdmins() {
    localStorage.setItem('ecopulse_admins', JSON.stringify(this.admins));
    this.notify();
  }

  loadBins() {
    const saved = localStorage.getItem('ecopulse_bins');
    return saved ? JSON.parse(saved) : INITIAL_BINS;
  }

  saveBins() {
    localStorage.setItem('ecopulse_bins', JSON.stringify(this.bins));
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  addAdmin(adminData) {
    const newAdmin = {
      id: `ADM-${Date.now().toString().slice(-3)}`,
      ...adminData,
      status: 'active',
      registeredAt: new Date().toISOString().split('T')[0]
    };
    this.admins.unshift(newAdmin);
    this.saveAdmins();
    return newAdmin;
  }

  addBin(binData) {
    const newBin = {
      id: binData.serial,
      ...binData,
      lastUpdated: new Date().toLocaleTimeString(),
      installedAt: new Date().toISOString().split('T')[0]
    };
    this.bins.unshift(newBin);
    this.saveBins();
    return newBin;
  }

  updateBinCompartmentFill(binId, compartment, fillPct) {
    const bin = this.bins.find(b => b.id === binId || b.serial === binId);
    if (!bin) return null;

    bin.fillLevels[compartment] = Math.min(100, Math.max(0, fillPct));
    bin.lastUpdated = new Date().toLocaleTimeString();
    this.saveBins();
    return bin;
  }

  emptyBin(binId) {
    const bin = this.bins.find(b => b.id === binId || b.serial === binId);
    if (!bin) return null;
    bin.fillLevels = { dry: 10, wet: 10, metal: 10 };
    bin.lastUpdated = new Date().toLocaleTimeString();
    this.saveBins();
    return bin;
  }
}

export const store = new StateManager();
