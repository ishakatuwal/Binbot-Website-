/**
 * backend/controllers/staffController.js
 * Handles Staff Member Registration and Unique Phone Validation (Story 18).
 */

const Staff = require('../models/Staff');
const AuditLog = require('../models/AuditLog');

// Register New Staff Member (Story 18)
exports.registerStaff = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    if (!firstName || !lastName || !phone) {
      return res.status(400).json({ error: 'First Name, Last Name, and Phone Number are required' });
    }

    const cleanPhone = phone.trim();

    // Unique phone number validation (Story 18)
    const existingStaff = await Staff.findOne({ phone: cleanPhone });
    if (existingStaff) {
      return res.status(400).json({ error: `Staff member with phone number '${cleanPhone}' is already registered` });
    }

    const newStaff = await Staff.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      phone: cleanPhone,
      role: 'Staff',
      status: 'AVAILABLE'
    });

    await AuditLog.create({
      action: 'REGISTER_STAFF',
      performedBy: 'superadmin',
      targetItem: cleanPhone,
      details: `Registered new staff member: ${newStaff.fullName} (${cleanPhone})`
    });

    res.status(201).json({
      message: 'Staff Member Registered Successfully',
      staff: newStaff
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Staff Members (Story 18, 20)
exports.getAllStaff = async (req, res) => {
  try {
    const staffList = await Staff.find().sort({ createdAt: -1 });
    res.json(staffList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
