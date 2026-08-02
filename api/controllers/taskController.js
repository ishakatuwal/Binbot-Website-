const Task = require('../../backend/models/Task');
const Staff = require('../../backend/models/Staff');
const Alert = require('../../backend/models/Alert');
const Bin = require('../../backend/models/Bin');
const AuditLog = require('../../backend/models/AuditLog');

exports.assignTask = async (req, res) => {
  try {
    const { staffId, binId, compartment, alertId } = req.body;
    if (!staffId || !binId || !compartment) {
      return res.status(400).json({ error: 'staffId, binId, and compartment are required' });
    }
    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ error: 'Selected staff member not found' });

    const formattedBinId = binId.trim().toUpperCase();
    const bin = await Bin.findOne({ binId: formattedBinId });
    const location = bin ? bin.location : 'Field Location';
    const compName = compartment.toUpperCase();

    const newTask = await Task.create({
      staffId: staff._id,
      staffName: staff.fullName,
      staffPhone: staff.phone,
      binId: formattedBinId,
      location,
      compartment: compartment.toLowerCase(),
      status: 'ASSIGNED',
      smsStatus: 'ASSIGNED'
    });

    if (alertId) {
      await Alert.findByIdAndUpdate(alertId, {
        status: 'ASSIGNED',
        isAssigned: true,
        assignedStaffName: staff.fullName,
        assignedStaffPhone: staff.phone,
        taskId: newTask._id
      });
    }

    staff.status = 'ASSIGNED';
    await staff.save();

    await AuditLog.create({
      action: 'ASSIGN_TASK',
      performedBy: 'operator',
      targetItem: formattedBinId,
      details: `Assigned task for ${formattedBinId} (${compName}) to ${staff.fullName} (${staff.phone}).`
    });

    res.status(201).json({
      message: `Task assigned to ${staff.fullName}!`,
      task: newTask,
      assignedStaffName: staff.fullName,
      status: 'ASSIGNED'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
