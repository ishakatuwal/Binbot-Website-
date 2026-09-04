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

    // Dispatch ClickSend SMS Message (Gracefully handle API errors)
    let smsResult = { success: false, mode: 'SIMULATED' };
    try {
      smsResult = await sendTaskSMS(staff.phone, smsMessageBody);
    } catch (smsErr) {
      console.warn('⚠️ ClickSend SMS Dispatch Warning:', smsErr.message);
    }

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

    const successNotice = smsResult.success && smsResult.mode === 'REAL_SMS'
      ? `Task assigned to ${staff.fullName}! Real SMS sent to ${staff.phone}.`
      : `Task assigned to ${staff.fullName}! (SMS notification recorded).`;

    res.status(201).json({
      message: successNotice,
      task: newTask,
      assignedStaffName: staff.fullName,
      status: 'ASSIGNED',
      smsResult
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

// Complete Task & Dismiss Alert (Story 7, 20, 21)
exports.completeTask = async (req, res) => {
  try {
    const { taskId, alertId, binId, compartment } = req.body;
    const targetTaskId = taskId || req.params.taskId;

    let task = null;
    if (targetTaskId) {
      task = await Task.findById(targetTaskId);
    }
    if (!task && alertId) {
      const alt = await Alert.findById(alertId);
      if (alt && alt.taskId) {
        task = await Task.findById(alt.taskId);
      }
    }
    if (!task && binId) {
      task = await Task.findOne({
        binId: binId.trim().toUpperCase(),
        status: 'ASSIGNED'
      }).sort({ createdAt: -1 });
    }

    const completedTime = new Date();

    // 1. Update Task document status to COMPLETED
    if (task) {
      task.status = 'COMPLETED';
      task.completedAt = completedTime;
      await task.save();

      // Free up the assigned staff member back to AVAILABLE
      if (task.staffId) {
        await Staff.findByIdAndUpdate(task.staffId, { status: 'AVAILABLE' });
      }
    }

    const targetBinId = task ? task.binId : (binId ? binId.trim().toUpperCase() : null);
    const targetComp = task ? task.compartment : (compartment ? compartment.toLowerCase() : null);

    // 2. Dismiss and resolve alert in MongoDB
    if (alertId) {
      await Alert.findByIdAndUpdate(alertId, {
        status: 'RESOLVED',
        isAssigned: false,
        resolvedAt: completedTime
      });
    }

    if (targetBinId) {
      // Resolve any remaining active alerts for this bin
      await Alert.updateMany(
        { binId: targetBinId, status: { $ne: 'RESOLVED' } },
        { $set: { status: 'RESOLVED', isAssigned: false, resolvedAt: completedTime } }
      );

      // 3. Clear the Bin compartment fill level back to 0%
      const bin = await Bin.findOne({ binId: targetBinId });
      if (bin) {
        if (targetComp && bin.compartments && bin.compartments[targetComp] !== undefined) {
          bin.compartments[targetComp] = 0;
        } else if (bin.compartments) {
          bin.compartments.dry = 0;
          bin.compartments.wet = 0;
          bin.compartments.metal = 0;
        }
        bin.lastUpdated = completedTime;
        await bin.save();
      }
    }

    // 4. Record in Immutable Audit Log
    await AuditLog.create({
      action: 'COMPLETE_TASK',
      performedBy: 'operator',
      targetItem: targetBinId || 'TASK',
      details: `Completed collection task for ${targetBinId || 'Bin'} (${(targetComp || 'all').toUpperCase()} compartment). Alert dismissed from active display and fill level reset to 0%.`
    });

    res.json({
      success: true,
      message: `Task completed! Bin ${targetBinId || ''} cleared and alert dismissed.`,
      task
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: error.message });
  }
};

