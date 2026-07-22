/**
 * backend/controllers/binController.js
 * Bin management & ESP32 Webhook with 100% Socket.io Alert trigger.
 */

const Bin = require('../../database/models/Bin');
const { getIO } = require('../socket');

exports.registerBin = async (req, res) => {
  try {
    const { binId, location, dry, wet, metal } = req.body;
    if (!binId || !location) return res.status(400).json({ error: 'binId and location required' });
    const newBin = await Bin.create({
      binId: binId.toUpperCase(),
      location,
      compartments: { dry: dry || 0, wet: wet || 0, metal: metal || 0 }
    });
    res.status(201).json({ message: 'Bin registered', bin: newBin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllBins = async (req, res) => {
  try {
    const bins = await Bin.find().sort({ updatedAt: -1 });
    res.json(bins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateBinFromESP32 = async (req, res) => {
  try {
    const { binId, dry, wet, metal } = req.body;
    if (!binId) return res.status(400).json({ error: 'binId required' });
    let bin = await Bin.findOne({ binId: binId.toUpperCase() });
    if (!bin) {
      bin = new Bin({ binId: binId.toUpperCase(), location: 'Unassigned ESP32 Field Location' });
    }
    if (dry !== undefined) bin.compartments.dry = Number(dry);
    if (wet !== undefined) bin.compartments.wet = Number(wet);
    if (metal !== undefined) bin.compartments.metal = Number(metal);
    bin.lastUpdated = new Date();
    await bin.save();

    const fullCompartments = [];
    ['dry', 'wet', 'metal'].forEach((comp) => {
      if (bin.compartments[comp] >= 100) {
        fullCompartments.push(comp);
        try {
          const io = getIO();
          const alertPayload = {
            binId: bin.binId,
            location: bin.location,
            compartment: comp,
            fillLevel: bin.compartments[comp],
            timestamp: new Date().toISOString()
          };
          io.emit('urgent_bin_full', alertPayload);
          console.log(`🚨 URGENT SOCKET ALERT EMITTED [urgent_bin_full]:`, alertPayload);
        } catch (socketErr) {
          console.error('Socket error:', socketErr.message);
        }
      }
    });

    res.json({
      success: true,
      message: fullCompartments.length > 0
        ? `🚨 URGENT ALERT: Compartment(s) [${fullCompartments.join(', ')}] reached 100% full!`
        : `Telemetry updated.`,
      bin,
      alertsTriggered: fullCompartments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
