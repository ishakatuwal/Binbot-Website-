/* ==========================================================================
   EcoPulse Smart Waste Management System - WebSocket Service & Simulator
   ========================================================================== */

import { store } from './mockData.js';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.simulating = false;
    this.listeners = [];
    this.simInterval = null;
  }

  // Connect to actual or simulated WebSocket
  connect(url = 'ws://localhost:8080/telemetry') {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emitStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingTelemetry(data);
        } catch (err) {
          console.error('[WS Error] Bad JSON payload', err);
        }
      };

      this.ws.onerror = () => {
        console.warn('[WS Warning] Real WebSocket server unreachable. Fallback to Simulation Mode.');
        this.enableSimulationMode();
      };

      this.ws.onclose = () => {
        if (!this.simulating) {
          this.isConnected = false;
          this.emitStatus('disconnected');
        }
      };
    } catch (e) {
      console.warn('[WS Warning] Direct WebSocket instantiation failed. Running simulation engine.');
      this.enableSimulationMode();
    }
  }

  // Enable Mock Simulation Engine for WebSocket Events
  enableSimulationMode() {
    this.isConnected = true;
    this.simulating = true;
    this.emitStatus('connected');

    // Periodically update random telemetry or trigger occasional alerts
    if (!this.simInterval) {
      this.simInterval = setInterval(() => {
        this.simulateRandomSensorPing();
      }, 15000); // Every 15 seconds
    }
  }

  toggleConnection() {
    if (this.isConnected) {
      if (this.ws) this.ws.close();
      if (this.simInterval) clearInterval(this.simInterval);
      this.simInterval = null;
      this.isConnected = false;
      this.simulating = false;
      this.emitStatus('disconnected');
    } else {
      this.enableSimulationMode();
    }
  }

  onStatusChange(callback) {
    this.statusCallback = callback;
  }

  emitStatus(status) {
    if (this.statusCallback) this.statusCallback(status, this.simulating);
  }

  // Register listener for bin events (telemetry updates & urgent full-bin alerts)
  onEvent(callback) {
    this.listeners.push(callback);
  }

  emitEvent(eventType, payload) {
    this.listeners.forEach(cb => cb({ type: eventType, data: payload, timestamp: new Date().toLocaleTimeString() }));
  }

  handleIncomingTelemetry(payload) {
    // Expected structure: { binId, compartment: 'dry'|'wet'|'metal', fillLevel: 95 }
    if (payload.binId && payload.compartment && payload.fillLevel !== undefined) {
      const updatedBin = store.updateBinCompartmentFill(payload.binId, payload.compartment, payload.fillLevel);
      
      if (updatedBin) {
        // Emit raw update event
        this.emitEvent('BIN_UPDATE', { bin: updatedBin, compartment: payload.compartment });

        // Check if full-bin event threshold is met (≥ 90%)
        if (payload.fillLevel >= 90) {
          this.emitEvent('FULL_BIN_ALERT', {
            bin: updatedBin,
            compartment: payload.compartment.toLowerCase(),
            fillLevel: payload.fillLevel,
            location: updatedBin.location,
            zone: updatedBin.zone,
            timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
          });
        }
      }
    }
  }

  // Explicit Trigger Method for Full-Bin Events (used by developer bar & user requests)
  triggerFullBinAlert(binId, compartment = 'dry', level = 96) {
    const targetBin = store.bins.find(b => b.id === binId || b.serial === binId);
    if (!targetBin) return null;

    // Update store state
    store.updateBinCompartmentFill(targetBin.id, compartment, level);

    const alertPayload = {
      bin: targetBin,
      binId: targetBin.id,
      serial: targetBin.serial,
      location: targetBin.location,
      zone: targetBin.zone,
      compartment: compartment.toLowerCase(), // 'dry', 'wet', or 'metal'
      fillLevel: level,
      timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
    };

    // Emit event to notification bus & dashboards
    this.emitEvent('FULL_BIN_ALERT', alertPayload);
    this.emitEvent('BIN_UPDATE', { bin: targetBin, compartment });
    return alertPayload;
  }

  simulateRandomSensorPing() {
    if (store.bins.length === 0) return;
    const randomBin = store.bins[Math.floor(Math.random() * store.bins.length)];
    const compartments = ['dry', 'wet', 'metal'];
    const randomComp = compartments[Math.floor(Math.random() * compartments.length)];
    const currentVal = randomBin.fillLevels[randomComp] || 20;
    const newVal = Math.min(100, currentVal + Math.floor(Math.random() * 15) - 3);

    this.handleIncomingTelemetry({
      binId: randomBin.id,
      compartment: randomComp,
      fillLevel: newVal
    });
  }
}

export const wsService = new WebSocketService();
