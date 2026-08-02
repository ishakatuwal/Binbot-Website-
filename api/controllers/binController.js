const Bin = require('../../backend/models/Bin');
const Alert = require('../../backend/models/Alert');
const AuditLog = require('../../backend/models/AuditLog');
const { getIO } = require('../../backend/socket');

exports.registerBin = async (req, res) => {
  try {
    const { binId, location, address, dry, wet, metal } = req.body;
    const binLocation = location || address;
    if (!binId || !binLocation) {
      return res.status(400).json({ error: 'Bin ID and Location address are required' });
    }
    const formattedBinId = binId.trim().toUpperCase();
    const existingBin = await Bin.findOne({ binId: formattedBinId });
    if (existingBin) {
      return res.status(400).json({ error: `Bin ID '${formattedBinId}' already exists in database` });
    }
    const newBin = await Bin.create({
      binId: formattedBinId,
      location: binLocation,
      latitude: req.body.latitude ? Number(req.body.latitude) : -33.8688,
      longitude: req.body.longitude ? Number(req.body.longitude) : 151.2093,
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
    res.status(201).json({ message: 'Bin Registered Successfully', bin: newBin });
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
    const { binId, dry, wet, metal, location } = req.body;
    if (!binId) return res.status(400).json({ error: 'binId parameter required' });

    const formattedBinId = binId.trim().toUpperCase();
    let bin = await Bin.findOne({ binId: formattedBinId });
    if (!bin) {
      bin = new Bin({
        binId: formattedBinId,
        location: location || 'Field Sector ESP32 Node',
        compartments: { dry: 0, wet: 0, metal: 0 }
      });
    }

    if (dry !== undefined) bin.compartments.dry = Number(dry);
    if (wet !== undefined) bin.compartments.wet = Number(wet);
    if (metal !== undefined) bin.compartments.metal = Number(metal);
    bin.lastUpdated = new Date();
    await bin.save();

    const checkAndTriggerAlert = async (compartmentName, fillVal) => {
      if (fillVal >= 80) {
        const activeAlert = await Alert.findOne({
          binId: formattedBinId,
          compartment: compartmentName,
          status: { $in: ['UNRESOLVED', 'ACKNOWLEDGED'] }
        });

        let alertRecord = activeAlert;
        if (!activeAlert) {
          alertRecord = await Alert.create({
            binId: formattedBinId,
            location: bin.location,
            compartment: compartmentName,
            fillLevel: fillVal,
            threshold: '80%',
            status: 'UNRESOLVED',
            message: `ALERT: Bin ${formattedBinId} (${compartmentName.toUpperCase()}) reached ${fillVal}% capacity.`
          });
        }

        try {
          const io = getIO();
          io.emit('urgent_bin_full', {
            alertId: alertRecord._id,
            binId: formattedBinId,
            location: bin.location,
            compartment: compartmentName,
            fillLevel: fillVal,
            threshold: '80%',
            message: 'Urgent Bin is filled and needs to be collected',
            timestamp: alertRecord.createdAt || new Date()
          });
        } catch (socketErr) {}
      }
    };

    await checkAndTriggerAlert('dry', bin.compartments.dry);
    await checkAndTriggerAlert('wet', bin.compartments.wet);
    await checkAndTriggerAlert('metal', bin.compartments.metal);

    res.json({ message: `Telemetry updated for bin ${formattedBinId}`, bin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { operatorName } = req.body;
    const alert = await Alert.findById(alertId);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedBy = operatorName || 'Operator';
    await alert.save();
    res.json({ message: 'Alert acknowledged successfully', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.emptyBin = async (req, res) => {
  try {
    const { binId } = req.params;
    const formattedBinId = binId.trim().toUpperCase();
    const bin = await Bin.findOne({ binId: formattedBinId });
    if (!bin) return res.status(404).json({ error: 'Bin not found' });
    bin.compartments.dry = 0;
    bin.compartments.wet = 0;
    bin.compartments.metal = 0;
    bin.lastUpdated = new Date();
    await bin.save();
    await Alert.updateMany(
      { binId: formattedBinId, status: { $ne: 'RESOLVED' } },
      { $set: { status: 'RESOLVED' } }
    );
    res.json({ message: `Bin ${formattedBinId} emptied successfully. Alert status cleared.`, bin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteBin = async (req, res) => {
  try {
    const { binId } = req.params;
    const formattedBinId = binId.trim().toUpperCase();
    const bin = await Bin.findOneAndDelete({ binId: formattedBinId });
    if (!bin) return res.status(404).json({ error: 'Bin not found' });
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
