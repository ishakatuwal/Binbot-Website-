/**
 * backend/controllers/binController.js
 * 
 * Purpose: Handles Bin Registration, Fetching, and ESP32 Telemetry Webhooks.
 * Hardware Rule: ESP32 only triggers when a bin compartment reaches 80% filled.
 * Emits real-time Socket.io urgent_bin_full alert upon reaching 80%+ capacity.
 */

const Bin = require('../models/Bin');
const { getIO } = require('../socket');

// 1. Superadmin Registers New Bin
exports.registerBin = async (req, res) => {
  try {
    const { binId, location, dry, wet, metal } = req.body;

    if (!binId || !location) {
      return res.status(400).json({ error: 'binId and location are required' });
    }

    const existingBin = await Bin.findOne({ binId: binId.toUpperCase() });
    if (existingBin) {
      return res.status(400).json({ error: `Bin with ID '${binId}' already exists` });
    }

    const newBin = await Bin.create({
      binId: binId.toUpperCase(),
      location: location,
      compartments: {
        dry: dry !== undefined ? Number(dry) : 0,
        wet: wet !== undefined ? Number(wet) : 0,
        metal: metal !== undefined ? Number(metal) : 0
      }
    });

    res.status(201).json({
      message: 'New Smart Bin registered successfully in database',
      bin: newBin
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Get All Bins Data
exports.getAllBins = async (req, res) => {
  try {
    const bins = await Bin.find().sort({ updatedAt: -1 });
    res.json(bins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. ESP32 Hardware Webhook Endpoint (/api/bins/esp32-update)
// Hardware Rule: ESP32 triggers when fill level reaches 80% full
exports.updateBinFromESP32 = async (req, res) => {
  try {
    const { binId, dry, wet, metal } = req.body;

    if (!binId) {
      return res.status(400).json({ error: 'binId is required in ESP32 payload' });
    }

    // Find bin or register if new ESP32 connects
    let bin = await Bin.findOne({ binId: binId.toUpperCase() });

    if (!bin) {
      bin = new Bin({
        binId: binId.toUpperCase(),
        location: 'Field Sector ESP32 Node',
        compartments: { dry: 0, wet: 0, metal: 0 }
      });
    }

    // Update compartment fill percentages if supplied
    if (dry !== undefined) bin.compartments.dry = Number(dry);
    if (wet !== undefined) bin.compartments.wet = Number(wet);
    if (metal !== undefined) bin.compartments.metal = Number(metal);

    bin.lastUpdated = new Date();
    await bin.save();

    // Hardware Rule: Check if any compartment reaches 80% filled threshold
    const triggeredCompartments = [];
    const compartmentsList = ['dry', 'wet', 'metal'];

    compartmentsList.forEach((comp) => {
      if (bin.compartments[comp] >= 80) {
        triggeredCompartments.push(comp);

        // Emit Socket.io event: urgent_bin_full
        try {
          const io = getIO();
          const alertPayload = {
            binId: bin.binId,
            location: bin.location,
            compartment: comp,
            fillLevel: bin.compartments[comp],
            threshold: '80%',
            timestamp: new Date().toISOString()
          };

          io.emit('urgent_bin_full', alertPayload);
          console.log(`🚨 80% HARDWARE ALERT EMITTED [urgent_bin_full]:`, alertPayload);
        } catch (socketErr) {
          console.error('Socket.io alert error:', socketErr.message);
        }
      }
    });

    res.json({
      success: true,
      message: triggeredCompartments.length > 0
        ? `🚨 80% HARDWARE TRIGGER ALERT: Compartment(s) [${triggeredCompartments.join(', ')}] reached 80%+ filled capacity!`
        : `ESP32 Telemetry recorded successfully.`,
      bin: bin,
      alertsTriggered: triggeredCompartments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
