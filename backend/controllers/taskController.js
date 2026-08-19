/**
 * backend/controllers/taskController.js
 * Task Assignment Workflow (SMS feature disabled for mid-week submission).
 */

const Task = require('../models/Task');
const Staff = require('../models/Staff');
const Alert = require('../models/Alert');
const Bin = require('../models/Bin');
const AuditLog = require('../models/AuditLog');
const { sendTaskSMS } = require('../utils/sendSMS');

// Assign Task to Staff Member (Story 20, 21)
exports.assignTask = async (req, res) => {
  try {
    const { staffId, binId, compartment, alertId } = req.body;

    if (!staffId || !binId || !compartment) {
      return res.status(400).json({ error: 'staffId, binId, and compartment are required' });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ error: 'Selected staff member not found' });
    }

    const formattedBinId = binId.trim().toUpperCase();
    const bin = await Bin.findOne({ binId: formattedBinId });
    const location = bin ? bin.location : 'Field Location';
    const compName = compartment.toUpperCase();

    // Construct SMS Text Message
    const smsMessageBody = `🚨 BINBOT URGENT TASK ASSIGNED: Hello ${staff.fullName}, you have been assigned to collect Bin ID: ${formattedBinId} (${compName} Compartment - 100% FULL) at Location: ${location}. Phone: ${staff.phone}. Please clear upon arrival.`;

    // Dispatch Twilio SMS Message
    const smsResult = await sendTaskSMS(staff.phone, smsMessageBody);

    // 1. Create Task document in MongoDB
    const newTask = await Task.create({
      staffId: staff._id,
      staffName: staff.fullName,
      staffPhone: staff.phone,
      binId: formattedBinId,
      location,
      compartment: compartment.toLowerCase(),
      status: 'ASSIGNED',
      smsStatus: smsResult.success ? (smsResult.mode === 'REAL_SMS' ? 'SENT' : 'SIMULATED') : 'FAILED'
    });

    // 2. Update Alert status to "ASSIGNED: [Staff Name]" (Story 20, 21)
    if (alertId) {
      await Alert.findByIdAndUpdate(alertId, {
        status: 'ASSIGNED',
        isAssigned: true,
        assignedStaffName: staff.fullName,
        assignedStaffPhone: staff.phone,
        taskId: newTask._id
      });
    } else {
      await Alert.updateMany(
        { binId: formattedBinId, compartment: compartment.toLowerCase(), status: { $ne: 'RESOLVED' } },
        {
          status: 'ASSIGNED',
          isAssigned: true,
          assignedStaffName: staff.fullName,
          assignedStaffPhone: staff.phone,
          taskId: newTask._id
        }
      );
    }

    // Update Staff Status to ASSIGNED
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

// Get All Tasks
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
