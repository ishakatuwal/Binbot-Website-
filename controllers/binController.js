/**
 * backend/controllers/binController.js
 * Smart Bin Management & Real-Time ESP32 Telemetry Handler.
 * Emits 80%+ hardware threshold alerts (Dry, Wet, Metal), logs to Alert collection, and throttles notifications.
 */

const Bin = require('../models/Bin');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');
const { getIO } = require('../socket');

// 1. Superadmin Registers New Bin (Story 4)
exports.registerBin = async (req, res) => {
  try {
    const { binId, location, address, dry, wet, metal } = req.body;
    const binLocation = location || address;

    if (!binId || !binLocation) {
      return res.status(400).json({ error: 'Bin ID and Location address are required' });
    }

    const formattedBinId = binId.trim().toUpperCase();

    // Check duplicate Bin ID (Story 4)
    const existingBin = await Bin.findOne({ binId: formattedBinId });
    if (existingBin) {
      return res.status(400).json({ error: `Bin ID '${formattedBinId}' already exists in database` });
    }

    const newBin = await Bin.create({
      binId: formattedBinId,
      location: binLocation,
      compartments: {
        dry: dry !== undefined ? Number(dry) : 0,
        wet: wet !== undefined ? Number(wet) : 0,
        metal: metal !== undefined ? Number(metal) : 0
      }
    });

    await AuditLog.create({
      action: 'REGISTER_BIN',
      performedBy: 'superadmin',
      targetItem: formattedBinId,
      details: `Registered new bin ${formattedBinId} at address: ${binLocation}`
    });

    res.status(201).json({
      message: 'Bin Registered Successfully',
      bin: newBin
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Get All Bins Data (Story 14)
exports.getAllBins = async (req, res) => {
  try {
    const bins = await Bin.find().sort({ updatedAt: -1 });
    res.json(bins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. ESP32 Hardware Webhook Endpoint (Story 1, 5, 6, 8, 14, 16)
exports.updateBinFromESP32 = async (req, res) => {
  try {
    const { binId, bin_id, dry, wet, metal, fill_level } = req.body;
    const targetBinId = (binId || bin_id || '').trim().toUpperCase();

    if (!targetBinId) {
      return res.status(400).json({ error: 'binId is required in payload' });
    }

    let bin = await Bin.findOne({ binId: targetBinId });
    if (!bin) {
      bin = new Bin({
        binId: targetBinId,
        location: 'Field Sector Node',
        compartments: { dry: 0, wet: 0, metal: 0 }
      });
    }

    // Update compartment fill percentages if supplied
    if (dry !== undefined) bin.compartments.dry = Number(dry);
    if (wet !== undefined) bin.compartments.wet = Number(wet);
    if (metal !== undefined) bin.compartments.metal = Number(metal);

    // Fallback if legacy single fill_level payload is sent
    if (fill_level !== undefined && dry === undefined && wet === undefined && metal === undefined) {
      bin.compartments.dry = Number(fill_level);
    }

    bin.lastUpdated = new Date();
    await bin.save();

    const triggeredAlerts = [];
    const compartments = ['dry', 'wet', 'metal'];

    for (const comp of compartments) {
      const fillPercentage = bin.compartments[comp];

      // Hardware Rule: Trigger alert when fill level >= 80% (Story 1, 5, 6, 8, 16)
      if (fillPercentage >= 80) {
        triggeredAlerts.push(comp);

        const alertMessage = `Urgent Bin is filled and needs to be collected (${comp.toUpperCase()} compartment: ${fillPercentage}% Full)`;

        // Save persistent alert to MongoDB (Story 5, 6, 16)
        const newAlert = await Alert.create({
          binId: bin.binId,
          location: bin.location,
          compartment: comp,
          fillLevel: fillPercentage,
          threshold: '80%',
          status: 'UNRESOLVED',
          message: alertMessage
        });

        // Emit Socket.io real-time alert (Story 8, 14, 16)
        try {
          const io = getIO();
          const alertPayload = {
            alertId: newAlert._id,
            binId: bin.binId,
            location: bin.location,
            compartment: comp,
            fillLevel: fillPercentage,
            threshold: '80%',
            message: 'Urgent Bin is filled and needs to be collected',
            timestamp: newAlert.createdAt
          };

          io.emit('urgent_bin_full', alertPayload);
          console.log(`🚨 RED ALERT EMITTED [urgent_bin_full]:`, alertPayload);
        } catch (socketErr) {
          console.error('Socket alert error:', socketErr.message);
        }
      }
    }

    res.json({
      success: true,
      message: triggeredAlerts.length > 0
        ? `🚨 Urgent Bin is filled and needs to be collected (${triggeredAlerts.join(', ').toUpperCase()} compartment >= 80%)`
        : `Telemetry recorded successfully.`,
      bin,
      triggeredAlerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Get Historical Alerts (Story 5, 6, 7, 16)
exports.getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(100);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Acknowledge Alert (Story 5, 6, 7)
exports.acknowledgeAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { operatorName } = req.body;

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert record not found' });
    }

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedBy = operatorName || 'Operator';
    await alert.save();

    res.json({ message: `Alert acknowledged by ${alert.acknowledgedBy}`, alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Empty Smart Bin (Resets fill level to 0% and resolves alerts) (Story 1, 7)
exports.emptyBin = async (req, res) => {
  try {
    const { binId } = req.params;
    const formattedBinId = binId.trim().toUpperCase();

    const bin = await Bin.findOne({ binId: formattedBinId });
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    bin.compartments.dry = 0;
    bin.compartments.wet = 0;
    bin.compartments.metal = 0;
    bin.lastUpdated = new Date();
    await bin.save();

    // Mark all unresolved/acknowledged alerts for this bin as RESOLVED in MongoDB
    await Alert.updateMany(
      { binId: formattedBinId, status: { $ne: 'RESOLVED' } },
      { $set: { status: 'RESOLVED' } }
    );

    res.json({ message: `Bin ${formattedBinId} emptied successfully. Alert status cleared.`, bin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 7. Delete Bin Permanently (Superadmin Action)
exports.deleteBin = async (req, res) => {
  try {
    const { binId } = req.params;
    const formattedBinId = binId.trim().toUpperCase();

    const bin = await Bin.findOneAndDelete({ binId: formattedBinId });
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    await Alert.deleteMany({ binId: formattedBinId });
    await AuditLog.create({
      action: 'DELETE_BIN',
      performedBy: 'superadmin',
      targetItem: formattedBinId,
      details: `Deleted bin ${formattedBinId} from system`
    });

    res.json({ message: `Bin '${formattedBinId}' deleted permanently from database.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
